// W2M - CLI Interactivo
import readline from 'readline';
import { WhatsAppIngestor } from '../core/ingestor/index.js';
import { logger } from '../utils/logger.js';

export class W2MCLI {
  private rl: readline.Interface;
  private ingestor: WhatsAppIngestor;

  constructor(ingestor: WhatsAppIngestor) {
    this.ingestor = ingestor;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      removeHistoryDuplicates: true,
      historySize: 0, // Deshabilitar historial para evitar problemas
    });
  }

  start(): void {
    this.setupMessageHandler();
    this.setupInputHandler();
    
    // Mostrar menú inicial después de un pequeño delay
    setTimeout(() => {
      this.showMenu();
      this.prompt();
    }, 300);
    
    // Registrar callback para cuando se conecte (actualizar menú)
    this.ingestor.onConnected(() => {
      setTimeout(() => {
        // Limpiar y actualizar menú con nuevo estado
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        this.showMenu();
        this.prompt();
      }, 300);
    });
  }

  /**
   * Configurar handler para mostrar mensajes del grupo "Pc" inmediatamente
   */
  private setupMessageHandler(): void {
    this.ingestor.onPcGroupMessage((message) => {
      this.displayMessageImmediately(message);
    });
  }

  /**
   * Mostrar mensaje inmediatamente, pausando el readline si es necesario
   */
  private displayMessageImmediately(message: { group: string; sender: string; timestamp: string; content: string }): void {
    try {
      // Pausar readline para poder imprimir sin interferir con el prompt
      this.rl.pause();
      
      // Limpiar la línea actual del prompt
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      // Imprimir el mensaje de forma compacta
      console.log(`\n💬 [${message.group}] ${message.sender}: ${message.content}\n`);
      
      // Reanudar readline y mostrar el prompt de nuevo
      this.rl.resume();
      this.prompt();
    } catch (error) {
      // Intentar restaurar el prompt de todas formas
      try {
        this.rl.resume();
        this.prompt();
      } catch (e) {
        // Ignorar errores de restauración
      }
    }
  }

  private showMenu(): void {
    const status = this.ingestor.isConnected() ? '✅ Conectado' : '❌ Desconectado';
    console.log(`\n📱 W2M - WhatsApp to Markdown [${status}]`);
    console.log('─────────────────────────────────────────────────────');
    console.log('1) QR  |  2) Estado  |  3) Desconectar  |  4) Grupo Pc  |  5) Salir');
    console.log('─────────────────────────────────────────────────────');
  }

  private prompt(): void {
    this.rl.question('> ', (answer) => {
      const trimmed = answer.trim();
      if (trimmed) {
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        this.handleInput(trimmed);
      } else {
        this.prompt();
      }
    });
  }

  private handleInput(input: string): void {
    switch (input) {
      case '1':
        this.generateQR();
        break;
      case '2':
        this.showStatus();
        break;
      case '3':
        this.disconnect();
        break;
      case '4':
        this.checkPcGroup();
        break;
      case '5':
        this.exit();
        break;
      default:
        console.log('❌ Opción inválida. Por favor selecciona 1-5.\n');
        this.prompt();
    }
  }

  private async generateQR(): Promise<void> {
    // Limpiar la línea del prompt (mover cursor al inicio y limpiar)
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    console.log('\n🔄 Generando código QR...\n');
    
    if (this.ingestor.isConnected()) {
      console.log('⚠️  Ya estás conectado a WhatsApp. Desconecta primero si quieres generar un nuevo QR.\n');
      this.prompt();
      return;
    }

    try {
      // El QR se mostrará directamente desde el ingestor
      await this.ingestor.generateQR();
      
      // Usar evento de conexión en lugar de polling
      let qrExpired = false;
      const qrTimeout = setTimeout(() => {
        qrExpired = true;
        if (!this.ingestor.isConnected()) {
          console.log('\n⏱️  El QR expiró. Puedes generar uno nuevo con la opción 1.\n');
          this.prompt();
        }
      }, 70000); // 70 segundos (60s QR + 10s margen)
      
      // Registrar callback para cuando se conecte
      this.ingestor.onConnected(() => {
        if (!qrExpired) {
          clearTimeout(qrTimeout);
          console.log('\n✅ Conectado exitosamente!\n');
          this.prompt();
        }
      });
      
    } catch (error) {
      logger.error({ error }, '❌ Error al generar QR');
      console.log('❌ Error al generar QR. Intenta de nuevo.\n');
      this.prompt();
    }
  }

  private showStatus(): void {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 Estado de Conexión');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Estado: ${this.ingestor.isConnected() ? '✅ Conectado' : '❌ Desconectado'}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    this.prompt();
  }

  private async disconnect(): Promise<void> {
    if (!this.ingestor.isConnected()) {
      console.log('\n⚠️  No hay conexión activa.\n');
      this.prompt();
      return;
    }

    console.log('\n🔄 Desconectando...\n');
    await this.ingestor.stop();
    console.log('✅ Desconectado exitosamente.\n');
    this.prompt();
  }

  private async checkPcGroup(): Promise<void> {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    await this.ingestor.getRecentMessagesFromPcGroup();
    this.prompt();
  }

  private async exit(): Promise<void> {
    console.log('\n🛑 Cerrando W2M...\n');
    await this.ingestor.stop();
    this.rl.close();
    process.exit(0);
  }

  setupInputHandler(): void {
    // Manejar Ctrl+C
    this.rl.on('SIGINT', async () => {
      console.log('\n\n🛑 Interrupción detectada. Cerrando...\n');
      await this.ingestor.stop();
      this.rl.close();
      process.exit(0);
    });
  }
}

