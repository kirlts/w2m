// W2M - WhatsApp to Markdown
// Entry point de la aplicación

import { createIngestor } from './core/ingestor/factory.js';
import { createStorage } from './core/storage/factory.js';
import { startWebServer, stopWebServer } from './web/index.js';
import { W2MCLI } from './cli/index.js';
import { logger } from './utils/logger.js';
import { GroupManager } from './core/groups/index.js';
import { CategoryManager } from './core/categories/index.js';

// Inicializar gestores
const groupManager = new GroupManager();
await groupManager.load();

const categoryManager = new CategoryManager();
await categoryManager.load();

// Crear storage usando factory (carga plugin según configuración)
const storage = await createStorage();
await storage.initialize();

// Crear ingestor usando factory (carga plugin según configuración)
const ingestor = await createIngestor(groupManager);

// Manejar señales de terminación
process.on('SIGTERM', async () => {
  logger.info('🛑 Recibida señal SIGTERM, cerrando...');
  await stopWebServer();
  await ingestor.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  // El CLI manejará SIGINT, pero por si acaso
  logger.info('🛑 Recibida señal SIGINT, cerrando...');
  await stopWebServer();
  await ingestor.stop();
  process.exit(0);
});

// Inicializar ingestor, CLI y Web Server
ingestor.initialize().then(async () => {
  // Iniciar servidor web
  await startWebServer({
    ingestor,
    groupManager,
    categoryManager,
  });

  // Iniciar CLI interactivo
  const cli = new W2MCLI(ingestor, groupManager, categoryManager, storage);
  cli.start();

  // Intentar conectar automáticamente si hay credenciales guardadas (silenciosamente)
  ingestor.start().catch(() => {
    // Error silencioso - el usuario puede generar QR manualmente
  });
}).catch((error) => {
  logger.error({ error }, 'Error al inicializar');
  process.exit(1);
});
