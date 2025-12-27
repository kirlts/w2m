// W2M - Web Dashboard Routes
// Rutas del dashboard web

import { Hono } from 'hono';
import { WebServerContext } from './index.js';
import { getDashboardHTML } from './templates/dashboard.js';
import { getGroupsHTML } from './templates/groups.js';
import { getCategoriesHTML } from './templates/categories.js';
import { broadcastSSE } from './sse.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';

export function setupRoutes(app: Hono, context: WebServerContext): void {
  const { ingestor, groupManager, categoryManager, storage } = context;

  // Dashboard principal
  app.get('/web', async (c) => {
    const html = await getDashboardHTML(context);
    return c.html(html);
  });

  // API: Estado de conexión
  app.get('/web/api/status', async (c) => {
    const state = ingestor.getConnectionState();
    const isConnected = ingestor.isConnected();
    
    return c.json({
      state,
      isConnected,
      timestamp: new Date().toISOString(),
    });
  });

  // API: Obtener QR (si está disponible)
  app.get('/web/api/qr', async (c) => {
    // El QR se obtiene vía SSE cuando se genera
    return c.json({ qr: null, message: 'QR se genera automáticamente cuando se solicita' });
  });

  // API: Generar QR
  app.post('/web/api/qr/generate', async (c) => {
    try {
      logger.info({}, '🔄 [Dashboard] Generando código QR...');
      await ingestor.generateQR();
      // El QR se enviará vía SSE cuando esté disponible
      broadcastSSE('qr', { message: 'QR generado, esperando código...' });
      return c.json({ success: true, message: 'QR generado' });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al generar QR');
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // API: Desconectar
  app.post('/web/api/disconnect', async (c) => {
    try {
      logger.info({}, '🔌 [Dashboard] Desconectando...');
      await ingestor.stop();
      logger.info({}, '✅ [Dashboard] Desconectado correctamente');
      return c.json({ success: true, message: 'Desconectado' });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al desconectar');
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // API: Conectar
  app.post('/web/api/connect', async (c) => {
    try {
      logger.info({}, '🔌 [Dashboard] Conectando...');
      await ingestor.start();
      return c.json({ success: true, message: 'Conectando...' });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al conectar');
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // API: Listar grupos disponibles (JSON)
  app.get('/web/api/groups/available', async (c) => {
    logger.info({}, '🔍 [DEBUG] /web/api/groups/available - Request recibido');
    try {
      const isConnected = ingestor.isConnected();
      logger.info({ isConnected }, '🔍 [DEBUG] Estado de conexión verificado');
      
      // Verificar si hay conexión antes de intentar listar grupos
      if (!isConnected) {
        logger.warn({}, '🔍 [DEBUG] No hay conexión activa, retornando error');
        return c.json({ 
          error: 'No hay conexión activa. Conecta primero a WhatsApp.',
          groups: []
        }, 200); // 200 para que el frontend pueda manejar el error
      }

      logger.info({}, '🔍 [DEBUG] Llamando a ingestor.listGroups()');
      const groups = await ingestor.listGroups();
      logger.info({ count: groups.length }, '🔍 [DEBUG] Grupos obtenidos del ingestor');
      
      const monitoredGroups = groupManager.getAllGroups();
      logger.info({ monitoredCount: monitoredGroups.length }, '🔍 [DEBUG] Grupos monitoreados obtenidos');
      
      const monitoredNames = new Set(monitoredGroups.map(g => g.name.toLowerCase()));
      
      const groupsWithStatus = groups.map(group => ({
        ...group,
        isMonitored: monitoredNames.has(group.name.toLowerCase()),
      }));
      
      logger.info({ totalGroups: groupsWithStatus.length }, '🔍 [DEBUG] Retornando grupos con estado');
      return c.json({ groups: groupsWithStatus });
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, '❌ [DEBUG] Error al listar grupos disponibles');
      return c.json({ 
        error: error.message || 'Error al obtener grupos',
        groups: []
      }, 200); // 200 para que el frontend pueda manejar el error
    }
  });

  // API: Listar grupos monitoreados (HTML para HTMX)
  app.get('/web/api/groups', async (c) => {
    try {
      const monitoredGroups = groupManager.getAllGroups();
      return c.html(getGroupsHTML(monitoredGroups.map(g => ({ name: g.name, jid: g.jid, isMonitored: true }))));
    } catch (error: any) {
      return c.html(`<p class="text-red-500">Error: ${error.message}</p>`);
    }
  });

  // API: Agregar grupo monitoreado
  app.post('/web/api/groups', async (c) => {
    try {
      const { name, jid } = await c.req.json();
      if (!name) {
        return c.json({ error: 'Nombre de grupo requerido' }, 400);
      }
      
      await groupManager.addGroup(name, jid);
      logger.info({ group: name }, `✅ [Dashboard] Grupo "${name}" agregado a monitoreo`);
      return c.json({ success: true, message: `Grupo "${name}" agregado` });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al agregar grupo');
      return c.json({ error: error.message }, 500);
    }
  });

  // API: Remover grupo monitoreado
  app.delete('/web/api/groups/:name', async (c) => {
    try {
      const name = c.req.param('name');
      await groupManager.removeGroup(name);
      logger.info({ group: name }, `🗑️ [Dashboard] Grupo "${name}" removido de monitoreo`);
      return c.json({ success: true, message: `Grupo "${name}" removido` });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al remover grupo');
      return c.json({ error: error.message }, 500);
    }
  });

  // API: Listar categorías (HTML para HTMX)
  app.get('/web/api/categories', async (c) => {
    try {
      const categories = categoryManager.getAllCategories();
      return c.html(getCategoriesHTML(categories));
    } catch (error: any) {
      return c.html(`<p class="text-red-500">Error: ${error.message}</p>`);
    }
  });

  // API: Crear categoría
  app.post('/web/api/categories', async (c) => {
    try {
      const { name, description, enabledFields, separator } = await c.req.json();
      if (!name) {
        return c.json({ error: 'Nombre de categoría requerido' }, 400);
      }
      
      await categoryManager.addCategory(name, description, enabledFields, separator);
      logger.info({ category: name, fields: enabledFields, separator }, `✅ [Dashboard] Categoría "${name}" creada`);
      return c.json({ success: true, message: `Categoría "${name}" creada` });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al crear categoría');
      return c.json({ error: error.message }, 500);
    }
  });

  // API: Eliminar categoría
  app.delete('/web/api/categories/:name', async (c) => {
    try {
      const name = c.req.param('name');
      const { deleteFile } = await c.req.json().catch(() => ({ deleteFile: false }));
      
      await categoryManager.removeCategory(name);
      
      if (deleteFile) {
        await categoryManager.deleteCategoryMarkdown(name);
        logger.info({ category: name, fileDeleted: true }, `🗑️ [Dashboard] Categoría "${name}" eliminada (con archivo markdown)`);
      } else {
        logger.info({ category: name, fileDeleted: false }, `🗑️ [Dashboard] Categoría "${name}" eliminada`);
      }
      
      return c.json({ success: true, message: `Categoría "${name}" eliminada` });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al eliminar categoría');
      return c.json({ error: error.message }, 500);
    }
  });

  // API: Configurar campos y separador de categoría
  app.put('/web/api/categories/:name/fields', async (c) => {
    try {
      const name = c.req.param('name');
      const { enabledFields, separator } = await c.req.json();
      
      if (!Array.isArray(enabledFields)) {
        return c.json({ error: 'enabledFields debe ser un array' }, 400);
      }
      
      const updates: { enabledFields?: any; separator?: string } = {};
      updates.enabledFields = enabledFields;
      if (separator && separator.length >= 1 && separator.length <= 3) {
        updates.separator = separator;
      }
      
      await categoryManager.updateCategory(name, updates);
      logger.info({ category: name, fields: enabledFields, separator }, `⚙️ [Dashboard] Categoría "${name}" configurada`);
      return c.json({ success: true, message: `Categoría "${name}" actualizada` });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al configurar categoría');
      return c.json({ error: error.message }, 500);
    }
  });

  // API: Obtener markdown de categoría
  app.get('/web/api/categories/:name/markdown', async (c) => {
    try {
      const name = c.req.param('name');
      const category = categoryManager.getCategory(name);
      
      if (!category) {
        return c.text('Categoría no encontrada', 404);
      }
      
      // Usar StorageInterface en lugar de fs directamente
      const relativePath = categoryManager.getCategoryMarkdownRelativePath(name);
      const fileExists = await storage.exists(relativePath);
      
      if (!fileExists) {
        return c.text('No hay mensajes en esta categoría aún', 404);
      }
      
      const content = await storage.readFile(relativePath);
      if (!content) {
        return c.text('No hay mensajes en esta categoría aún', 404);
      }
      
      return c.text(content);
    } catch (error: any) {
      logger.error({ error: error.message, category: c.req.param('name') }, 'Error al obtener markdown de categoría');
      return c.text(`Error: ${error.message}`, 500);
    }
  });

  // API: Estado de Google Drive Storage
  app.get('/web/api/storage/status', async (c) => {
    logger.info({}, '🔍 [DEBUG] /web/api/storage/status - Request recibido');
    try {
      const config = getConfig();
      logger.info({ STORAGE_TYPE: config.STORAGE_TYPE }, '🔍 [DEBUG] Config obtenido');
      
      // Leer STORAGE_TYPE directamente de process.env para evitar problemas con defaults
      const storageType = process.env.STORAGE_TYPE || config.STORAGE_TYPE || 'local';
      logger.info({ storageType, envSTORAGE_TYPE: process.env.STORAGE_TYPE, configSTORAGE_TYPE: config.STORAGE_TYPE }, '🔍 [DEBUG] Storage type determinado');
      
      let status = storageType;
      let configured = false;
      let message = '';
      
      if (storageType === 'googledrive') {
        logger.info({}, '🔍 [DEBUG] Verificando Google Drive Service Account');
        // Verificar directamente si el archivo Service Account existe
        // Esto evita problemas con imports dinámicos en código compilado
        const serviceAccountPath = config.GOOGLE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
        logger.info({ serviceAccountPath }, '🔍 [DEBUG] Service Account path obtenido');
        
        if (serviceAccountPath) {
          try {
            logger.info({ path: serviceAccountPath }, '🔍 [DEBUG] Importando fs para verificar archivo');
            const { existsSync } = await import('fs');
            logger.info({}, '🔍 [DEBUG] fs importado, verificando existencia');
            const fileExists = existsSync(serviceAccountPath);
            logger.info({ fileExists, path: serviceAccountPath }, '🔍 [DEBUG] Resultado de existsSync');
            
            if (fileExists) {
              configured = true;
              message = 'Google Drive configurado con Service Account';
              logger.info({}, '🔍 [DEBUG] Service Account configurado correctamente');
            } else {
              configured = false;
              message = `Archivo Service Account no encontrado: ${serviceAccountPath}`;
              logger.warn({ path: serviceAccountPath }, '🔍 [DEBUG] Archivo Service Account no encontrado');
            }
          } catch (fsError: any) {
            configured = false;
            message = `Error al verificar archivo: ${fsError.message}`;
            logger.error({ error: fsError.message, stack: fsError.stack }, '🔍 [DEBUG] Error al verificar archivo');
          }
        } else {
          configured = false;
          message = 'Google Drive no está configurado. Configura GOOGLE_SERVICE_ACCOUNT_PATH en .env';
          logger.warn({}, '🔍 [DEBUG] GOOGLE_SERVICE_ACCOUNT_PATH no configurado');
        }
      } else {
        status = 'local';
        message = 'Almacenamiento local activo';
        configured = true;
        logger.info({}, '🔍 [DEBUG] Usando almacenamiento local');
      }
      
      const response = {
        storageType: status,
        configured,
        message,
        serviceAccountPath: config.GOOGLE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_SERVICE_ACCOUNT_PATH || null,
      };
      logger.info({ response }, '🔍 [DEBUG] Retornando respuesta de storage status');
      return c.json(response);
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, '❌ [DEBUG] Error al obtener estado de storage');
      return c.json({ 
        storageType: 'local',
        configured: false,
        error: error.message 
      }, 500);
    }
  });
}

