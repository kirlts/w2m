// W2M - WhatsApp to Markdown
// Entry point de la aplicación

import { WhatsAppIngestor } from './core/ingestor/index.js';
import { W2MCLI } from './cli/index.js';
import { logger } from './utils/logger.js';
import { getConfig } from './config/index.js';

const config = getConfig();

// Inicializar ingestor de WhatsApp
const ingestor = new WhatsAppIngestor();

// Inicializar grupos monitoreados
ingestor.initialize().catch((error) => {
  logger.error({ error }, 'Error al inicializar grupos');
});

// Manejar señales de terminación
process.on('SIGTERM', async () => {
  logger.info('🛑 Recibida señal SIGTERM, cerrando...');
  await ingestor.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  // El CLI manejará SIGINT, pero por si acaso
  logger.info('🛑 Recibida señal SIGINT, cerrando...');
  await ingestor.stop();
  process.exit(0);
});

// Iniciar CLI interactivo PRIMERO (esto mostrará el menú en stdout)
const cli = new W2MCLI(ingestor);
cli.start();

// Inicializar grupos monitoreados y conectar automáticamente
ingestor.initialize().then(() => {
  // Intentar conectar automáticamente si hay credenciales guardadas (silenciosamente)
  ingestor.start().catch(() => {
    // Error silencioso - el usuario puede generar QR manualmente
  });
}).catch((error) => {
  logger.error({ error }, 'Error al inicializar grupos');
  // Intentar conectar de todas formas
  ingestor.start().catch(() => {});
});
