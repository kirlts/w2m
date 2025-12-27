// W2M - Dashboard HTML Template

import { WebServerContext } from '../index.js';

export async function getDashboardHTML(context: WebServerContext): Promise<string> {
  const { ingestor, groupManager, categoryManager } = context;
  const state = ingestor.getConnectionState();
  const isConnected = ingestor.isConnected();
  const groups = groupManager.getAllGroups();
  const categories = categoryManager.getAllCategories();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>W2M Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/htmx.org@2.0.3"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <style>
    .log-entry {
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }
    #qr-display {
      font-family: 'Courier New', monospace;
      white-space: pre;
      background: #000;
      color: #0f0;
      padding: 1rem;
      border-radius: 0.5rem;
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">📱 W2M Dashboard</h1>

    <!-- Estado de Conexión -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Estado de Conexión</h2>
      <div class="flex items-center gap-4">
        <div id="connection-status" class="flex items-center gap-2">
          <span class="text-2xl">${isConnected ? '✅' : '❌'}</span>
          <span class="text-lg font-medium">${state === 'connected' ? 'Conectado' : state === 'connecting' ? 'Conectando...' : 'Desconectado'}</span>
        </div>
        <div class="flex gap-2">
          <button 
            hx-post="/web/api/connect"
            hx-target="#connection-status"
            hx-swap="outerHTML"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            ${isConnected ? 'disabled' : ''}
          >
            Conectar
          </button>
          <button 
            hx-post="/web/api/disconnect"
            hx-target="#connection-status"
            hx-swap="outerHTML"
            class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            ${!isConnected ? 'disabled' : ''}
          >
            Desconectar
          </button>
          <button 
            hx-post="/web/api/qr/generate"
            hx-target="#qr-container"
            class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            ${isConnected ? 'disabled' : ''}
          >
            Generar QR
          </button>
        </div>
      </div>
    </div>

    <!-- QR Code Display -->
    <div id="qr-container" class="bg-white rounded-lg shadow p-6 mb-6 ${isConnected ? 'hidden' : ''}">
      <h2 class="text-xl font-semibold mb-4">Código QR</h2>
      <div id="qr-display" class="text-center">
        <p class="text-gray-500">Haz clic en "Generar QR" para mostrar el código</p>
      </div>
    </div>

    <!-- Logs en Tiempo Real -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Logs en Tiempo Real</h2>
      <div id="logs-container" class="bg-gray-900 text-green-400 p-4 rounded h-64 overflow-y-auto">
        <div class="log-entry">Conectando al stream de logs...</div>
      </div>
    </div>

    <!-- Google Drive Storage -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">☁️ Google Drive Sync</h2>
      <div id="storage-status" class="mb-4">
        <p class="text-gray-500">Verificando estado...</p>
      </div>
      <div id="oauth-flow" class="hidden">
        <div id="oauth-url-container" class="mb-4 hidden">
          <p class="mb-2 font-medium">Paso 1: Abre este enlace en tu navegador</p>
          <div class="flex gap-2 mb-4">
            <input type="text" id="oauth-url" readonly class="flex-1 border rounded px-3 py-2 bg-gray-50 text-sm" />
            <button onclick="copyOAuthUrl()" class="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">📋 Copiar</button>
            <a id="oauth-url-link" href="#" target="_blank" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-center">🔗 Abrir</a>
          </div>
          <p class="mb-2 font-medium">Paso 2: Pega el código que Google te da</p>
          <div class="flex gap-2">
            <input type="text" id="oauth-code" placeholder="Pega el código aquí" class="flex-1 border rounded px-3 py-2" />
            <button onclick="submitOAuthCode()" id="submit-oauth-btn" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">✓ Autorizar</button>
          </div>
          <p id="oauth-error" class="text-red-500 mt-2 hidden"></p>
          <p id="oauth-success" class="text-green-500 mt-2 hidden"></p>
        </div>
        <div id="oauth-not-configured" class="hidden p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p class="font-medium mb-2">⚠️ OAuth no configurado</p>
          <p class="text-sm mb-2">Para usar OAuth con tu cuenta personal de Google Drive:</p>
          <ol class="text-sm list-decimal list-inside space-y-1">
            <li>Ve a <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-blue-600 hover:underline">Google Cloud Console → Credentials</a></li>
            <li>Crea un OAuth 2.0 Client ID (tipo: <strong>Desktop app</strong>)</li>
            <li>Descarga el JSON</li>
            <li>Súbelo como: <code class="bg-gray-200 px-1 rounded">./data/googledrive/oauth-credentials.json</code></li>
            <li>Reinicia W2M</li>
          </ol>
        </div>
      </div>
      <div id="storage-actions" class="flex gap-2 mt-4">
        <!-- Botones se mostrarán dinámicamente -->
      </div>
    </div>

            <!-- Grupos Monitoreados -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold">Grupos Monitoreados (<span id="groups-count">${groups.length}</span>)</h2>
        <button 
          onclick="document.getElementById('add-group-modal').classList.remove('hidden')"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          + Agregar Grupo
        </button>
      </div>
      <div id="groups-list" hx-get="/web/api/groups" hx-trigger="load, every 5s" hx-target="this" hx-swap="innerHTML">
        Cargando grupos...
      </div>
    </div>

    <!-- Modal Agregar Grupo -->
    <div id="add-group-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 class="text-xl font-semibold mb-4">Agregar Grupo</h3>
        <div id="available-groups-list" class="space-y-2 mb-4">
          <p class="text-gray-500">Cargando grupos disponibles...</p>
        </div>
        <div class="flex gap-2">
          <button 
            onclick="document.getElementById('add-group-modal').classList.add('hidden')"
            class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>

            <!-- Categorías -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
              <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold">Categorías (<span id="categories-count">${categories.length}</span>)</h2>
        <button 
          onclick="document.getElementById('add-category-modal').classList.remove('hidden')"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          + Crear Categoría
        </button>
      </div>
      <div id="categories-list" hx-get="/web/api/categories" hx-trigger="load, every 5s" hx-target="this" hx-swap="innerHTML">
        Cargando categorías...
      </div>
    </div>

    <!-- Modal Crear Categoría -->
    <div id="add-category-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-semibold mb-4">Crear Categoría</h3>
        <form 
          id="add-category-form"
          class="space-y-4"
          onsubmit="createCategory(event)"
        >
          <div>
            <label class="block text-sm font-medium mb-1">Nombre</label>
            <input 
              type="text" 
              name="name" 
              required 
              pattern="[A-Za-z0-9_]+"
              class="w-full border rounded px-3 py-2"
              placeholder="ej: CODIGO"
            />
            <p class="text-xs text-gray-500 mt-1">Solo letras, números, guiones y guiones bajos</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Campos</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="AUTOR" class="mr-2" />
                AUTOR
              </label>
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="HORA" class="mr-2" />
                HORA
              </label>
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="FECHA" class="mr-2" />
                FECHA
              </label>
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="CONTENIDO" checked disabled class="mr-2" />
                CONTENIDO (siempre habilitado)
              </label>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Separador (1-3 caracteres)</label>
            <input 
              type="text" 
              name="separator" 
              class="w-full border rounded px-3 py-2"
              placeholder=",,"
              value=",,"
              maxlength="3"
            />
            <p class="text-xs text-gray-500 mt-1">Formato: CATEGORIA<span class="font-mono bg-gray-100 px-1">,,</span>contenido</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Descripción (opcional)</label>
            <input 
              type="text" 
              name="description" 
              class="w-full border rounded px-3 py-2"
              placeholder="Descripción de la categoría"
            />
          </div>
          <div class="flex gap-2">
            <button 
              type="submit"
              class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Crear
            </button>
            <button 
              type="button"
              onclick="document.getElementById('add-category-modal').classList.add('hidden')"
              class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Configurar Campos de Categoría -->
    <div id="configure-fields-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-semibold mb-4">Configurar Categoría</h3>
        <form 
          id="configure-fields-form"
          class="space-y-4"
          onsubmit="updateCategory(event)"
        >
          <div>
            <label class="block text-sm font-medium mb-1">Campos</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="AUTOR" class="mr-2" />
                AUTOR
              </label>
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="HORA" class="mr-2" />
                HORA
              </label>
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="FECHA" class="mr-2" />
                FECHA
              </label>
              <label class="flex items-center">
                <input type="checkbox" name="enabledFields" value="CONTENIDO" checked disabled class="mr-2" />
                CONTENIDO (siempre habilitado)
              </label>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Separador (1-3 caracteres)</label>
            <input 
              type="text" 
              name="separator" 
              id="configure-separator-input"
              class="w-full border rounded px-3 py-2"
              placeholder=",,"
              maxlength="3"
            />
            <p class="text-xs text-gray-500 mt-1">Formato: CATEGORIA<span class="font-mono bg-gray-100 px-1">separador</span>contenido</p>
          </div>
          <div class="flex gap-2">
            <button 
              type="submit"
              class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Guardar
            </button>
            <button 
              type="button"
              onclick="document.getElementById('configure-fields-modal').classList.add('hidden')"
              class="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Ver Markdown -->
    <div id="view-markdown-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h3 id="markdown-modal-title" class="text-xl font-semibold">Categoría</h3>
          <div class="flex gap-2">
            <button 
              onclick="copyMarkdown()"
              id="copy-markdown-btn"
              class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
            >
              Copiar
            </button>
            <button 
              onclick="document.getElementById('view-markdown-modal').classList.add('hidden')"
              class="bg-gray-300 text-gray-700 px-3 py-2 rounded hover:bg-gray-400 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
        <pre id="markdown-content" class="flex-1 overflow-auto bg-gray-50 p-4 rounded text-sm font-mono whitespace-pre-wrap border"></pre>
      </div>
    </div>

  </div>

  <script>
    // SSE para logs (puede iniciarse inmediatamente)
    const logsEventSource = new EventSource('/web/api/logs/stream');
    
    // Esperar a que el DOM esté listo
    function initDashboard() {
      const logsContainer = document.getElementById('logs-container');
      
      if (logsContainer) {
        logsEventSource.addEventListener('log', (e) => {
          const data = JSON.parse(e.data);
          const logEntry = document.createElement('div');
          logEntry.className = 'log-entry';
          logEntry.textContent = \`[\${new Date(data.timestamp).toLocaleTimeString()}] \${data.message}\`;
          logsContainer.appendChild(logEntry);
          logsContainer.scrollTop = logsContainer.scrollHeight;
        });

        logsEventSource.addEventListener('connected', (e) => {
          const data = JSON.parse(e.data);
          const logEntry = document.createElement('div');
          logEntry.className = 'log-entry text-green-500';
          logEntry.textContent = data.message;
          logsContainer.appendChild(logEntry);
        });

        // SSE para mensajes de grupos
        logsEventSource.addEventListener('message', (e) => {
          const data = JSON.parse(e.data);
          const msgEntry = document.createElement('div');
          msgEntry.className = 'log-entry text-yellow-300';
          msgEntry.innerHTML = \`<span class="text-gray-500">[\${new Date(data.timestamp).toLocaleTimeString()}]</span> 📨 <span class="text-blue-300">\${data.group}</span> - <span class="text-green-300">\${data.sender}</span>: \${data.content.substring(0, 80)}\${data.content.length > 80 ? '...' : ''}\`;
          logsContainer.appendChild(msgEntry);
          logsContainer.scrollTop = logsContainer.scrollHeight;
        });
      }

    // SSE para QR
    const qrEventSource = new EventSource('/web/api/qr/stream');
    
    qrEventSource.addEventListener('qr', (e) => {
      const data = JSON.parse(e.data);
      const qrDisplay = document.getElementById('qr-display');
      const qrContainer = document.getElementById('qr-container');
      
      if (data.qrCode && typeof QRCode !== 'undefined') {
        // Generar QR visual usando qrcode.js
        qrDisplay.innerHTML = '<canvas id="qr-canvas" class="mx-auto"></canvas><p class="text-sm text-gray-500 mt-2 text-center">Escanea este código con WhatsApp</p>';
        const canvas = document.getElementById('qr-canvas');
        if (canvas) {
          QRCode.toCanvas(canvas, data.qrCode, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          }, (err) => {
            if (err) {
              // Fallback a mensaje de error
              qrDisplay.innerHTML = '<p class="text-red-500">Error al generar QR: ' + err.message + '</p>';
            }
          });
        }
        qrContainer.classList.remove('hidden');
      } else if (data.qr) {
        // Fallback: mostrar QR como texto
        qrDisplay.innerHTML = '<pre class="text-xs font-mono whitespace-pre">' + data.qr + '</pre><p class="text-sm text-gray-500 mt-2">Escanea este código con WhatsApp</p>';
        qrContainer.classList.remove('hidden');
      } else if (data.message) {
        qrDisplay.innerHTML = '<p class="text-gray-500">' + data.message + '</p>';
        qrContainer.classList.remove('hidden');
      } else if (data.error) {
        qrDisplay.innerHTML = '<p class="text-red-500">Error: ' + data.error + '</p>';
        qrContainer.classList.remove('hidden');
      }
    });

    // Cargar estado de conexión una sola vez al inicio
    // (Se actualiza automáticamente cuando el usuario hace acciones como conectar/desconectar)
    fetch('/web/api/status')
      .then(res => res.json())
      .then(data => {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
          statusEl.innerHTML = \`
            <span class="text-2xl">\${data.isConnected ? '✅' : '❌'}</span>
            <span class="text-lg font-medium">\${data.state === 'connected' ? 'Conectado' : data.state === 'connecting' ? 'Conectando...' : 'Desconectado'}</span>
          \`;
        }
      });

    // Cargar estado de Google Drive Storage
    loadStorageStatus();
    
    function loadStorageStatus() {
      fetch('/web/api/storage/status')
        .then(res => res.json())
        .then(data => {
          const statusEl = document.getElementById('storage-status');
          const actionsEl = document.getElementById('storage-actions');
          const oauthFlow = document.getElementById('oauth-flow');
          
          if (statusEl) {
            if (data.drive) {
              // Google Drive está conectado
              statusEl.innerHTML = \`
                <div class="flex items-center gap-2">
                  <span class="text-2xl">✅</span>
                  <div>
                    <p class="text-green-600 font-medium">Google Drive conectado</p>
                    <p class="text-sm text-gray-500">Método: \${data.authMethod === 'oauth' ? 'OAuth (tu cuenta)' : 'Service Account'}</p>
                    \${data.userEmail ? '<p class="text-sm text-gray-500">Usuario: ' + data.userEmail + '</p>' : ''}
                  </div>
                </div>
              \`;
              if (actionsEl) {
                actionsEl.innerHTML = data.authMethod === 'oauth' 
                  ? '<button onclick="disconnectDrive()" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Desconectar Google Drive</button>'
                  : '';
              }
              if (oauthFlow) oauthFlow.classList.add('hidden');
            } else {
              // Google Drive no está conectado
              statusEl.innerHTML = \`
                <div class="flex items-center gap-2">
                  <span class="text-2xl">💾</span>
                  <div>
                    <p class="text-gray-600 font-medium">Solo almacenamiento local</p>
                    <p class="text-sm text-gray-500">Los archivos se guardan en el servidor</p>
                  </div>
                </div>
              \`;
              if (actionsEl) {
                actionsEl.innerHTML = '<button onclick="startOAuthFlow()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">🔗 Conectar Google Drive</button>';
              }
            }
          }
        })
        .catch(err => {
          const statusEl = document.getElementById('storage-status');
          if (statusEl) {
            statusEl.innerHTML = '<p class="text-red-500">❌ Error: ' + err.message + '</p>';
          }
        });
    }

    // Iniciar flujo OAuth
    window.startOAuthFlow = function() {
      const oauthFlow = document.getElementById('oauth-flow');
      const urlContainer = document.getElementById('oauth-url-container');
      const notConfigured = document.getElementById('oauth-not-configured');
      
      if (oauthFlow) oauthFlow.classList.remove('hidden');
      
      fetch('/web/api/oauth/authorize')
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            if (notConfigured) notConfigured.classList.remove('hidden');
            if (urlContainer) urlContainer.classList.add('hidden');
          } else {
            if (urlContainer) urlContainer.classList.remove('hidden');
            if (notConfigured) notConfigured.classList.add('hidden');
            
            const urlInput = document.getElementById('oauth-url');
            const urlLink = document.getElementById('oauth-url-link');
            if (urlInput) urlInput.value = data.authUrl;
            if (urlLink) urlLink.href = data.authUrl;
          }
        })
        .catch(err => {
          alert('Error: ' + err.message);
        });
    };

    // Copiar URL de OAuth
    window.copyOAuthUrl = function() {
      const urlInput = document.getElementById('oauth-url');
      if (urlInput) {
        urlInput.select();
        document.execCommand('copy');
        alert('URL copiada al portapapeles');
      }
    };

    // Enviar código OAuth
    window.submitOAuthCode = function() {
      const codeInput = document.getElementById('oauth-code');
      const errorEl = document.getElementById('oauth-error');
      const successEl = document.getElementById('oauth-success');
      const submitBtn = document.getElementById('submit-oauth-btn');
      
      if (!codeInput || !codeInput.value.trim()) {
        if (errorEl) {
          errorEl.textContent = 'Por favor, pega el código de autorización';
          errorEl.classList.remove('hidden');
        }
        return;
      }
      
      if (submitBtn) submitBtn.disabled = true;
      if (errorEl) errorEl.classList.add('hidden');
      if (successEl) successEl.classList.add('hidden');
      
      fetch('/web/api/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput.value.trim() })
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            if (errorEl) {
              errorEl.textContent = data.error;
              errorEl.classList.remove('hidden');
            }
            if (submitBtn) submitBtn.disabled = false;
          } else {
            if (successEl) {
              successEl.textContent = '¡Autorización exitosa! Google Drive conectado.';
              successEl.classList.remove('hidden');
            }
            // Recargar estado después de 1 segundo
            setTimeout(function() {
              loadStorageStatus();
              const oauthFlow = document.getElementById('oauth-flow');
              if (oauthFlow) oauthFlow.classList.add('hidden');
            }, 1500);
          }
        })
        .catch(err => {
          if (errorEl) {
            errorEl.textContent = 'Error: ' + err.message;
            errorEl.classList.remove('hidden');
          }
          if (submitBtn) submitBtn.disabled = false;
        });
    };

    // Desconectar Google Drive
    window.disconnectDrive = function() {
      if (!confirm('¿Seguro que quieres desconectar Google Drive?')) return;
      
      fetch('/web/api/oauth/revoke', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            loadStorageStatus();
          } else {
            alert('Error: ' + (data.error || 'No se pudo desconectar'));
          }
        })
        .catch(err => {
          alert('Error: ' + err.message);
        });
    };

    // Cargar grupos disponibles cuando se abre el modal
    function loadAvailableGroups() {
      const groupsListEl = document.getElementById('available-groups-list');
      
      if (!groupsListEl) {
        return;
      }

      groupsListEl.innerHTML = '<p class="text-gray-500">Cargando grupos disponibles...</p>';

      fetch('/web/api/groups/available')
        .then(res => {
          if (!res.ok) {
            throw new Error('HTTP ' + res.status + ': ' + res.statusText);
          }
          return res.json();
        })
        .then(data => {
          if (data.error) {
            groupsListEl.innerHTML = '<div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-2"><p class="text-yellow-800 text-sm">⚠️ ' + data.error + '</p></div>';
            return;
          }

          if (!data.groups || data.groups.length === 0) {
            groupsListEl.innerHTML = '<p class="text-gray-500">No hay grupos disponibles.</p>';
            return;
          }

          let html = '<div class="space-y-2">';
          data.groups.forEach(function(group) {
            const isMonitored = group.isMonitored || false;
            html += \`
              <div class="flex items-center justify-between p-3 border rounded \${isMonitored ? 'bg-gray-100' : ''}">
                <div class="flex-1">
                  <p class="font-medium">\${group.name}</p>
                  \${group.participants ? '<p class="text-sm text-gray-500">' + group.participants + ' participantes</p>' : ''}
                </div>
                <div>
                  \${isMonitored 
                    ? '<span class="text-green-600 text-sm">✓ Monitoreado</span>' 
                    : '<button onclick="addGroup(\\'' + group.name.replace(/'/g, "\\'") + '\\', \\'' + (group.jid || '').replace(/'/g, "\\'") + '\\')" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">Agregar</button>'
                  }
                </div>
              </div>
            \`;
          });
          html += '</div>';
          groupsListEl.innerHTML = html;
        })
        .catch(err => {
          console.error('Error al cargar grupos:', err);
          const errorMsg = err && err.message ? err.message : 'Error desconocido';
          groupsListEl.innerHTML = '<div class="bg-red-50 border border-red-200 rounded p-3"><p class="text-red-800 text-sm">❌ Error al cargar grupos: ' + errorMsg + '</p></div>';
        });
    }

    // Función para agregar grupo
    function addGroup(name, jid) {
      fetch('/web/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, jid })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Cerrar modal
            document.getElementById('add-group-modal')?.classList.add('hidden');
            // Recargar lista de grupos monitoreados
            htmx.trigger('#groups-list', 'refresh');
            // Actualizar contador
            updateGroupsCount();
            // Recargar grupos disponibles
            loadAvailableGroups();
          } else {
            alert('Error: ' + (data.error || 'Error desconocido'));
          }
        })
        .catch(err => {
          alert('Error al agregar grupo: ' + err.message);
        });
    }

    // Detectar cuando se abre el modal de agregar grupo
    const addGroupButton = document.querySelector('[onclick*="add-group-modal"]');
    if (addGroupButton) {
      addGroupButton.addEventListener('click', () => {
        setTimeout(loadAvailableGroups, 100); // Pequeño delay para asegurar que el modal está visible
      });
    }

    // También detectar apertura del modal directamente
    const addGroupModal = document.getElementById('add-group-modal');
    if (addGroupModal) {
      // Usar MutationObserver para detectar cuando el modal se hace visible
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            if (!target.classList.contains('hidden')) {
              loadAvailableGroups();
            }
          }
        });
      });
      observer.observe(addGroupModal, { attributes: true, attributeFilter: ['class'] });
    }

    // Función para actualizar contador de grupos
    function updateGroupsCount() {
      fetch('/web/api/groups')
        .then(function(res) { return res.text(); })
        .then(function(html) {
          const countEl = document.getElementById('groups-count');
          if (countEl) {
            // Contar elementos li en el HTML
            const matches = html.match(/<li/g);
            countEl.textContent = matches ? matches.length : '0';
          }
        });
    }

    // Función para actualizar contador de categorías
    function updateCategoriesCount() {
      fetch('/web/api/categories')
        .then(function(res) { return res.text(); })
        .then(function(html) {
          const countEl = document.getElementById('categories-count');
          if (countEl) {
            // Contar elementos li en el HTML
            const matches = html.match(/<li/g);
            countEl.textContent = matches ? matches.length : '0';
          }
        });
    }

    // Exponer funciones globalmente
    window.addGroup = addGroup;
    window.loadAvailableGroups = loadAvailableGroups;
    window.updateGroupsCount = updateGroupsCount;
    window.updateCategoriesCount = updateCategoriesCount;


    // ==========================================
    // Funciones globales para categorías
    // ==========================================
    
    // Crear categoría
    function createCategory(event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const enabledFields = Array.from(formData.getAll('enabledFields'));
      if (!enabledFields.includes('CONTENIDO')) enabledFields.push('CONTENIDO');
      
      const separator = formData.get('separator') || ',,';
      if (separator.length < 1 || separator.length > 3) {
        alert('El separador debe tener entre 1 y 3 caracteres');
        return;
      }
      
      fetch('/web/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description') || undefined,
          enabledFields,
          separator
        })
      })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            document.getElementById('add-category-modal').classList.add('hidden');
            event.target.reset();
            htmx.trigger('#categories-list', 'refresh');
            // Actualizar contador
            updateCategoriesCount();
          } else {
            alert('Error: ' + (d.error || 'Error desconocido'));
          }
        });
    }

    // Actualizar categoría (campos y separador)
    function updateCategory(event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const enabledFields = Array.from(formData.getAll('enabledFields'));
      if (!enabledFields.includes('CONTENIDO')) enabledFields.push('CONTENIDO');
      
      const separator = formData.get('separator') || ',,';
      if (separator.length < 1 || separator.length > 3) {
        alert('El separador debe tener entre 1 y 3 caracteres');
        return;
      }
      
      const categoryName = event.target.dataset.categoryName;
      
      fetch('/web/api/categories/' + encodeURIComponent(categoryName) + '/fields', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledFields, separator })
      })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            document.getElementById('configure-fields-modal').classList.add('hidden');
            htmx.trigger('#categories-list', 'refresh');
          } else {
            alert('Error: ' + (d.error || 'Error desconocido'));
          }
        });
    }

    // Eliminar categoría
    function deleteCategory(name) {
      if (confirm('¿Eliminar categoría "' + name + '"?\\n\\n¿También eliminar el archivo markdown asociado?')) {
        fetch('/web/api/categories/' + encodeURIComponent(name), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleteFile: true })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              htmx.trigger('#categories-list', 'refresh');
            } else {
              alert('Error: ' + (data.error || 'Error desconocido'));
            }
          });
      }
    }

    // Abrir modal de configuración desde el botón (usando data attributes)
    function openConfigureFieldsModalFromButton(button) {
      const name = button.dataset.category;
      const fieldsBase64 = button.dataset.fields;
      const separator = button.dataset.separator;
      
      let fields = ['CONTENIDO'];
      try {
        fields = JSON.parse(atob(fieldsBase64));
      } catch (e) {
        console.error('Error parsing fields:', e);
      }
      
      openConfigureFieldsModal(name, fields, separator);
    }

    // Abrir modal de configuración
    function openConfigureFieldsModal(name, currentFields, currentSeparator) {
      const modal = document.getElementById('configure-fields-modal');
      const form = document.getElementById('configure-fields-form');
      if (!modal || !form) {
        alert('Error: Modal no encontrado. Recarga la página.');
        return;
      }
      form.dataset.categoryName = name;
      
      // Parsear currentFields si es string
      let fields = currentFields;
      if (typeof currentFields === 'string') {
        try {
          fields = JSON.parse(currentFields);
        } catch (e) {
          fields = ['CONTENIDO'];
        }
      }
      
      // Marcar campos actuales
      const checkboxes = form.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = fields.includes(cb.value);
      });
      
      // Establecer separador actual
      const separatorInput = document.getElementById('configure-separator-input');
      if (separatorInput) {
        separatorInput.value = currentSeparator || ',,';
      }
      
      modal.classList.remove('hidden');
    }

    // Ver markdown de categoría
    function viewCategoryMarkdown(name) {
      fetch('/web/api/categories/' + encodeURIComponent(name) + '/markdown')
        .then(res => {
          if (!res.ok) {
            return res.text().then(text => { throw new Error(text); });
          }
          return res.text();
        })
        .then(content => {
          const modal = document.getElementById('view-markdown-modal');
          const contentEl = document.getElementById('markdown-content');
          const titleEl = document.getElementById('markdown-modal-title');
          if (modal && contentEl && titleEl) {
            titleEl.textContent = 'Categoría: ' + name;
            contentEl.textContent = content;
            modal.classList.remove('hidden');
          }
        })
        .catch(err => {
          alert('Error: ' + err.message);
        });
    }

    // Copiar markdown
    function copyMarkdown() {
      const contentEl = document.getElementById('markdown-content');
      if (contentEl) {
        navigator.clipboard.writeText(contentEl.textContent || '')
          .then(() => {
            const btn = document.getElementById('copy-markdown-btn');
            if (btn) {
              const originalText = btn.textContent;
              btn.textContent = '✓ Copiado!';
              setTimeout(() => {
                btn.textContent = originalText;
              }, 2000);
            }
          })
          .catch(err => {
            alert('Error al copiar: ' + err.message);
          });
      }
    }

    // ==========================================
    // Exponer funciones globalmente para HTMX
    // ==========================================
    window.createCategory = createCategory;
    window.updateCategory = updateCategory;
    window.deleteCategory = deleteCategory;
    window.openConfigureFieldsModal = openConfigureFieldsModal;
    window.openConfigureFieldsModalFromButton = openConfigureFieldsModalFromButton;
    window.viewCategoryMarkdown = viewCategoryMarkdown;
    window.copyMarkdown = copyMarkdown;
    // Funciones para mostrar guías (si se necesitan en el futuro)
    window.showServiceAccountGuide = function() {
      const guideEl = document.getElementById('storage-setup-guide');
      if (guideEl) {
        guideEl.classList.remove('hidden');
      }
    };
    window.showGoogleDriveSetup = function() {
      const guideEl = document.getElementById('storage-setup-guide');
      if (guideEl) {
        guideEl.classList.remove('hidden');
      }
    };
    }
    
    // Ejecutar inmediatamente si el DOM ya está listo, o esperar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
      initDashboard();
    }
  </script>
</body>
</html>`;
}

