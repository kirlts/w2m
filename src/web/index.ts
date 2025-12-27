// W2M - Web Dashboard
// Dashboard ligero para configuración y monitoreo

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import { IngestorInterface } from '../core/ingestor/interface.js';
import { GroupManager } from '../core/groups/index.js';
import { CategoryManager } from '../core/categories/index.js';
import { setupRoutes } from './routes.js';
import { setupSSE } from './sse.js';
import { enableLoggerSSE } from '../utils/logger-sse.js';

export interface WebServerContext {
  ingestor: IngestorInterface;
  groupManager: GroupManager;
  categoryManager: CategoryManager;
}

let serverInstance: ReturnType<typeof serve> | null = null;

/**
 * Iniciar servidor web
 */
export async function startWebServer(context: WebServerContext): Promise<void> {
  const config = getConfig();
  
  if (!config.WEB_ENABLED) {
    logger.debug('Web dashboard deshabilitado');
    return;
  }

  const app = new Hono();

  // Habilitar integración SSE del logger
  enableLoggerSSE();

  // Configurar rutas
  setupRoutes(app, context);
  
  // Configurar SSE para logs en tiempo real
  setupSSE(app, context);

  // Iniciar servidor
  const port = config.WEB_PORT;
  const host = config.WEB_HOST;

  serverInstance = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  }, (info) => {
    logger.info({ port, host }, `🌐 Web dashboard disponible en http://${host}:${port}/web`);
  });
}

/**
 * Detener servidor web
 */
export async function stopWebServer(): Promise<void> {
  if (serverInstance) {
    await new Promise<void>((resolve) => {
      serverInstance?.close(() => {
        logger.info('Web dashboard detenido');
        resolve();
      });
    });
    serverInstance = null;
  }
}

