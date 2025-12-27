// W2M - Ingestor Interface
// Interfaz abstracta para implementaciones de ingestor

export interface Message {
  group: string;
  sender: string;
  time: string;
  content: string;
}

export interface Group {
  name: string;
  jid?: string;
  participants?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface IngestorInterface {
  /**
   * Inicializar el ingestor
   */
  initialize(): Promise<void>;

  /**
   * Iniciar conexión
   */
  start(): Promise<void>;

  /**
   * Detener conexión
   */
  stop(): Promise<void>;

  /**
   * Generar código QR para conectar
   */
  generateQR(): Promise<void>;

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean;

  /**
   * Obtener estado de conexión
   */
  getConnectionState(): ConnectionState;

  /**
   * Registrar callback para cuando se conecte
   */
  onConnected(callback: () => void): void;

  /**
   * Registrar callback para cuando se reciba un mensaje
   */
  onMessage(callback: (message: Message) => void): void;

  /**
   * Listar grupos disponibles
   */
  listGroups(): Promise<Group[]>;
}

/**
 * Interfaz para plugins de ingestor
 * Los plugins deben implementar IngestorInterface
 */
export interface IngestorPlugin {
  createIngestor(groupManager?: any): IngestorInterface;
}

