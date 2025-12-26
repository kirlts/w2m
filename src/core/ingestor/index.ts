// W2M - WhatsApp Ingestor (Baileys)
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  proto,
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

  /**
   * Limpiar credenciales inválidas (útil cuando hay error 401)
   */
  async clearInvalidSession(): Promise<void> {
    logger.info('🧹 Limpiando sesión inválida...');
    await this.stop();
    
    // Limpiar archivos de sesión (useMultiFileAuthState los regenerará)
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const sessionPath = this.config.WA_SESSION_PATH;
      const files = await fs.readdir(sessionPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(sessionPath, file));
        }
      }
      
      logger.info('✅ Sesión limpiada. Puedes generar un nuevo QR.');
    } catch (error) {
      logger.warn({ error }, '⚠️ No se pudieron limpiar algunos archivos de sesión');
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
        const errorCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = errorCode !== DisconnectReason.loggedOut;

        // El código 515 significa "Stream Errored (restart required)"
        // Esto es normal después de escanear el QR - necesitamos reiniciar
        const errorData = lastDisconnect?.error as any;
        const isRestartRequired = 
          errorCode === 515 ||
          errorData?.data?.attrs?.code === '515' ||
          errorData?.data?.tag === 'stream:error';

        // El código 401 significa "Unauthorized" - credenciales inválidas
        // Necesitamos limpiar la sesión y generar un nuevo QR
        const isUnauthorized = errorCode === 401 || errorData?.data?.reason === '401';

        if (isUnauthorized) {
          logger.warn('⚠️ Credenciales inválidas detectadas (401 Unauthorized)');
          logger.info('🧹 Limpiando sesión inválida...');
          
          // Limpiar socket
          this.socket = null;
          this.isConnecting = false;
          this.connectionState = 'disconnected';
          
          // Limpiar credenciales corruptas automáticamente (sin await - se ejecuta en background)
          this.clearInvalidSession().catch((error) => {
            logger.warn({ error }, '⚠️ Error al limpiar sesión');
          });
          
          logger.info('💡 Sesión limpiada. Puedes generar un nuevo QR con la opción 1.');
          return;
        }

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
          { shouldReconnect, reason: lastDisconnect?.error, errorCode },
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
        const remoteJid = message.key.remoteJid;
        
        // Solo procesar mensajes de grupos (terminan en @g.us)
        if (!remoteJid || !remoteJid.endsWith('@g.us')) {
          continue;
        }

        // Obtener metadata del grupo para verificar el nombre
        try {
          if (!this.socket) continue;
          
          const groupMetadata = await this.socket.groupMetadata(remoteJid);
          const groupName = groupMetadata.subject || 'Sin nombre';
          
          // Filtrar solo el grupo "Pc" (case-insensitive)
          if (groupName.toLowerCase() !== 'pc') {
            continue;
          }

          // Extraer contenido del mensaje
          const messageContent = this.extractMessageContent(message);
          const senderJid = message.key.participant || remoteJid;
          const senderName = this.getSenderName(message, groupMetadata, senderJid);
          
          // Imprimir mensaje en consola
          const timestamp = message.messageTimestamp 
            ? new Date((message.messageTimestamp as number) * 1000).toLocaleString('es-ES')
            : new Date().toLocaleString('es-ES');
          
          console.log('\n═══════════════════════════════════════════════════════');
          console.log(`📱 Grupo: ${groupName}`);
          console.log(`👤 De: ${senderName}`);
          console.log(`🕐 ${timestamp}`);
          console.log('───────────────────────────────────────────────────────');
          console.log(messageContent || '[Mensaje sin texto]');
          console.log('═══════════════════════════════════════════════════════\n');
          
          logger.info(
            {
              group: groupName,
              sender: senderName,
              messageId: message.key.id,
            },
            '📨 Mensaje capturado del grupo "Pc"'
          );
        } catch (error) {
          logger.warn({ error, remoteJid }, '⚠️ Error al procesar mensaje del grupo');
        }
      }
    });
  }

  /**
   * Extraer contenido de texto de un mensaje de Baileys
   */
  private extractMessageContent(message: proto.IWebMessageInfo): string {
    const msg = message.message;
    if (!msg) return '';

    // Mensaje de texto simple
    if (msg.conversation) {
      return msg.conversation;
    }

    // Mensaje de texto extendido
    if (msg.extendedTextMessage?.text) {
      return msg.extendedTextMessage.text;
    }

    // Mensaje con imagen
    if (msg.imageMessage?.caption) {
      return `[Imagen] ${msg.imageMessage.caption}`;
    }

    // Mensaje con video
    if (msg.videoMessage?.caption) {
      return `[Video] ${msg.videoMessage.caption}`;
    }

    // Mensaje con audio
    if (msg.audioMessage) {
      return '[Audio]';
    }

    // Mensaje con documento
    if (msg.documentMessage) {
      const docName = msg.documentMessage.fileName || 'Documento sin nombre';
      return `[Documento] ${docName}`;
    }

    // Mensaje con sticker
    if (msg.stickerMessage) {
      return '[Sticker]';
    }

    // Mensaje con ubicación
    if (msg.locationMessage) {
      return '[Ubicación]';
    }

    // Mensaje con contacto
    if (msg.contactMessage) {
      return '[Contacto]';
    }

    // Otros tipos de mensaje
    return '[Mensaje no soportado]';
  }

  /**
   * Obtener el nombre del remitente
   */
  private getSenderName(
    message: proto.IWebMessageInfo,
    groupMetadata: any,
    senderJid: string
  ): string {
    // Intentar obtener el pushName del mensaje
    const pushName = message.pushName;
    if (pushName) {
      return pushName;
    }

    // Si es un grupo, buscar en los participantes
    if (groupMetadata?.participants) {
      const participant = groupMetadata.participants.find(
        (p: any) => p.id === senderJid
      );
      if (participant?.name) {
        return participant.name;
      }
    }

    // Fallback: usar el JID sin el @s.whatsapp.net
    return senderJid?.split('@')[0] || 'Desconocido';
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
