// W2M - WhatsApp to Markdown
// Entry point de la aplicación

import { WhatsAppIngestor } from './core/ingestor/index.js';
import { logger } from './utils/logger.js';
import { getConfig } from './config/index.js';

const config = getConfig();

logger.info('🚀 W2M - WhatsApp to Markdown');
logger.info({ timestamp: new Date().toISOString() }, '📅 Iniciado');
logger.info('⚙️ Configuración cargada');

// Inicializar ingestor de WhatsApp
const ingestor = new WhatsAppIngestor();

// Manejar señales de terminación
process.on('SIGTERM', async () => {
  logger.info('🛑 Recibida señal SIGTERM, cerrando...');
  await ingestor.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('🛑 Recibida señal SIGINT, cerrando...');
  await ingestor.stop();
  process.exit(0);
});

// Iniciar ingestor
ingestor.start().catch((error) => {
  logger.error({ error }, '❌ Error fatal al iniciar ingestor');
  process.exit(1);
});

logger.info('✅ W2M está corriendo. Esperando conexión a WhatsApp...');
