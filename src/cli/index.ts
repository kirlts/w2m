// W2M - CLI Interactivo
import readline from 'readline';
import { IngestorInterface } from '../core/ingestor/interface.js';
import { GroupManager } from '../core/groups/index.js';
import { CategoryManager, CategoryField } from '../core/categories/index.js';
import { CategoryWriter } from '../core/categories/writer.js';
import { StorageInterface } from '../core/storage/interface.js';
import { logger } from '../utils/logger.js';
import { broadcastSSE } from '../web/sse.js';

export class W2MCLI {
  private rl: readline.Interface;
  private ingestor: IngestorInterface;
  private groupManager: GroupManager;
  private categoryManager: CategoryManager;
  private categoryWriter: CategoryWriter;
  private isInSubMenu: boolean = false; // Flag para indicar si estamos en un submenú

  constructor(ingestor: IngestorInterface, groupManager: GroupManager, categoryManager: CategoryManager, storage: StorageInterface) {
    this.ingestor = ingestor;
    this.groupManager = groupManager;
    this.categoryManager = categoryManager;
    this.categoryWriter = new CategoryWriter(categoryManager, storage);
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
    
    // Registrar callback para cuando se conecte (mostrar menú por primera vez o actualizar)
    let menuShown = false;
    
    const showMenuOnce = () => {
      if (!menuShown) {
        this.showMenu();
        this.prompt();
        menuShown = true;
      }
    };
    
    this.ingestor.onConnected(() => {
      setTimeout(() => {
        if (!menuShown) {
          // Primera vez - mostrar menú con estado conectado
          showMenuOnce();
        } else {
          // Ya estaba mostrado - solo actualizar
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
          this.showMenu();
          this.prompt();
        }
      }, 300);
    });
    
    // Verificar estado después de un delay razonable
    // Si ya está conectado, mostrar inmediatamente. Si no, esperar conexión o timeout
    setTimeout(() => {
      if (this.ingestor.isConnected() && !menuShown) {
        // Ya está conectado - mostrar menú con estado correcto
        showMenuOnce();
      } else if (!menuShown) {
        // No está conectado todavía - esperar un poco más o mostrar menú con "Desconectado"
        // Dar tiempo para que la conexión automática se complete
        setTimeout(() => {
          if (!menuShown) {
            // Si después de 2 segundos aún no se ha conectado, mostrar menú con estado "Desconectado"
            showMenuOnce();
          }
        }, 2000);
      }
    }, 800);
  }

  /**
   * Configurar handler para mostrar mensajes inmediatamente
   */
  private setupMessageHandler(): void {
    this.ingestor.onMessage(async (message) => {
      // Procesar categorías automáticamente
      await this.categoryWriter.processMessage(message);
      // Mostrar mensaje en consola
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
      
      // Enviar mensaje al SSE para el dashboard (solo via broadcastSSE, no logger para evitar duplicados)
      try {
        broadcastSSE('message', {
          group: message.group,
          sender: message.sender,
          time: message.time,
          content: message.content,
          timestamp: new Date().toISOString()
        });
      } catch (sseError) {
        // Ignorar errores de SSE
      }
      
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
    const groupCount = this.groupManager.getAllGroups().length;
    const categoryCount = this.categoryManager.getAllCategories().length;
    console.log(`\n📱 W2M - WhatsApp to Markdown [${status}]`);
    console.log('─────────────────────────────────────────────────────');
    console.log(`1) QR  |  2) Estado  |  3) Desconectar  |  4) Grupos (${groupCount})  |  5) Categorías (${categoryCount})  |  6) Salir`);
    console.log('─────────────────────────────────────────────────────');
  }

  private prompt(): void {
    // Solo procesar entrada si no estamos en un submenú
    if (this.isInSubMenu) {
      return;
    }
    
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
        this.manageCategories();
        break;
      case '6':
        this.exit();
        break;
      default:
        console.log('❌ Opción inválida. Por favor selecciona 1-6.\n');
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
    this.isInSubMenu = true;
    
    const monitoredGroups = this.groupManager.getAllGroups();
    
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
    console.log('  1) Listar grupos disponibles y agregar');
    console.log('  2) Remover grupo monitoreado');
    console.log('  3) Volver al menú principal\n');
    
    this.rl.question('Selecciona una opción (1-3): ', async (answer) => {
      const trimmed = answer.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (trimmed === '1') {
        await this.addGroup();
      } else if (trimmed === '2') {
        await this.removeGroup();
      } else if (trimmed === '3') {
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      } else {
        console.log('❌ Opción inválida. Por favor selecciona 1-3.\n');
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }
    });
  }

  private async addGroup(): Promise<void> {
    try {
      const groups = await this.ingestor.listGroups();
      
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('📱 Grupos Disponibles:');
      console.log('═══════════════════════════════════════════════════════\n');

      const monitoredGroups = this.groupManager.getAllGroups();
      const monitoredNames = new Set(monitoredGroups.map(g => g.name.toLowerCase()));

      groups.forEach((group, index) => {
        const isMonitored = monitoredNames.has(group.name.toLowerCase());
        const status = isMonitored ? '✅ Monitoreado' : '⚪ No monitoreado';
        console.log(`${index + 1}. ${group.name} ${status}`);
        if (group.participants) {
          console.log(`   👥 ${group.participants} participantes\n`);
        }
      });

      console.log('═══════════════════════════════════════════════════════\n');
      
      this.rl.question('\nSelecciona el número del grupo a agregar (o Enter para cancelar): ', async (answer) => {
        const trimmed = answer.trim();
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        
        if (!trimmed) {
          this.showMenu();
          this.prompt();
          return;
        }

        const groupIndex = parseInt(trimmed, 10) - 1;
        
        if (isNaN(groupIndex) || groupIndex < 0 || groupIndex >= groups.length) {
          console.log('❌ Número inválido. Por favor selecciona un número de la lista.\n');
          this.showMenu();
          this.prompt();
          return;
        }

        const selectedGroup = groups[groupIndex];
        if (!selectedGroup) {
          console.log('❌ Grupo no encontrado.\n');
          this.showMenu();
          this.prompt();
          return;
        }
        const groupName = selectedGroup.name;
        
        // Verificar si ya está monitoreado
        if (monitoredNames.has(groupName.toLowerCase())) {
          console.log(`⚠️  El grupo "${groupName}" ya está siendo monitoreado.\n`);
          this.showMenu();
          this.prompt();
          return;
        }

        const added = await this.groupManager.addGroup(groupName, selectedGroup.jid);
        
        if (added) {
          console.log(`✅ Grupo "${groupName}" agregado a monitoreo.\n`);
        }
        
        this.showMenu();
        this.prompt();
      });
    } catch (error) {
      console.log('\n⚠️  No estás conectado. Conecta primero con la opción 1.\n');
      this.isInSubMenu = false;
      this.showMenu();
      this.prompt();
      return;
    }
  }

  private async removeGroup(): Promise<void> {
    const monitoredGroups = this.groupManager.getAllGroups();
    
    if (monitoredGroups.length === 0) {
      console.log('⚪ No hay grupos monitoreados para remover.\n');
      this.showMenu();
      this.prompt();
      return;
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 Grupos Monitoreados:');
    console.log('═══════════════════════════════════════════════════════\n');
    monitoredGroups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name}`);
    });
    console.log('');

    this.rl.question('Selecciona el número del grupo a remover (o Enter para cancelar): ', async (answer) => {
      const trimmed = answer.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (!trimmed) {
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }

      const groupIndex = parseInt(trimmed, 10) - 1;
      
      if (isNaN(groupIndex) || groupIndex < 0 || groupIndex >= monitoredGroups.length) {
        console.log('❌ Número inválido. Por favor selecciona un número de la lista.\n');
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }

      const selectedGroup = monitoredGroups[groupIndex];
      if (!selectedGroup) {
        console.log('❌ Grupo no encontrado.\n');
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }
      const groupName = selectedGroup.name;

      const removed = await this.groupManager.removeGroup(groupName);
      
      if (removed) {
        console.log(`✅ Grupo "${groupName}" removido de monitoreo.\n`);
      } else {
        console.log(`❌ Error al remover el grupo "${groupName}".\n`);
      }
      
      this.isInSubMenu = false;
      this.showMenu();
      this.prompt();
    });
  }

  private async manageCategories(): Promise<void> {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
    this.isInSubMenu = true;
    
    const categories = this.categoryManager.getAllCategories();
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📁 Gestión de Categorías');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (categories.length === 0) {
      console.log('⚪ No hay categorías configuradas.\n');
    } else {
      console.log('Categorías:');
      categories.forEach((category, index) => {
        console.log(`${index + 1}. ${category.name}${category.description ? ` - ${category.description}` : ''}`);
        console.log(`   Campos: ${category.enabledFields.join(', ')}\n`);
      });
    }
    
    console.log('Opciones:');
    console.log('  1) Crear categoría');
    console.log('  2) Eliminar categoría');
    console.log('  3) Configurar campos de categoría');
    console.log('  4) Volver al menú principal\n');
    
    this.rl.question('Selecciona una opción (1-4): ', async (answer) => {
      const trimmed = answer.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (trimmed === '1') {
        await this.createCategory();
      } else if (trimmed === '2') {
        await this.removeCategory();
      } else if (trimmed === '3') {
        await this.configureCategoryFields();
      } else if (trimmed === '4') {
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      } else {
        console.log('❌ Opción inválida. Por favor selecciona 1-4.\n');
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }
    });
  }

  private async createCategory(): Promise<void> {
    this.rl.question('\nNombre de la categoría (ej: CODIGO): ', async (name) => {
      const trimmedName = name.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (!trimmedName) {
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }

      // Validar formato de nombre (solo letras, números, guiones, guiones bajos)
      if (!/^[A-Za-z0-9_-]+$/.test(trimmedName)) {
        console.log('❌ El nombre solo puede contener letras, números, guiones y guiones bajos.\n');
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }

      // Seleccionar campos
      const allFields: CategoryField[] = ['AUTOR', 'HORA', 'FECHA', 'CONTENIDO'];
      console.log('\nCampos disponibles:');
      allFields.forEach((field, index) => {
        console.log(`${index + 1}. ${field}`);
      });
      console.log('');

      this.rl.question('Ingresa los números de los campos a habilitar separados por comas (1=AUTOR, 2=HORA, 3=FECHA, 4=CONTENIDO): ', async (fieldsAnswer) => {
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        
        const fieldNumbers = fieldsAnswer.split(',').map(n => parseInt(n.trim(), 10) - 1).filter(n => !isNaN(n) && n >= 0 && n < allFields.length);
        
        if (fieldNumbers.length === 0) {
          console.log('❌ Debes seleccionar al menos un campo válido.\n');
          this.showMenu();
          this.prompt();
          return;
        }

        const selectedFields = fieldNumbers.map(n => allFields[n]).filter((f): f is CategoryField => f !== undefined);
        
        // CONTENIDO siempre debe estar
        if (!selectedFields.includes('CONTENIDO')) {
          selectedFields.push('CONTENIDO');
        }

        // Separador (default: ",,")
        this.rl.question('Separador (1-3 caracteres, Enter para usar ",,"): ', async (separatorAnswer) => {
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
          let separator = separatorAnswer.trim() || ',,';
          
          if (separator.length < 1 || separator.length > 3) {
            console.log('⚠️  Separador inválido. Usando ",," por defecto.');
            separator = ',,';
          }

          // Descripción (opcional)
          this.rl.question('Descripción (opcional, Enter para omitir): ', async (description) => {
            process.stdout.write('\r' + ' '.repeat(80) + '\r');
            const trimmedDesc = description.trim() || undefined;
            
            const added = await this.categoryManager.addCategory(trimmedName, trimmedDesc, selectedFields, separator);
            
            if (added) {
              console.log(`✅ Categoría "${trimmedName}" creada exitosamente (separador: "${separator}").\n`);
            } else {
              console.log(`⚠️  La categoría "${trimmedName}" ya existe.\n`);
            }
            
            this.isInSubMenu = false;
            this.showMenu();
            this.prompt();
          });
        });
      });
    });
  }

  private async removeCategory(): Promise<void> {
    const categories = this.categoryManager.getAllCategories();
    
    if (categories.length === 0) {
      console.log('⚪ No hay categorías para eliminar.\n');
      this.isInSubMenu = false;
      this.showMenu();
      this.prompt();
      return;
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 Categorías Disponibles:');
    console.log('═══════════════════════════════════════════════════════\n');
    categories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name}${category.description ? ` - ${category.description}` : ''}`);
    });
    console.log('');

    this.rl.question('Selecciona el número de la categoría a eliminar (o Enter para cancelar): ', async (answer) => {
      const trimmed = answer.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (!trimmed) {
        this.showMenu();
        this.prompt();
        return;
      }

      const categoryIndex = parseInt(trimmed, 10) - 1;
      
      if (isNaN(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
        console.log('❌ Número inválido. Por favor selecciona un número de la lista.\n');
        this.showMenu();
        this.prompt();
        return;
      }

      const selectedCategory = categories[categoryIndex];
      if (!selectedCategory) {
        console.log('❌ Categoría no encontrada.\n');
        this.showMenu();
        this.prompt();
        return;
      }
      const categoryName = selectedCategory.name;

      // Preguntar si también quiere eliminar el archivo markdown
      this.rl.question('¿Deseas eliminar también el archivo markdown asociado? (s/n): ', async (deleteFileAnswer) => {
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        const deleteFile = deleteFileAnswer.trim().toLowerCase() === 's' || deleteFileAnswer.trim().toLowerCase() === 'si';

        const removed = await this.categoryManager.removeCategory(categoryName);
        
        if (!removed) {
          console.log(`❌ Error al eliminar la categoría "${categoryName}".\n`);
          this.isInSubMenu = false;
          this.showMenu();
          this.prompt();
          return;
        }

        console.log(`✅ Categoría "${categoryName}" eliminada exitosamente.`);

        if (deleteFile) {
          const fileDeleted = await this.categoryManager.deleteCategoryMarkdown(categoryName);
          if (fileDeleted) {
            console.log(`✅ Archivo markdown de la categoría "${categoryName}" también fue eliminado.\n`);
          } else {
            console.log(`⚠️  No se pudo eliminar el archivo markdown (puede que no exista).\n`);
          }
        } else {
          console.log(`ℹ️  El archivo markdown se mantiene en el sistema.\n`);
        }
        
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
      });
    });
  }

  private async configureCategoryFields(): Promise<void> {
    const categories = this.categoryManager.getAllCategories();
    
    if (categories.length === 0) {
      console.log('⚪ No hay categorías para configurar.\n');
      this.isInSubMenu = false;
      this.showMenu();
      this.prompt();
      return;
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 Categorías Disponibles:');
    console.log('═══════════════════════════════════════════════════════\n');
    categories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name}${category.description ? ` - ${category.description}` : ''}`);
      console.log(`   Campos: ${category.enabledFields.join(', ')} | Separador: "${category.separator || ',,'}"\n`);
    });
    console.log('');

    this.rl.question('Selecciona el número de la categoría a configurar (o Enter para cancelar): ', async (answer) => {
      const trimmed = answer.trim();
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      
      if (!trimmed) {
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }

      const categoryIndex = parseInt(trimmed, 10) - 1;
      
      if (isNaN(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
        console.log('❌ Número inválido. Por favor selecciona un número de la lista.\n');
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }

      const selectedCategory = categories[categoryIndex];
      if (!selectedCategory) {
        console.log('❌ Categoría no encontrada.\n');
        this.isInSubMenu = false;
        this.showMenu();
        this.prompt();
        return;
      }
      const allFields: CategoryField[] = ['AUTOR', 'HORA', 'FECHA', 'CONTENIDO'];
      
      console.log('\nCampos disponibles:');
      allFields.forEach((field, index) => {
        const enabled = selectedCategory.enabledFields.includes(field);
        console.log(`${index + 1}. ${field} ${enabled ? '✅' : '⚪'}`);
      });
      console.log('');

      this.rl.question('Ingresa los números de los campos a habilitar separados por comas (1=AUTOR, 2=HORA, 3=FECHA, 4=CONTENIDO): ', async (fieldsAnswer) => {
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        
        const fieldNumbers = fieldsAnswer.split(',').map(n => parseInt(n.trim(), 10) - 1).filter(n => !isNaN(n) && n >= 0 && n < allFields.length);
        
        if (fieldNumbers.length === 0) {
          console.log('❌ Debes seleccionar al menos un campo válido.\n');
          this.isInSubMenu = false;
          this.showMenu();
          this.prompt();
          return;
        }

        const selectedFields = fieldNumbers.map(n => allFields[n]).filter((f): f is CategoryField => f !== undefined);
        
        // CONTENIDO siempre debe estar
        if (!selectedFields.includes('CONTENIDO')) {
          selectedFields.push('CONTENIDO');
        }

        // Separador
        console.log(`\nSeparador actual: "${selectedCategory.separator || ',,'}"`);
        this.rl.question('Nuevo separador (1-3 caracteres, Enter para mantener actual): ', async (separatorAnswer) => {
          process.stdout.write('\r' + ' '.repeat(80) + '\r');
          let separator = separatorAnswer.trim();
          
          if (separator && (separator.length < 1 || separator.length > 3)) {
            console.log('⚠️  Separador inválido. Manteniendo el actual.');
            separator = '';
          }

          const updates: { enabledFields: CategoryField[]; separator?: string } = {
            enabledFields: selectedFields,
          };
          
          if (separator) {
            updates.separator = separator;
          }

          const updated = await this.categoryManager.updateCategory(selectedCategory.name, updates);
          
          if (updated) {
            console.log(`✅ Categoría "${selectedCategory.name}" actualizada.\n`);
          } else {
            console.log(`❌ Error al actualizar la categoría.\n`);
          }
          
          this.isInSubMenu = false;
          this.showMenu();
          this.prompt();
        });
      });
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

