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
    });
  }

  start(): void {
    this.showMenu();
    this.setupInputHandler();
  }

  private showMenu(): void {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📱 W2M - WhatsApp to Markdown');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Opciones disponibles:');
    console.log('  1 - Generar código QR para conectar WhatsApp');
    console.log('  2 - Ver estado de conexión');
    console.log('  3 - Desconectar WhatsApp');
    console.log('  4 - Salir');
    console.log('');
    this.prompt();
  }

  private prompt(): void {
    const status = this.ingestor.isConnected() ? '✅ Conectado' : '❌ Desconectado';
    this.rl.question(`[${status}] Selecciona una opción (1-4): `, (answer) => {
      this.handleInput(answer.trim());
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
        this.exit();
        break;
      default:
        console.log('❌ Opción inválida. Por favor selecciona 1-4.\n');
        this.prompt();
    }
  }

  private async generateQR(): Promise<void> {
    console.log('\n🔄 Generando código QR...\n');
    
    if (this.ingestor.isConnected()) {
      console.log('⚠️  Ya estás conectado a WhatsApp. Desconecta primero si quieres generar un nuevo QR.\n');
      this.prompt();
      return;
    }

    try {
      await this.ingestor.generateQR();
      console.log('\n✅ QR generado. Escanea el código con WhatsApp.\n');
      // Esperar un poco antes de volver al menú
      setTimeout(() => {
        this.prompt();
      }, 2000);
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

