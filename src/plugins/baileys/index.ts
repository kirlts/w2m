// W2M - Baileys Plugin
// Implementación opcional usando @whiskeysockets/baileys
// Este módulo debe ser instalado como dependencia opcional

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  proto,
} from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { IngestorInterface, Message, Group, ConnectionState } from '../../core/ingestor/interface.js';
import { GroupManager } from '../../core/groups/index.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { broadcastSSE } from '../../web/sse.js';

export class BaileysIngestor implements IngestorInterface {
  private socket: WASocket | null = null;
  private config = getConfig();
  private groupManager: GroupManager;
  private isConnecting = false;
  private connectionState: ConnectionState = 'disconnected';
  private currentQR: string | null = null;
  private connectionCallbacks: Set<() => void> = new Set();
  private messageCallbacks: Set<(message: Message) => void> = new Set();
  private isInitialSync = true;
  private initialSyncTimeout: NodeJS.Timeout | null = null;
  private shouldDisplayQR = false; // Flag para mostrar QR solo cuando se solicita explícitamente

  constructor(groupManager?: GroupManager) {
    this.groupManager = groupManager || new GroupManager();
  }

  async initialize(): Promise<void> {
    await this.groupManager.load();
  }


  async start(): Promise<void> {
    if (this.isConnecting || this.connectionState === 'connected') {
      return;
    }

    this.shouldDisplayQR = false; // No mostrar QR automáticamente al iniciar
    this.isConnecting = true;
    this.connectionState = 'connecting';

    try {
      await this.connect();
    } catch (error) {
      logger.error({ error }, 'Error al iniciar ingestor');
      this.isConnecting = false;
      this.connectionState = 'disconnected';
    }
  }

  async generateQR(): Promise<void> {
    if (this.connectionState === 'connected') {
      logger.warn('Ya estás conectado. Desconecta primero si quieres generar un nuevo QR.');
      return;
    }

    if (this.socket) {
      await this.stop();
    }

    this.shouldDisplayQR = true; // Activar flag para mostrar QR
    this.isConnecting = true;
    this.connectionState = 'connecting';

    try {
      await this.connect();
    } catch (error) {
      logger.error({ error }, 'Error al generar QR');
      this.isConnecting = false;
      this.connectionState = 'disconnected';
      this.shouldDisplayQR = false;
      throw error;
    }
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(
      this.config.WA_SESSION_PATH
    );

    const { version } = await fetchLatestBaileysVersion();

    this.socket = makeWASocket({
      version,
      auth: state,
      browser: Browsers.ubuntu('W2M'),
      logger: logger.child({ component: 'baileys' }, { level: 'error' }),
      getMessage: async () => undefined,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      generateHighQualityLinkPreview: false,
    });

    this.socket.ev.on('creds.update', async () => {
      await saveCreds();
    });

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.currentQR = qr;
        
        // Enviar QR a SSE (siempre, para el dashboard web)
        // Enviamos el código QR original para que el frontend pueda generar la imagen
        try {
          broadcastSSE('qr', { 
            qrCode: qr, // Código QR original para generar imagen
            message: 'QR generado, escanea con WhatsApp' 
          });
        } catch (error) {
          // Ignorar si no hay clientes SSE conectados
        }
        
        // Solo mostrar QR en terminal si se solicitó explícitamente (a través del menú)
        if (this.shouldDisplayQR) {
          process.stdout.write('\n\n');
          process.stdout.write('═══════════════════════════════════════════════════════\n');
          process.stdout.write('📱 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:\n');
          process.stdout.write('═══════════════════════════════════════════════════════\n');
          process.stdout.write('\n');
          qrcode.generate(qr, { small: true });
          process.stdout.write('\n');
          process.stdout.write('═══════════════════════════════════════════════════════\n');
          process.stdout.write('⏱️  Tienes 60 segundos para escanear el QR\n');
          process.stdout.write('📱 Abre WhatsApp → Configuración → Dispositivos vinculados\n');
          process.stdout.write('═══════════════════════════════════════════════════════\n');
        }
      }

      if (connection === 'close') {
        const errorCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = errorCode !== DisconnectReason.loggedOut;

        const errorData = lastDisconnect?.error as any;
        const isRestartRequired = 
          errorCode === 515 ||
          errorData?.data?.attrs?.code === '515' ||
          errorData?.data?.tag === 'stream:error';

        const isUnauthorized = errorCode === 401 || errorData?.data?.reason === '401';

        if (isUnauthorized) {
          logger.warn('Credenciales inválidas. Limpiando sesión...');
          this.socket = null;
          this.isConnecting = false;
          this.connectionState = 'disconnected';
          return;
        }

        if (isRestartRequired && shouldReconnect) {
          logger.info('Reinicio requerido después del pairing. Reconectando...');
          this.socket = null;
          this.isConnecting = false;
          this.connectionState = 'disconnected';
          
          setTimeout(async () => {
            if (this.connectionState === 'disconnected' && !this.isConnecting) {
              this.isConnecting = true;
              this.connectionState = 'connecting';
              try {
                await this.connect();
              } catch (error) {
                logger.error({ error }, 'Error al reconectar');
                this.isConnecting = false;
                this.connectionState = 'disconnected';
              }
            }
          }, 2000);
          return;
        }

        this.socket = null;
        this.isConnecting = false;
        this.connectionState = 'disconnected';

        if (!shouldReconnect) {
          logger.error('Sesión cerrada. Necesitas escanear el QR de nuevo.');
        }
      } else if (connection === 'open') {
        this.isConnecting = false;
        this.connectionState = 'connected';
        this.currentQR = null;
        this.shouldDisplayQR = false; // Resetear flag cuando se conecta
        
        this.isInitialSync = true;
        if (this.initialSyncTimeout) clearTimeout(this.initialSyncTimeout);
        this.initialSyncTimeout = setTimeout(() => {
          this.isInitialSync = false;
          this.initialSyncTimeout = null;
        }, 5000);
        
        this.connectionCallbacks.forEach(callback => callback());
        this.connectionCallbacks.clear();
      } else if (connection === 'connecting') {
        this.connectionState = 'connecting';
      }
    });

    this.socket.ev.on('messages.upsert', async (m) => {
      const messages = m.messages;
      
      for (const message of messages) {
        const remoteJid = message.key?.remoteJid;
        const messageId = message.key?.id;
        const fromMe = message.key?.fromMe || false;
        const messageTimestamp = message.messageTimestamp;
        
        const now = Date.now() / 1000;
        const isHistoryMessage = 
          this.isInitialSync ||
          !messageTimestamp ||
          (typeof messageTimestamp === 'number' && (now - messageTimestamp) > 120);
        
        if (isHistoryMessage) {
          continue;
        }
        
        if (!remoteJid || !remoteJid.endsWith('@g.us')) {
          continue;
        }

        try {
          if (!this.socket) continue;
          
          const groupMetadata = await this.socket.groupMetadata(remoteJid);
          const groupName = groupMetadata.subject || 'Sin nombre';
          
          if (!this.groupManager.isMonitored(groupName)) {
            continue;
          }
          const messageContent = this.extractMessageContent(message);
          
          const senderJid = fromMe 
            ? (this.socket?.user?.id || remoteJid)
            : (message.key?.participant || remoteJid);
          const senderName = fromMe 
            ? 'Yo' 
            : this.getSenderName(message, groupMetadata, senderJid);
          
          const timestamp = messageTimestamp 
            ? new Date((messageTimestamp as number) * 1000)
            : new Date();
          
          // Obtener zona horaria desde configuración o variable de entorno
          const timezone = this.config.TZ || process.env.TZ || 'America/Santiago';
          
          const timeStr = timestamp.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            timeZone: timezone
          });
          const dateStr = timestamp.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: timezone
          });
          
          const messageData: Message = {
            group: groupName,
            sender: senderName,
            time: `${timeStr} - ${dateStr}`,
            content: messageContent || '[Mensaje sin texto]',
          };
          
          this.messageCallbacks.forEach((callback) => {
            try {
              callback(messageData);
            } catch (error) {
              logger.error({ error }, 'Error en callback de mensaje');
            }
          });
        } catch (error) {
          logger.warn({ error, remoteJid }, 'Error al procesar mensaje del grupo');
        }
      }
    });
  }

  async stop(): Promise<void> {
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
    this.shouldDisplayQR = false; // Resetear flag al detener
    this.connectionCallbacks.clear();
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  onConnected(callback: () => void): void {
    if (this.connectionState === 'connected') {
      callback();
    } else {
      this.connectionCallbacks.add(callback);
    }
  }

  onMessage(callback: (message: Message) => void): void {
    this.messageCallbacks.add(callback);
  }

  async listGroups(): Promise<Group[]> {
    if (!this.socket || !this.isConnected()) {
      throw new Error('No hay conexión activa');
    }

    const groups = await this.socket.groupFetchAllParticipating();
    const groupList = Object.values(groups);
    
    return groupList.map(group => ({
      name: group.subject || 'Sin nombre',
      jid: group.id,
      participants: group.participants?.length,
    }));
  }

  private extractMessageContent(message: proto.IWebMessageInfo): string {
    const msg = message.message;
    if (!msg) return '';

    if (msg.conversation) {
      return msg.conversation;
    }

    if (msg.extendedTextMessage?.text) {
      return msg.extendedTextMessage.text;
    }

    if (msg.imageMessage?.caption) {
      return `[Imagen] ${msg.imageMessage.caption}`;
    }

    if (msg.videoMessage?.caption) {
      return `[Video] ${msg.videoMessage.caption}`;
    }

    if (msg.audioMessage) {
      return '[Audio]';
    }

    if (msg.documentMessage) {
      const docName = msg.documentMessage.fileName || 'Documento sin nombre';
      return `[Documento] ${docName}`;
    }

    if (msg.stickerMessage) {
      return '[Sticker]';
    }

    if (msg.locationMessage) {
      return '[Ubicación]';
    }

    if (msg.contactMessage) {
      return '[Contacto]';
    }

    return '[Mensaje no soportado]';
  }

  private getSenderName(
    message: proto.IWebMessageInfo,
    groupMetadata: any,
    senderJid: string
  ): string {
    const pushName = message.pushName;
    if (pushName) {
      return pushName;
    }

    if (groupMetadata?.participants) {
      const participant = groupMetadata.participants.find(
        (p: any) => p.id === senderJid
      );
      if (participant?.name) {
        return participant.name;
      }
    }

    return senderJid?.split('@')[0] || 'Desconocido';
  }
}

