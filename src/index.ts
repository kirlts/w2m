// W2M - WhatsApp to Markdown
// Entry point de la aplicación

import { WhatsAppIngestor } from './core/ingestor/index.js';
import { W2MCLI } from './cli/index.js';
import { logger } from './utils/logger.js';
import { getConfig } from './config/index.js';

const config = getConfig();

// Inicializar ingestor de WhatsApp
const ingestor = new WhatsAppIngestor();

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

// Loguear a stderr DESPUÉS de que el CLI esté listo (con un pequeño delay)
// Esto evita que los logs aparezcan justo después del prompt
setTimeout(() => {
  logger.info('🚀 W2M - WhatsApp to Markdown');
  logger.info({ timestamp: new Date().toISOString() }, '📅 Iniciado');
  logger.info('⚙️ Configuración cargada');
  
  // Intentar conectar automáticamente si hay credenciales guardadas
  ingestor.start().then(() => {
    logger.info('🔄 Intentando conectar automáticamente...');
  }).catch((error) => {
    logger.info('💡 No hay sesión guardada o error al conectar. Usa la opción 1 para generar QR.');
  });
}, 100);
