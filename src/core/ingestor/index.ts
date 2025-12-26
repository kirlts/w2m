// W2M - WhatsApp Ingestor (Baileys)
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { getConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import qrcode from 'qrcode-terminal';

export class WhatsAppIngestor {
  private socket: WASocket | null = null;
  private config = getConfig();
  // reconnectInterval removido - no reconectamos automáticamente
  private isConnecting = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private currentQR: string | null = null;
  private connectionCallbacks: Set<() => void> = new Set();
  private isInitialSync = true;
  private initialSyncTimeout: NodeJS.Timeout | null = null;

  async generateQR(): Promise<void> {
    logger.info('🔄 Generando código QR...');
    
    if (this.connectionState === 'connected') {
      logger.warn('⚠️ Ya estás conectado a WhatsApp. Desconecta primero si quieres generar un nuevo QR.');
      return;
    }

    // Si hay un socket existente pero no conectado, cerrarlo primero
    if (this.socket) {
      logger.info('🔄 Cerrando conexión anterior...');
      await this.stop();
    }

    this.isConnecting = true;
    this.connectionState = 'connecting';

    try {
      await this.connect();
    } catch (error) {
      logger.error({ error }, '❌ Error al generar QR');
      this.isConnecting = false;
      this.connectionState = 'disconnected';
      throw error;
    }
  }

  async start(): Promise<void> {
    logger.info('🚀 Iniciando WhatsApp Ingestor...');
    
    if (this.isConnecting || this.connectionState === 'connected') {
      logger.warn('⚠️ Ya hay una conexión activa o en progreso');
      return;
    }

    this.isConnecting = true;
    this.connectionState = 'connecting';

    try {
      await this.connect();
    } catch (error) {
      logger.error({ error }, '❌ Error al iniciar ingestor');
      this.isConnecting = false;
      this.connectionState = 'disconnected';
      // No reconectar automáticamente - el usuario debe generar QR manualmente
    }
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(
      this.config.WA_SESSION_PATH
    );

    // Obtener la versión más reciente de WhatsApp Web
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info({ version: version.join('.'), isLatest }, '📱 Versión de WhatsApp Web');

    this.socket = makeWASocket({
      version,
      auth: state,
      browser: Browsers.ubuntu('W2M'),
      // Reducir verbosidad de logs de Baileys - solo errores y warnings
      logger: logger.child({ component: 'baileys' }, { level: 'warn' }),
      getMessage: async () => undefined, // No cachear mensajes
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000, // 60 segundos para escanear QR
      generateHighQualityLinkPreview: false, // Reducir carga
    });

    // Guardar credenciales cuando cambien
    this.socket.ev.on('creds.update', async (creds) => {
      await saveCreds();
      
      // Si el pairing se completó exitosamente (tenemos creds.me pero no estamos conectados),
      // WhatsApp requerirá reiniciar la conexión, pero lo manejamos en connection.update
      if (creds.me && this.connectionState !== 'connected') {
        logger.info('✅ Credenciales guardadas. Esperando reinicio de conexión...');
      }
    });

    // Manejar conexión
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.currentQR = qr;
        
        // Mostrar QR en consola - usar process.stdout para asegurar que se vea
        // Limpiar cualquier output pendiente primero
        process.stdout.write('\n\n');
        process.stdout.write('═══════════════════════════════════════════════════════\n');
        process.stdout.write('📱 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:\n');
        process.stdout.write('═══════════════════════════════════════════════════════\n');
        process.stdout.write('\n');
        
        // Generar QR directamente en stdout
        qrcode.generate(qr, { small: true });
        
        process.stdout.write('\n');
        process.stdout.write('═══════════════════════════════════════════════════════\n');
        process.stdout.write('⏱️  Tienes 60 segundos para escanear el QR\n');
        process.stdout.write('📱 Abre WhatsApp → Configuración → Dispositivos vinculados\n');
        process.stdout.write('═══════════════════════════════════════════════════════\n');
        
        // Loguear a stderr (no interfiere con el CLI)
        logger.info('📱 QR code generado - Escanea con WhatsApp');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        // El código 515 significa "Stream Errored (restart required)"
        // Esto es normal después de escanear el QR - necesitamos reiniciar
        const errorData = lastDisconnect?.error as any;
        const isRestartRequired = 
          errorData?.output?.statusCode === 515 ||
          errorData?.data?.attrs?.code === '515' ||
          errorData?.data?.tag === 'stream:error';

        if (isRestartRequired && shouldReconnect) {
          logger.info('🔄 Reinicio requerido después del pairing. Reconectando automáticamente...');
          
          // Cerrar socket actual
          this.socket = null;
          this.isConnecting = false;
          this.connectionState = 'disconnected';
          
          // Esperar un momento para que las credenciales se guarden
          setTimeout(async () => {
            if (this.connectionState === 'disconnected' && !this.isConnecting) {
              logger.info('🔄 Reconectando con credenciales guardadas...');
              this.isConnecting = true;
              this.connectionState = 'connecting';
              try {
                await this.connect();
              } catch (error) {
                logger.error({ error }, '❌ Error al reconectar');
                this.isConnecting = false;
                this.connectionState = 'disconnected';
              }
            }
          }, 2000);
          
          return;
        }

        logger.warn(
          { shouldReconnect, reason: lastDisconnect?.error },
          '🔌 Conexión cerrada'
        );

        this.socket = null;
        this.isConnecting = false;
        this.connectionState = 'disconnected';

        // No reconectar automáticamente - el usuario debe generar QR manualmente
        if (!shouldReconnect) {
          logger.error('❌ Sesión cerrada. Necesitas escanear el QR de nuevo.');
        }
      } else if (connection === 'open') {
        logger.info('✅ Conectado a WhatsApp exitosamente!');
        this.isConnecting = false;
        this.connectionState = 'connected';
        this.currentQR = null; // Limpiar QR cuando se conecta
        
        // Marcar sincronización inicial - esperar 5 segundos para que termine
        this.isInitialSync = true;
        if (this.initialSyncTimeout) clearTimeout(this.initialSyncTimeout);
        this.initialSyncTimeout = setTimeout(() => {
          this.isInitialSync = false;
          this.initialSyncTimeout = null;
        }, 5000);
        
        // Notificar a los callbacks de conexión
        this.connectionCallbacks.forEach(callback => callback());
        this.connectionCallbacks.clear();
      } else if (connection === 'connecting') {
        logger.info('🔄 Conectando a WhatsApp...');
        this.connectionState = 'connecting';
      }
    });

    this.socket.ev.on('messages.upsert', async (m) => {
      const messages = m.messages;
      
      for (const message of messages) {
        // Ignorar mensajes propios
        if (message.key.fromMe) continue;
        
        // Filtrar mensajes del historial:
        // - Mensajes con type === 'notify' son del historial
        // - Mensajes recibidos durante la sincronización inicial
        // - Mensajes sin timestamp o con timestamp muy antiguo
        const messageTimestamp = message.messageTimestamp;
        const isHistoryMessage = 
          m.type === 'notify' ||
          this.isInitialSync ||
          !messageTimestamp ||
          (typeof messageTimestamp === 'number' && (Date.now() / 1000 - messageTimestamp) > 300); // Más de 5 minutos = historial
        
        if (isHistoryMessage) {
          // Solo loguear en debug, no en info
          logger.debug(
            {
              from: message.key.remoteJid,
              messageId: message.key.id,
              type: m.type,
            },
            '📜 Mensaje del historial (ignorado)'
          );
          continue;
        }
        
        // Este es un mensaje nuevo - procesarlo
        logger.info(
          {
            from: message.key.remoteJid,
            messageId: message.key.id,
          },
          '📨 Mensaje nuevo recibido'
        );
        
        // TODO: Procesar mensaje con Strategy Engine
      }
    });
  }

  async stop(): Promise<void> {
    logger.info('🛑 Deteniendo WhatsApp Ingestor...');
    
    // Limpiar timeouts
    if (this.initialSyncTimeout) {
      clearTimeout(this.initialSyncTimeout);
      this.initialSyncTimeout = null;
    }
    
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
    
    this.isConnecting = false;
    this.connectionState = 'disconnected';
    this.isInitialSync = true; // Reset para próxima conexión
    this.connectionCallbacks.clear();
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Registrar un callback que se ejecutará cuando la conexión se establezca
   */
  onConnected(callback: () => void): void {
    if (this.connectionState === 'connected') {
      // Ya está conectado, ejecutar inmediatamente
      callback();
    } else {
      // Agregar a la lista de callbacks
      this.connectionCallbacks.add(callback);
    }
  }
}
