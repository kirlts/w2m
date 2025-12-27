// W2M - Ingestor Factory
// Factory para crear instancias de ingestor según configuración

import { IngestorInterface } from './interface.js';
import { GroupManager } from '../groups/index.js';
import { logger } from '../../utils/logger.js';
import { getConfig } from '../../config/index.js';

/**
 * Crear una instancia de ingestor según la configuración
 * Por defecto intenta usar Baileys si está disponible
 */
export async function createIngestor(groupManager?: GroupManager): Promise<IngestorInterface> {
  const config = getConfig();
  const ingestorType = process.env.INGESTOR_TYPE || 'baileys';

  try {
    switch (ingestorType) {
      case 'baileys': {
        // Intentar cargar Baileys dinámicamente
        const { BaileysIngestor } = await import('../../plugins/baileys/index.js');
        return new BaileysIngestor(groupManager);
      }
      
      default:
        throw new Error(`Tipo de ingestor desconocido: ${ingestorType}`);
    }
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
      logger.error('El plugin de Baileys no está instalado. Instálalo con: npm install @whiskeysockets/baileys qrcode-terminal');
      throw new Error('Plugin de ingestor no disponible. Por favor instala las dependencias opcionales.');
    }
    throw error;
  }
}

