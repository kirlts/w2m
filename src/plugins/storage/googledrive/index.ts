// W2M - Google Drive Storage Plugin
// Implementación de StorageInterface usando Google Drive API
// TODO: Implementar cuando se agregue OAuth

import { StorageInterface } from '../../../core/storage/interface.js';
import { logger } from '../../../utils/logger.js';

export class GoogleDriveStorage implements StorageInterface {
  async initialize(): Promise<void> {
    logger.warn('GoogleDriveStorage no está implementado aún');
    throw new Error('GoogleDriveStorage no está implementado. Usa STORAGE_TYPE=local por ahora.');
  }

  async saveFile(path: string, content: string): Promise<void> {
    throw new Error('GoogleDriveStorage no está implementado');
  }

  async readFile(path: string): Promise<string | null> {
    throw new Error('GoogleDriveStorage no está implementado');
  }

  async exists(path: string): Promise<boolean> {
    throw new Error('GoogleDriveStorage no está implementado');
  }

  async deleteFile(path: string): Promise<void> {
    throw new Error('GoogleDriveStorage no está implementado');
  }

  async listFiles(path: string): Promise<string[]> {
    throw new Error('GoogleDriveStorage no está implementado');
  }
}

