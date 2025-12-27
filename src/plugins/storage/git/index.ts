// W2M - Git Storage Plugin
// Implementación de StorageInterface usando Git
// TODO: Implementar cuando se agregue soporte Git

import { StorageInterface } from '../../../core/storage/interface.js';
import { logger } from '../../../utils/logger.js';

export class GitStorage implements StorageInterface {
  async initialize(): Promise<void> {
    logger.warn('GitStorage no está implementado aún');
    throw new Error('GitStorage no está implementado. Usa STORAGE_TYPE=local por ahora.');
  }

  async saveFile(path: string, content: string): Promise<void> {
    throw new Error('GitStorage no está implementado');
  }

  async readFile(path: string): Promise<string | null> {
    throw new Error('GitStorage no está implementado');
  }

  async exists(path: string): Promise<boolean> {
    throw new Error('GitStorage no está implementado');
  }

  async deleteFile(path: string): Promise<void> {
    throw new Error('GitStorage no está implementado');
  }

  async listFiles(path: string): Promise<string[]> {
    throw new Error('GitStorage no está implementado');
  }
}

