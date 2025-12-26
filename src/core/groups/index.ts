// W2M - Group Management
// Sistema modular para gestionar grupos monitoreados

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger.js';
import { getConfig } from '../../config/index.js';

export interface MonitoredGroup {
  name: string;
  jid?: string; // Se llena automáticamente cuando se encuentra
  addedAt: string;
}

export class GroupManager {
  private config = getConfig();
  private groupsPath: string;
  private groups: Map<string, MonitoredGroup> = new Map();

  constructor() {
    // Usar el directorio de datos para guardar la configuración
    this.groupsPath = join(this.config.WA_SESSION_PATH, '..', 'monitored-groups.json');
  }

  /**
   * Cargar grupos monitoreados desde el archivo
   */
  async load(): Promise<void> {
    try {
      if (existsSync(this.groupsPath)) {
        const data = await readFile(this.groupsPath, 'utf-8');
        const groupsArray = JSON.parse(data) as MonitoredGroup[];
        
        this.groups.clear();
        for (const group of groupsArray) {
          this.groups.set(group.name.toLowerCase(), group);
        }
        
        logger.debug({ count: this.groups.size }, 'Grupos monitoreados cargados');
      } else {
        logger.debug('No hay grupos monitoreados configurados');
      }
    } catch (error) {
      logger.error({ error }, 'Error al cargar grupos monitoreados');
      this.groups.clear();
    }
  }

  /**
   * Guardar grupos monitoreados al archivo
   */
  private async save(): Promise<void> {
    try {
      const groupsArray = Array.from(this.groups.values());
      const dir = join(this.groupsPath, '..');
      
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      await writeFile(this.groupsPath, JSON.stringify(groupsArray, null, 2), 'utf-8');
      logger.debug({ count: groupsArray.length }, 'Grupos monitoreados guardados');
    } catch (error) {
      logger.error({ error }, 'Error al guardar grupos monitoreados');
      throw error;
    }
  }

  /**
   * Agregar un grupo a la lista de monitoreados
   */
  async addGroup(name: string, jid?: string): Promise<boolean> {
    const normalizedName = name.toLowerCase();
    
    if (this.groups.has(normalizedName)) {
      return false; // Ya existe
    }

    const group: MonitoredGroup = {
      name: name, // Guardar con el nombre original (case-sensitive para mostrar)
      jid,
      addedAt: new Date().toISOString(),
    };

    this.groups.set(normalizedName, group);
    await this.save();
    
    logger.info({ name, jid }, 'Grupo agregado a monitoreo');
    return true;
  }

  /**
   * Remover un grupo de la lista de monitoreados
   */
  async removeGroup(name: string): Promise<boolean> {
    const normalizedName = name.toLowerCase();
    
    if (!this.groups.has(normalizedName)) {
      return false; // No existe
    }

    this.groups.delete(normalizedName);
    await this.save();
    
    logger.info({ name }, 'Grupo removido de monitoreo');
    return true;
  }

  /**
   * Verificar si un grupo está siendo monitoreado
   */
  isMonitored(groupName: string): boolean {
    return this.groups.has(groupName.toLowerCase());
  }

  /**
   * Obtener información de un grupo monitoreado
   */
  getGroup(groupName: string): MonitoredGroup | undefined {
    return this.groups.get(groupName.toLowerCase());
  }

  /**
   * Actualizar el JID de un grupo (cuando se encuentra)
   */
  async updateGroupJid(groupName: string, jid: string): Promise<void> {
    const normalizedName = groupName.toLowerCase();
    const group = this.groups.get(normalizedName);
    
    if (group) {
      group.jid = jid;
      await this.save();
    }
  }

  /**
   * Obtener todos los grupos monitoreados
   */
  getAllGroups(): MonitoredGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Obtener el nombre original de un grupo (case-sensitive)
   */
  getOriginalName(groupName: string): string | undefined {
    const group = this.groups.get(groupName.toLowerCase());
    return group?.name;
  }
}

