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
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private currentQR: string | null = null;

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
      logger: logger.child({ component: 'baileys' }),
      getMessage: async () => undefined, // No cachear mensajes
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000, // 60 segundos para escanear QR
      generateHighQualityLinkPreview: false, // Reducir carga
    });

    // Guardar credenciales cuando cambien
    this.socket.ev.on('creds.update', saveCreds);

    // Manejar conexión
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.currentQR = qr;
        // Mostrar QR en consola - usar process.stdout para asegurar que se vea
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
        process.stdout.write('\n\n');
        
        // También loguear para que aparezca en los logs estructurados
        logger.info('📱 QR code generado - Escanea con WhatsApp');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

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
        this.clearReconnectInterval();
        this.currentQR = null; // Limpiar QR cuando se conecta
      } else if (connection === 'connecting') {
        logger.info('🔄 Conectando a WhatsApp...');
        this.connectionState = 'connecting';
      }
    });

    // Escuchar mensajes
    this.socket.ev.on('messages.upsert', async (m) => {
      const messages = m.messages;
      
      for (const message of messages) {
        if (message.key.fromMe) continue; // Ignorar mensajes propios por ahora
        
        logger.info(
          {
            from: message.key.remoteJid,
            messageId: message.key.id,
          },
          '📨 Mensaje recibido'
        );
        
        // TODO: Procesar mensaje con Strategy Engine
      }
    });
  }

  // Método removido - no reconectamos automáticamente
  // El usuario debe generar QR manualmente a través del CLI

  private clearReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  async stop(): Promise<void> {
    logger.info('🛑 Deteniendo WhatsApp Ingestor...');
    
    this.clearReconnectInterval();
    
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
    
    this.isConnecting = false;
    this.connectionState = 'disconnected';
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
}
