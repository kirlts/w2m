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
    
    // Usar question con mejor manejo del input
    this.rl.question(`[${status}] Selecciona una opción (1-4): `, (answer) => {
      const trimmed = answer.trim();
      if (trimmed) {
        // Limpiar la línea después de recibir la respuesta
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        this.handleInput(trimmed);
      } else {
        // Si no hay input, volver a preguntar
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
        this.exit();
        break;
      default:
        console.log('❌ Opción inválida. Por favor selecciona 1-4.\n');
        this.prompt();
    }
  }

  private async generateQR(): Promise<void> {
    // Limpiar la línea del prompt (mover cursor al inicio y limpiar)
    process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Limpiar línea
    console.log('\n🔄 Generando código QR...\n');
    
    if (this.ingestor.isConnected()) {
      console.log('⚠️  Ya estás conectado a WhatsApp. Desconecta primero si quieres generar un nuevo QR.\n');
      this.prompt();
      return;
    }

    try {
      // El QR se mostrará directamente desde el ingestor
      await this.ingestor.generateQR();
      
      // NO mostrar el prompt automáticamente
      // El prompt se mostrará cuando:
      // 1. La conexión se establezca exitosamente (manejado en connection.update)
      // 2. El usuario presione Enter o escriba algo (manejado por readline)
      // 3. O después de 60 segundos si el QR expira
      
      // Configurar un listener para cuando se conecte
      const checkConnection = setInterval(() => {
        if (this.ingestor.isConnected()) {
          clearInterval(checkConnection);
          console.log('\n✅ Conectado exitosamente!\n');
          this.prompt();
        }
      }, 1000);
      
      // Limpiar el intervalo después de 70 segundos (60s para QR + 10s de margen)
      setTimeout(() => {
        clearInterval(checkConnection);
        if (!this.ingestor.isConnected()) {
          console.log('\n⏱️  El QR expiró. Puedes generar uno nuevo con la opción 1.\n');
          this.prompt();
        }
      }, 70000);
      
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

