// W2M - Storage Factory
// Factory para crear instancias de Storage según configuración

import { StorageInterface } from './interface.js';
import { logger } from '../../utils/logger.js';
import { getConfig } from '../../config/index.js';

/**
 * Crear una instancia de Storage según la configuración
 * Por defecto usa LocalStorage (filesystem)
 */
export async function createStorage(): Promise<StorageInterface> {
  const config = getConfig();
  const storageType = process.env.STORAGE_TYPE || 'local';

  try {
    switch (storageType) {
      case 'local': {
        const { LocalStorage } = await import('../../plugins/storage/local/index.js');
        return new LocalStorage();
      }
      
      case 'googledrive': {
        const { GoogleDriveStorage } = await import('../../plugins/storage/googledrive/index.js');
        return new GoogleDriveStorage();
      }
      
      case 'git': {
        const { GitStorage } = await import('../../plugins/storage/git/index.js');
        return new GitStorage();
      }
      
      default:
        throw new Error(`Tipo de almacenamiento desconocido: ${storageType}`);
    }
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
      logger.error(`El plugin de almacenamiento "${storageType}" no está instalado.`);
      throw new Error(`Plugin de almacenamiento no disponible. Por favor instala las dependencias opcionales.`);
    }
    throw error;
  }
}

