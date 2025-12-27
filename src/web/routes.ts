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

  // API: Estado de Google Drive Storage (ahora con OAuth)
  app.get('/web/api/storage/status', async (c) => {
    try {
      // Obtener estado del storage directamente
      const storageStatus = (storage as any).getStatus?.() || { local: true, drive: false, authMethod: 'none' };
      
      return c.json({
        local: storageStatus.local,
        drive: storageStatus.drive,
        authMethod: storageStatus.authMethod,
        userEmail: storageStatus.userEmail || null,
        folderId: storageStatus.folderId || null,
      });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al obtener estado de storage');
      return c.json({ 
        local: true,
        drive: false,
        authMethod: 'none',
        error: error.message 
      }, 500);
    }
  });

  // ============ OAuth para Google Drive ============

  // API: Verificar si OAuth está configurado
  app.get('/web/api/oauth/status', async (c) => {
    try {
      const { isOAuthConfigured, hasOAuthTokens, getAuthenticatedUserInfo } = await import('../plugins/storage/googledrive/oauth.js');
      
      const configured = await isOAuthConfigured();
      const hasTokens = await hasOAuthTokens();
      let userInfo = null;
      
      if (hasTokens) {
        userInfo = await getAuthenticatedUserInfo();
      }
      
      return c.json({
        configured,
        authorized: hasTokens,
        user: userInfo,
      });
    } catch (error: any) {
      return c.json({
        configured: false,
        authorized: false,
        error: error.message,
      });
    }
  });

  // API: Obtener URL de autorización
  app.get('/web/api/oauth/authorize', async (c) => {
    try {
      const { isOAuthConfigured, getAuthorizationUrl } = await import('../plugins/storage/googledrive/oauth.js');
      
      const configured = await isOAuthConfigured();
      
      if (!configured) {
        return c.json({
          error: 'OAuth no configurado. Sube el archivo oauth-credentials.json a ./data/googledrive/',
          instructions: [
            '1. Ve a Google Cloud Console → APIs & Services → Credentials',
            '2. Crea un OAuth 2.0 Client ID (tipo: Desktop app)',
            '3. Descarga el JSON',
            '4. Sube el archivo como: ./data/googledrive/oauth-credentials.json',
            '5. Reinicia el contenedor',
          ],
        }, 400);
      }
      
      const authUrl = await getAuthorizationUrl();
      
      return c.json({
        authUrl,
        instructions: [
          '1. Abre la URL en tu navegador',
          '2. Inicia sesión con tu cuenta de Google',
          '3. Autoriza el acceso a Google Drive',
          '4. Copia el código que aparece',
          '5. Pégalo en el campo de abajo',
        ],
      });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al generar URL de autorización');
      return c.json({ error: error.message }, 500);
    }
  });

  // API: Intercambiar código por tokens
  app.post('/web/api/oauth/callback', async (c) => {
    try {
      const { code } = await c.req.json();
      
      if (!code) {
        return c.json({ error: 'Código de autorización requerido' }, 400);
      }
      
      const { exchangeCodeForTokens } = await import('../plugins/storage/googledrive/oauth.js');
      
      await exchangeCodeForTokens(code.trim());
      
      // Reinicializar storage con OAuth
      if ((storage as any).reinitializeDrive) {
        await (storage as any).reinitializeDrive();
      }
      
      logger.info({}, '✅ [Dashboard] OAuth autorizado correctamente');
      
      return c.json({
        success: true,
        message: '¡Autorización exitosa! Google Drive está ahora conectado.',
      });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al intercambiar código');
      return c.json({ error: error.message }, 500);
    }
  });

  // API: Revocar tokens (logout de Google Drive)
  app.post('/web/api/oauth/revoke', async (c) => {
    try {
      const { revokeTokens } = await import('../plugins/storage/googledrive/oauth.js');
      
      await revokeTokens();
      
      // Reinicializar storage sin OAuth
      if ((storage as any).reinitializeDrive) {
        await (storage as any).reinitializeDrive();
      }
      
      logger.info({}, '🔌 [Dashboard] Sesión de Google Drive cerrada');
      
      return c.json({
        success: true,
        message: 'Sesión de Google Drive cerrada',
      });
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al revocar tokens');
      return c.json({ error: error.message }, 500);
    }
  });
}

