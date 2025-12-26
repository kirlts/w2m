// W2M - WhatsApp to Markdown
// Entry point de la aplicación

import { WhatsAppIngestor } from './core/ingestor/index.js';
import { W2MCLI } from './cli/index.js';
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

// Iniciar CLI interactivo
const cli = new W2MCLI(ingestor);
cli.start();

logger.info('✅ W2M está corriendo. Usa el CLI para generar el código QR.');
