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

    <!-- Grupos Monitoreados -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Grupos Monitoreados (${groups.length})</h2>
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
        <h2 class="text-xl font-semibold">Categorías (${categories.length})</h2>
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
              pattern="[A-Za-z0-9_-]+"
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

    <!-- OAuth Google Drive -->
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Google Drive Sync</h2>
      <button 
        hx-get="/web/api/oauth/googledrive/start"
        class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Conectar con Google Drive
      </button>
    </div>
  </div>

  <script>
    // SSE para logs
    const logsEventSource = new EventSource('/web/api/logs/stream');
    const logsContainer = document.getElementById('logs-container');
    
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

    // Actualizar estado cada 2 segundos
    setInterval(() => {
      fetch('/web/api/status')
        .then(res => res.json())
        .then(data => {
          const statusEl = document.getElementById('connection-status');
          statusEl.innerHTML = \`
            <span class="text-2xl">\${data.isConnected ? '✅' : '❌'}</span>
            <span class="text-lg font-medium">\${data.state === 'connected' ? 'Conectado' : data.state === 'connecting' ? 'Conectando...' : 'Desconectado'}</span>
          \`;
        });
    }, 2000);

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
  </script>
</body>
</html>`;
}

