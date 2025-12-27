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
  const { ingestor, groupManager, categoryManager } = context;

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
    try {
      const groups = await ingestor.listGroups();
      const monitoredGroups = groupManager.getAllGroups();
      const monitoredNames = new Set(monitoredGroups.map(g => g.name.toLowerCase()));
      
      const groupsWithStatus = groups.map(group => ({
        ...group,
        isMonitored: monitoredNames.has(group.name.toLowerCase()),
      }));
      
      return c.json({ groups: groupsWithStatus });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
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
      
      const { readFile } = await import('fs/promises');
      const { existsSync } = await import('fs');
      const markdownPath = categoryManager.getCategoryMarkdownPath(name);
      
      if (!existsSync(markdownPath)) {
        return c.text('No hay mensajes en esta categoría aún', 404);
      }
      
      const content = await readFile(markdownPath, 'utf-8');
      return c.text(content);
    } catch (error: any) {
      return c.text(`Error: ${error.message}`, 500);
    }
  });

  // API: OAuth Google Drive - Iniciar flujo
  app.get('/web/api/oauth/googledrive/start', async (c) => {
    try {
      // @ts-ignore - Dynamic import resolved at runtime
      const { getAuthUrl } = await import('../../plugins/storage/googledrive/oauth.js');
      const authUrl = getAuthUrl();
      logger.info({}, '🔄 [Dashboard] Iniciando flujo OAuth de Google Drive');
      return c.redirect(authUrl);
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error al iniciar OAuth');
      return c.json({ 
        error: error.message || 'Error al iniciar OAuth',
        message: 'Verifica que GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET estén configurados',
      }, 500);
    }
  });

  // API: OAuth Google Drive - Callback
  app.get('/web/api/oauth/googledrive/callback', async (c) => {
    try {
      const code = c.req.query('code');
      const error = c.req.query('error');
      
      if (error) {
        logger.error({ error }, '❌ [Dashboard] Error en callback OAuth');
        return c.html(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Error de Autenticación</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-gray-100 flex items-center justify-center min-h-screen">
            <div class="bg-white p-8 rounded-lg shadow-lg max-w-md">
              <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Error de Autenticación</h1>
              <p class="text-gray-700 mb-4">${error}</p>
              <a href="/web" class="text-blue-500 hover:underline">Volver al Dashboard</a>
            </div>
          </body>
          </html>
        `);
      }
      
      if (!code) {
        return c.html(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Error de Autenticación</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-gray-100 flex items-center justify-center min-h-screen">
            <div class="bg-white p-8 rounded-lg shadow-lg max-w-md">
              <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Error</h1>
              <p class="text-gray-700 mb-4">No se recibió código de autorización</p>
              <a href="/web" class="text-blue-500 hover:underline">Volver al Dashboard</a>
            </div>
          </body>
          </html>
        `);
      }
      
      // @ts-ignore - Dynamic import resolved at runtime
      const { getTokensFromCode, saveTokens } = await import('../../plugins/storage/googledrive/oauth.js');
      const tokens = await getTokensFromCode(code);
      await saveTokens(tokens);
      
      logger.info({}, '✅ [Dashboard] OAuth de Google Drive completado exitosamente');
      
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Autenticación Exitosa</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-lg shadow-lg max-w-md">
            <h1 class="text-2xl font-bold text-green-600 mb-4">✅ Autenticación Exitosa</h1>
            <p class="text-gray-700 mb-4">Google Drive ha sido conectado correctamente.</p>
            <p class="text-sm text-gray-500 mb-4">Los archivos markdown se guardarán en la carpeta "W2M" de tu Google Drive.</p>
            <a href="/web" class="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Volver al Dashboard</a>
          </div>
          <script>
            // Cerrar ventana después de 3 segundos si fue abierta en popup
            setTimeout(() => {
              if (window.opener) {
                window.opener.location.reload();
                window.close();
              }
            }, 3000);
          </script>
        </body>
        </html>
      `);
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ [Dashboard] Error en callback OAuth');
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Error</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-lg shadow-lg max-w-md">
            <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Error</h1>
            <p class="text-gray-700 mb-4">${error.message || 'Error desconocido'}</p>
            <a href="/web" class="text-blue-500 hover:underline">Volver al Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }
  });

  // API: Estado de OAuth Google Drive
  app.get('/web/api/oauth/googledrive/status', async (c) => {
    try {
      // @ts-ignore - Dynamic import resolved at runtime
      const { hasTokens } = await import('../../plugins/storage/googledrive/oauth.js');
      const isAuthenticated = await hasTokens();
      return c.json({ 
        authenticated: isAuthenticated,
        message: isAuthenticated ? 'Google Drive está conectado' : 'Google Drive no está conectado'
      });
    } catch (error: any) {
      return c.json({ 
        authenticated: false,
        error: error.message 
      }, 500);
    }
  });

  // API: Estado de Google Drive Storage
  app.get('/web/api/storage/status', async (c) => {
    try {
      const config = getConfig();
      // @ts-ignore - Dynamic import resolved at runtime
      const { isServiceAccountConfigured } = await import('../../plugins/storage/googledrive/service-account.js');
      // @ts-ignore - Dynamic import resolved at runtime
      const { hasTokens } = await import('../../plugins/storage/googledrive/oauth.js');
      
      const storageType = config.STORAGE_TYPE || 'local';
      let status = 'local';
      let method = null;
      let configured = false;
      let message = '';
      
      if (storageType === 'googledrive') {
        const serviceAccountConfigured = isServiceAccountConfigured();
        const oauthConfigured = await hasTokens();
        
        if (serviceAccountConfigured) {
          status = 'googledrive';
          method = 'service_account';
          configured = true;
          message = 'Google Drive configurado con Service Account';
        } else if (oauthConfigured) {
          status = 'googledrive';
          method = 'oauth';
          configured = true;
          message = 'Google Drive configurado con OAuth';
        } else {
          status = 'googledrive';
          method = null;
          configured = false;
          message = 'Google Drive no está configurado. Configura Service Account o OAuth.';
        }
      } else {
        status = 'local';
        message = 'Almacenamiento local activo';
        configured = true;
      }
      
      return c.json({
        storageType: status,
        method,
        configured,
        message,
        serviceAccountPath: config.GOOGLE_SERVICE_ACCOUNT_PATH || null,
      });
    } catch (error: any) {
      return c.json({ 
        storageType: 'local',
        configured: false,
        error: error.message 
      }, 500);
    }
  });
}

