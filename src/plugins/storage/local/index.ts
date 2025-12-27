// W2M - Local Storage Plugin
// Implementación de StorageInterface usando filesystem local

import { readFile, writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { StorageInterface } from '../../../core/storage/interface.js';
import { getConfig } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

export class LocalStorage implements StorageInterface {
  private config = getConfig();
  private basePath: string;

  constructor() {
    // Usar VAULT_PATH como base para archivos markdown
    this.basePath = this.config.VAULT_PATH;
  }

  async initialize(): Promise<void> {
    // Asegurar que el directorio base existe
    if (!existsSync(this.basePath)) {
      await mkdir(this.basePath, { recursive: true });
      logger.debug({ basePath: this.basePath }, 'Directorio de almacenamiento local creado');
    }
  }

  async saveFile(path: string, content: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    const dir = dirname(fullPath);

    // Crear directorio si no existe
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Escribir archivo
    await writeFile(fullPath, content, 'utf-8');
  }

  async readFile(path: string): Promise<string | null> {
    const fullPath = join(this.basePath, path);
    
    if (!existsSync(fullPath)) {
      return null;
    }

    try {
      return await readFile(fullPath, 'utf-8');
    } catch (error) {
      logger.error({ error, path }, 'Error al leer archivo');
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = join(this.basePath, path);
    return existsSync(fullPath);
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    
    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }
  }

  async listFiles(path: string): Promise<string[]> {
    const fullPath = join(this.basePath, path);
    
    if (!existsSync(fullPath)) {
      return [];
    }

    try {
      const entries = await readdir(fullPath, { withFileTypes: true });
      const files: string[] = [];
      
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(join(path, entry.name));
        }
      }
      
      return files;
    } catch (error) {
      logger.error({ error, path }, 'Error al listar archivos');
      return [];
    }
  }
}

