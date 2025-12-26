// W2M - WhatsApp Ingestor (Baileys)
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { getConfig } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import * as qrcode from 'qrcode-terminal';

export class WhatsAppIngestor {
  private socket: WASocket | null = null;
  private config = getConfig();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;

  async start(): Promise<void> {
    logger.info('🚀 Iniciando WhatsApp Ingestor...');
    
    if (this.isConnecting) {
      logger.warn('⚠️ Ya hay una conexión en progreso');
      return;
    }

    this.isConnecting = true;

    try {
      await this.connect();
    } catch (error) {
      logger.error({ error }, '❌ Error al iniciar ingestor');
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(
      this.config.WA_SESSION_PATH
    );

    this.socket = makeWASocket({
      auth: state,
      logger: logger.child({ component: 'baileys' }),
      getMessage: async () => undefined, // No cachear mensajes
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000, // 60 segundos para escanear QR
    });

    // Guardar credenciales cuando cambien
    this.socket.ev.on('creds.update', saveCreds);

    // Manejar conexión
    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Mostrar QR en consola
        console.log('\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📱 ESCANEA ESTE CÓDIGO QR CON WHATSAPP:');
        console.log('═══════════════════════════════════════════════════════');
        console.log('\n');
        qrcode.generate(qr, { small: true });
        console.log('\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('⏱️  Tienes 60 segundos para escanear el QR');
        console.log('📱 Abre WhatsApp → Configuración → Dispositivos vinculados');
        console.log('═══════════════════════════════════════════════════════');
        console.log('\n');
        
        logger.info('📱 QR code generado y mostrado en consola');
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

        if (shouldReconnect) {
          this.scheduleReconnect();
        } else {
          logger.error('❌ Sesión cerrada. Necesitas escanear el QR de nuevo.');
        }
      } else if (connection === 'open') {
        logger.info('✅ Conectado a WhatsApp exitosamente!');
        this.isConnecting = false;
        this.clearReconnectInterval();
      } else if (connection === 'connecting') {
        logger.info('🔄 Conectando a WhatsApp...');
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

    // Manejar errores (Baileys no tiene evento 'error' directo, se maneja en connection.update)
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      return;
    }

    logger.info(
      { interval: this.config.WA_RECONNECT_INTERVAL },
      `🔄 Reintentando conexión en ${this.config.WA_RECONNECT_INTERVAL / 1000}s...`
    );

    this.reconnectInterval = setTimeout(() => {
      this.reconnectInterval = null;
      this.start();
    }, this.config.WA_RECONNECT_INTERVAL);
  }

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
  }

  isConnected(): boolean {
    return this.socket !== null;
  }
}

