// W2M - WhatsApp to Markdown
// Entry point de la aplicación

import { createIngestor } from './core/ingestor/factory.js';
import { W2MCLI } from './cli/index.js';
import { logger } from './utils/logger.js';
import { GroupManager } from './core/groups/index.js';
import { CategoryManager } from './core/categories/index.js';

// Inicializar gestores
const groupManager = new GroupManager();
await groupManager.load();

const categoryManager = new CategoryManager();
await categoryManager.load();

// Crear ingestor usando factory (carga plugin según configuración)
const ingestor = await createIngestor(groupManager);

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

// Inicializar ingestor y CLI
ingestor.initialize().then(() => {
  // Iniciar CLI interactivo
  const cli = new W2MCLI(ingestor, groupManager, categoryManager);
  cli.start();

  // Intentar conectar automáticamente si hay credenciales guardadas (silenciosamente)
  ingestor.start().catch(() => {
    // Error silencioso - el usuario puede generar QR manualmente
  });
}).catch((error) => {
  logger.error({ error }, 'Error al inicializar');
  process.exit(1);
});
