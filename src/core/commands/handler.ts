// W2M - Command Handler
// Sistema modular de comandos que puede ser usado por CLI o WhatsApp

import { IngestorInterface } from '../ingestor/interface.js';
import { GroupManager } from '../groups/index.js';
import { CategoryManager } from '../categories/index.js';
import { logger } from '../../utils/logger.js';

export interface CommandContext {
  ingestor: IngestorInterface;
  groupManager: GroupManager;
  categoryManager: CategoryManager;
  sender?: string;
  groupName?: string;
  sendResponse?: (text: string) => Promise<void>;
}

export interface CommandResponse {
  text: string;
  requiresInput?: boolean;
  nextCommand?: string;
}

export class CommandHandler {
  private context: CommandContext;
  private commandState: Map<string, any> = new Map(); // Estado por usuario/grupo

  constructor(context: CommandContext) {
    this.context = context;
  }

  /**
   * Verificar si hay un estado pendiente para un usuario
   */
  hasPendingState(userId: string): boolean {
    const state = this.commandState.get(userId);
    return state && state.waitingForInput === true;
  }

  /**
   * Procesar comando y generar respuesta
   */
  async processCommand(command: string, userId: string = 'default'): Promise<CommandResponse | null> {
    const trimmed = command.trim().toLowerCase();
    
    // Detectar comando "menu,," o "menu" o ",,menu" (por compatibilidad)
    if (trimmed === 'menu,,' || trimmed === 'menu' || trimmed === ',,menu') {
      return this.showMainMenu(userId);
    }

    // Verificar si hay un comando pendiente (estado)
    const state = this.commandState.get(userId);
    if (state && state.waitingForInput) {
      if (state.currentMenu === 'main') {
        // Procesar comando del menú principal
        return await this.handleMainMenuCommand(trimmed, userId);
      }
      return await this.handleInput(command, state, userId);
    }

    // Si no hay estado pendiente y no es "menu", retornar null
    // para que el mensaje se procese normalmente (categorización)
    return null;
  }

  /**
   * Mostrar menú principal
   */
  private showMainMenu(userId: string = 'default'): CommandResponse {
    const isConnected = this.context.ingestor.isConnected();
    const groups = this.context.groupManager.getAllGroups();
    const categories = this.context.categoryManager.getAllCategories();
    
    const status = isConnected ? '✅ Conectado' : '❌ Desconectado';
    
    const menu = `📱 *W2M - WhatsApp to Markdown* [${status}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Opciones:*

1️⃣ QR - Generar código QR
2️⃣ Estado - Ver estado de conexión
3️⃣ Desconectar - Desconectar del servicio
4️⃣ Grupos (${groups.length}) - Gestionar grupos
5️⃣ Categorías (${categories.length}) - Gestionar categorías
6️⃣ Salir - Cerrar menú

_Escribe el número o el nombre del comando_`;

    // Establecer estado pendiente para permitir comandos del menú principal
    this.commandState.set(userId, {
      waitingForInput: true,
      currentMenu: 'main',
      step: 'selectOption'
    });

    return { text: menu, requiresInput: true };
  }

  /**
   * Manejar comandos del menú principal
   */
  private async handleMainMenuCommand(command: string, userId: string): Promise<CommandResponse> {
    switch (command) {
      case '1':
      case 'qr':
        this.clearState(userId);
        return await this.handleQR();
      case '2':
      case 'estado':
      case 'status':
        // Mantener estado para poder ejecutar más comandos
        return this.handleStatus();
      case '3':
      case 'desconectar':
      case 'disconnect':
        this.clearState(userId);
        return await this.handleDisconnect();
      case '4':
      case 'grupos':
      case 'groups':
        return this.handleGroupsMenu(userId);
      case '5':
      case 'categorias':
      case 'categories':
        return this.handleCategoriesMenu(userId);
      case '6':
      case 'salir':
      case 'exit':
        this.clearState(userId);
        return { text: '👋 ¡Hasta luego!' };
      default:
        // Si el comando no es reconocido, mantener el menú y mostrar error
        return { text: '❌ Opción inválida. Escribe un número del 1 al 6 o el nombre del comando.', requiresInput: true };
    }
  }

  /**
   * Manejar generación de QR
   */
  private async handleQR(): Promise<CommandResponse> {
    if (this.context.ingestor.isConnected()) {
      return { text: '⚠️ Ya estás conectado. Desconecta primero si quieres generar un nuevo QR.\n\n_Escribe "menu" para volver al menú principal_' };
    }

    try {
      await this.context.ingestor.generateQR();
      return { text: '🔄 Generando código QR... Revisa el dashboard web o la consola para verlo.\n\n_Escribe "menu" para volver al menú principal_' };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error al generar QR desde comando');
      return { text: '❌ Error al generar QR. Intenta de nuevo.\n\n_Escribe "menu" para volver al menú principal_' };
    }
  }

  /**
   * Manejar estado
   */
  private handleStatus(): CommandResponse {
    const isConnected = this.context.ingestor.isConnected();
    const state = this.context.ingestor.getConnectionState();
    const groups = this.context.groupManager.getAllGroups();
    const categories = this.context.categoryManager.getAllCategories();
    
    const statusText = isConnected ? '✅ Conectado' : '❌ Desconectado';
    const stateText = state === 'connected' ? 'Conectado' : state === 'connecting' ? 'Conectando...' : 'Desconectado';
    
    return {
      text: `📊 *Estado de Conexión*

Estado: ${statusText}
Detalle: ${stateText}
Grupos monitoreados: ${groups.length}
Categorías: ${categories.length}

_Escribe otro comando del menú (1-6) o "menu" para volver al menú principal_`,
      requiresInput: true
    };
  }

  /**
   * Manejar desconexión
   */
  private async handleDisconnect(): Promise<CommandResponse> {
    if (!this.context.ingestor.isConnected()) {
      return { text: '⚠️ No hay conexión activa.\n\n_Escribe "menu" para volver al menú principal_' };
    }

    try {
      await this.context.ingestor.stop();
      return { text: '✅ Desconectado exitosamente.\n\n_Escribe "menu" para volver al menú principal_' };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error al desconectar desde comando');
      return { text: '❌ Error al desconectar.\n\n_Escribe "menu" para volver al menú principal_' };
    }
  }

  /**
   * Mostrar menú de grupos
   */
  private handleGroupsMenu(userId: string = 'default'): CommandResponse {
    const monitoredGroups = this.context.groupManager.getAllGroups();
    
    let groupsText = '';
    if (monitoredGroups.length === 0) {
      groupsText = '⚪ No hay grupos monitoreados.';
    } else {
      groupsText = '*Grupos monitoreados:*\n';
      monitoredGroups.forEach((group, index) => {
        groupsText += `${index + 1}. ${group.name}\n`;
      });
    }
    
    const menu = `📋 *Gestión de Grupos*

${groupsText}

*Opciones:*
1️⃣ Listar y agregar grupo
2️⃣ Remover grupo
3️⃣ Volver al menú principal

_Escribe el número de la opción_`;

    // Guardar estado para esperar input
    this.commandState.set(userId, {
      waitingForInput: true,
      currentMenu: 'groups',
      step: 'selectOption'
    });

    return { text: menu, requiresInput: true, nextCommand: 'groups' };
  }

  /**
   * Mostrar menú de categorías
   */
  private handleCategoriesMenu(userId: string = 'default'): CommandResponse {
    const categories = this.context.categoryManager.getAllCategories();
    
    let categoriesText = '';
    if (categories.length === 0) {
      categoriesText = '⚪ No hay categorías configuradas.';
    } else {
      categoriesText = '*Categorías:*\n';
      categories.forEach((category, index) => {
        categoriesText += `${index + 1}. ${category.name}${category.description ? ` - ${category.description}` : ''}\n`;
      });
    }
    
    const menu = `📁 *Gestión de Categorías*

${categoriesText}

*Opciones:*
1️⃣ Crear categoría
2️⃣ Eliminar categoría
3️⃣ Configurar campos
4️⃣ Configurar separador
5️⃣ Volver al menú principal

_Escribe el número de la opción_`;

    // Guardar estado para esperar input
    this.commandState.set(userId, {
      waitingForInput: true,
      currentMenu: 'categories',
      step: 'selectOption'
    });

    return { text: menu, requiresInput: true, nextCommand: 'categories' };
  }

  /**
   * Manejar input en submenús
   */
  private async handleInput(input: string, state: any, userId: string): Promise<CommandResponse | null> {
    if (state.currentMenu === 'groups') {
      return await this.handleGroupsInput(input, state, userId);
    } else if (state.currentMenu === 'categories') {
      return await this.handleCategoriesInput(input, state, userId);
    }
    
    // Limpiar estado si no se reconoce
    this.commandState.delete(userId);
    return { text: '❌ Opción inválida. Escribe "menu" para volver al menú principal.' };
  }

  /**
   * Manejar input en menú de grupos
   */
  private async handleGroupsInput(input: string, state: any, userId: string): Promise<CommandResponse> {
    if (input === '3' || input.toLowerCase() === 'volver') {
      this.commandState.delete(userId);
      return this.showMainMenu();
    }

    if (input === '1') {
      // Listar grupos disponibles
      try {
        if (!this.context.ingestor.isConnected()) {
          this.commandState.delete(userId);
          return { text: '⚠️ No estás conectado. Conecta primero.' };
        }

        const groups = await this.context.ingestor.listGroups();
        const monitoredGroups = this.context.groupManager.getAllGroups();
        const monitoredNames = new Set(monitoredGroups.map(g => g.name.toLowerCase()));

        let groupsText = '*Grupos Disponibles:*\n\n';
        groups.forEach((group, index) => {
          const isMonitored = monitoredNames.has(group.name.toLowerCase());
          const status = isMonitored ? '✅ Monitoreado' : '⚪ No monitoreado';
          groupsText += `${index + 1}. ${group.name} ${status}\n`;
          if (group.participants) {
            groupsText += `   👥 ${group.participants} participantes\n`;
          }
          groupsText += '\n';
        });

        groupsText += '_Escribe el número del grupo a agregar (o "cancelar" para volver)_';

        this.commandState.set(userId, {
          waitingForInput: true,
          currentMenu: 'groups',
          step: 'selectGroup',
          availableGroups: groups
        });

        return { text: groupsText, requiresInput: true };
      } catch (error: any) {
        this.commandState.delete(userId);
        logger.error({ error: error.message }, 'Error al listar grupos desde comando');
        return { text: '❌ Error al obtener grupos. Verifica tu conexión.' };
      }
    }

    if (input === '2') {
      // Remover grupo
      const monitoredGroups = this.context.groupManager.getAllGroups();
      
      if (monitoredGroups.length === 0) {
        this.commandState.delete(userId);
        return { text: '⚪ No hay grupos monitoreados para remover.' };
      }

      let groupsText = '*Grupos Monitoreados:*\n\n';
      monitoredGroups.forEach((group, index) => {
        groupsText += `${index + 1}. ${group.name}\n`;
      });
      groupsText += '\n_Escribe el número del grupo a remover (o "cancelar" para volver)_';

      this.commandState.set(userId, {
        waitingForInput: true,
        currentMenu: 'groups',
        step: 'removeGroup',
        monitoredGroups: monitoredGroups
      });

      return { text: groupsText, requiresInput: true };
    }

    // Si está en paso de seleccionar grupo para agregar
    if (state.step === 'selectGroup' && state.availableGroups) {
      if (input.toLowerCase() === 'cancelar' || input.toLowerCase() === 'menu') {
        return this.handleGroupsMenu(userId);
      }

      const groupIndex = parseInt(input, 10) - 1;
      if (isNaN(groupIndex) || groupIndex < 0 || groupIndex >= state.availableGroups.length) {
        return { text: '❌ Número inválido. Escribe un número de la lista o "cancelar".', requiresInput: true };
      }

      const selectedGroup = state.availableGroups[groupIndex];
      const monitoredGroups = this.context.groupManager.getAllGroups();
      const monitoredNames = new Set(monitoredGroups.map(g => g.name.toLowerCase()));

      if (monitoredNames.has(selectedGroup.name.toLowerCase())) {
        this.commandState.delete(userId);
        return { text: `⚠️ El grupo "${selectedGroup.name}" ya está siendo monitoreado.` };
      }

      await this.context.groupManager.addGroup(selectedGroup.name, selectedGroup.jid);
      this.commandState.delete(userId);
      return { text: `✅ Grupo "${selectedGroup.name}" agregado a monitoreo.` };
    }

    // Si está en paso de remover grupo
    if (state.step === 'removeGroup' && state.monitoredGroups) {
      if (input.toLowerCase() === 'cancelar' || input.toLowerCase() === 'menu') {
        return this.handleGroupsMenu(userId);
      }

      const groupIndex = parseInt(input, 10) - 1;
      if (isNaN(groupIndex) || groupIndex < 0 || groupIndex >= state.monitoredGroups.length) {
        return { text: '❌ Número inválido. Escribe un número de la lista o "cancelar".', requiresInput: true };
      }

      const selectedGroup = state.monitoredGroups[groupIndex];
      await this.context.groupManager.removeGroup(selectedGroup.name);
      this.commandState.delete(userId);
      return { text: `✅ Grupo "${selectedGroup.name}" removido de monitoreo.` };
    }

    this.commandState.delete(userId);
    return { text: '❌ Opción inválida. Escribe "menu" para volver al menú principal.' };
  }

  /**
   * Manejar input en menú de categorías
   */
  private async handleCategoriesInput(input: string, state: any, userId: string): Promise<CommandResponse> {
      if (input === '5' || input.toLowerCase() === 'volver' || input.toLowerCase() === 'menu') {
        return this.showMainMenu(userId);
      }

    // Implementación simplificada - solo mostrar mensaje por ahora
    // Se puede expandir después
    if (['1', '2', '3', '4'].includes(input)) {
      this.commandState.delete(userId);
      return { text: '⚠️ Esta funcionalidad requiere interacción más compleja. Usa el CLI o el dashboard web para gestionar categorías.' };
    }

    this.commandState.delete(userId);
    return { text: '❌ Opción inválida. Escribe "menu" para volver al menú principal.' };
  }

  /**
   * Limpiar estado de un usuario
   */
  clearState(userId: string = 'default'): void {
    this.commandState.delete(userId);
  }
}

