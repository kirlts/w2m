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
    this.ingestor.onGroupMessage((message) => {
      this.displayMessageImmediately(message);
    });
  }

  /**
   * Mostrar mensaje inmediatamente, pausando el readline si es necesario
   */
  private displayMessageImmediately(message: { group: string; sender: string; time: string; content: string }): void {
    try {
      // Pausar readline para poder imprimir sin interferir con el prompt
      this.rl.pause();
      
      // Limpiar la línea actual del prompt
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      // Imprimir el mensaje en el formato solicitado
      console.log(`\nGroup: ${message.group}`);
      console.log(`Sender: ${message.sender}`);
      console.log(`Time: ${message.time}`);
      console.log(`Message: ${message.content}\n`);
      
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
    const groupCount = this.ingestor.getGroupManager().getAllGroups().length;
    console.log(`\n📱 W2M - WhatsApp to Markdown [${status}]`);
    console.log('─────────────────────────────────────────────────────');
    console.log(`1) QR  |  2) Estado  |  3) Desconectar  |  4) Grupos (${groupCount})  |  5) Salir`);
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
        this.manageGroups();
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

  private async manageGroups(): Promise<void> {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    
    const groupManager = this.ingestor.getGroupManager();
    const monitoredGroups = groupManager.getAllGroups();
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 Gestión de Grupos Monitoreados');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (monitoredGroups.length === 0) {
      console.log('⚪ No hay grupos monitoreados.\n');
    } else {
      console.log('Grupos monitoreados:');
      monitoredGroups.forEach((group, index) => {
        console.log(`  ${index + 1}. ${group.name}${group.jid ? ` (${group.jid})` : ''}`);
      });
      console.log('');
    }
    
    console.log('Opciones:');
    console.log('  a) Listar grupos disponibles y agregar');
    console.log('  b) Remover grupo monitoreado');
    console.log('  c) Volver al menú principal\n');
    
    this.rl.question('Selecciona una opción (a/b/c): ', async (answer) => {
      const trimmed = answer.trim().toLowerCase();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (trimmed === 'a') {
        await this.addGroup();
      } else if (trimmed === 'b') {
        await this.removeGroup();
      } else if (trimmed === 'c') {
        this.showMenu();
        this.prompt();
        return;
      } else {
        console.log('❌ Opción inválida.\n');
        this.prompt();
        return;
      }
    });
  }

  private async addGroup(): Promise<void> {
    await this.ingestor.listAvailableGroups();
    
    this.rl.question('\nIngresa el nombre exacto del grupo a agregar (o Enter para cancelar): ', async (answer) => {
      const groupName = answer.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (!groupName) {
        this.showMenu();
        this.prompt();
        return;
      }

      const groupManager = this.ingestor.getGroupManager();
      const added = await groupManager.addGroup(groupName);
      
      if (added) {
        console.log(`✅ Grupo "${groupName}" agregado a monitoreo.\n`);
      } else {
        console.log(`⚠️  El grupo "${groupName}" ya está siendo monitoreado.\n`);
      }
      
      this.showMenu();
      this.prompt();
    });
  }

  private async removeGroup(): Promise<void> {
    const groupManager = this.ingestor.getGroupManager();
    const monitoredGroups = groupManager.getAllGroups();
    
    if (monitoredGroups.length === 0) {
      console.log('⚪ No hay grupos monitoreados para remover.\n');
      this.showMenu();
      this.prompt();
      return;
    }

    console.log('\nGrupos monitoreados:');
    monitoredGroups.forEach((group, index) => {
      console.log(`  ${index + 1}. ${group.name}`);
    });
    console.log('');

    this.rl.question('Ingresa el nombre del grupo a remover (o Enter para cancelar): ', async (answer) => {
      const groupName = answer.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (!groupName) {
        this.showMenu();
        this.prompt();
        return;
      }

      const removed = await groupManager.removeGroup(groupName);
      
      if (removed) {
        console.log(`✅ Grupo "${groupName}" removido de monitoreo.\n`);
      } else {
        console.log(`❌ El grupo "${groupName}" no está siendo monitoreado.\n`);
      }
      
      this.showMenu();
      this.prompt();
    });
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

