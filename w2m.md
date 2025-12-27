# W2M - Documentación Técnica Completa

> **Documentación técnica completa** - Este documento describe la arquitectura, funcionamiento, flujos y estructura completa de W2M. Diseñado para que LLMs y humanos puedan comprender y desarrollar el sistema eficientemente.

**Última actualización:** 2025-12-27

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Componentes Principales](#componentes-principales)
5. [Flujos de Datos](#flujos-de-datos)
6. [Sistema de Plugins](#sistema-de-plugins)
7. [Sistema de Almacenamiento](#sistema-de-almacenamiento)
8. [Gestión de Grupos](#gestión-de-grupos)
9. [Sistema de Categorías](#sistema-de-categorías)
10. [Interfaz de Línea de Comandos (CLI)](#interfaz-de-línea-de-comandos-cli)
11. [Dashboard Web](#dashboard-web)
12. [Configuración](#configuración)
13. [Docker y Deployment](#docker-y-deployment)
14. [CI/CD](#cicd)
15. [Formato de Datos](#formato-de-datos)
16. [Guía para LLMs](#guía-para-llms)

---

## 🎯 Visión General

W2M (WhatsApp to Markdown) es un **framework modular y extensible** diseñado para capturar mensajes efímeros de plataformas de mensajería y transformarlos en archivos Markdown estructurados, listos para ser consumidos por herramientas de Personal Knowledge Management (PKM) como Obsidian, Logseq, VS Code, etc.

### Características Principales

- **Arquitectura Modular**: El core es agnóstico de plataformas. Los plugins (como Baileys para WhatsApp) son opcionales.
- **Sistema de Categorías**: Los mensajes pueden categorizarse automáticamente usando el formato `CATEGORIA<separador>contenido`.
- **Gestión de Grupos**: Permite monitorear grupos específicos de forma persistente.
- **CLI Interactivo**: Interfaz de línea de comandos con menús anidados.
- **Dashboard Web**: Interfaz gráfica ligera para configuración y monitoreo en tiempo real.
- **Almacenamiento Híbrido**: Soporte para almacenamiento local, Google Drive (OAuth o Service Account), y Git.
- **Docker Ready**: Soporte completo para desarrollo y producción con Docker.
- **CI/CD**: Pipeline automatizado para deployment a EC2.

### Principios de Diseño

1. **Modularidad**: El core no depende de implementaciones específicas de plataformas.
2. **Extensibilidad**: Fácil agregar nuevos plugins mediante interfaces (`IngestorInterface`, `StorageInterface`).
3. **Persistencia**: Los datos (grupos, categorías) se guardan en JSON.
4. **Separación de Responsabilidades**: Cada componente tiene una responsabilidad clara.
5. **Almacenamiento Híbrido**: Siempre guarda localmente primero, sincroniza remotamente después.

---

## 🏗️ Arquitectura del Sistema

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                     W2M Core                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   CLI        │  │  Web Server  │  │  Group Mgmt  │ │
│  │              │  │  (Hono)      │  │  Category    │ │
│  │              │  │              │  │  Writer      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ IngestorInterface│  │ StorageInterface│  │  Config/Logger  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         │                    │
    ┌────┴────┐         ┌────┴────┐
    │         │         │         │
    ▼         ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Baileys │ │Plugin2 │ │ Local  │ │Google  │
│Plugin  │ │ (TBD)  │ │Storage │ │Drive   │
└────────┘ └────────┘ └────────┘ └────────┘
```

### Capas del Sistema

1. **Capa de Presentación**: 
   - CLI interactivo (`src/cli/`)
   - Dashboard Web (`src/web/`)
2. **Capa de Lógica de Negocio**: Core (`src/core/`)
   - Gestión de grupos
   - Gestión de categorías
   - Escritura de markdown
3. **Capa de Integración**: Plugins (`src/plugins/`)
   - Ingestores (implementaciones de `IngestorInterface`)
   - Storage (implementaciones de `StorageInterface`)
4. **Capa de Infraestructura**: Config, Logger, Utils (`src/config/`, `src/utils/`)

---

## 📁 Estructura del Proyecto

```
w2m/
├── src/
│   ├── index.ts                 # Entry point principal
│   ├── cli/
│   │   └── index.ts             # CLI interactivo con menús
│   ├── core/
│   │   ├── ingestor/
│   │   │   ├── interface.ts     # IngestorInterface (contrato)
│   │   │   └── factory.ts       # Factory para crear ingestores
│   │   ├── storage/
│   │   │   ├── interface.ts     # StorageInterface (contrato)
│   │   │   └── factory.ts      # Factory para crear storage
│   │   ├── groups/
│   │   │   └── index.ts         # GroupManager (persistencia de grupos)
│   │   └── categories/
│   │       ├── index.ts         # CategoryManager (gestión de categorías)
│   │       └── writer.ts        # CategoryWriter (escritura de markdown)
│   ├── plugins/
│   │   ├── baileys/
│   │   │   └── index.ts         # Implementación Baileys (WhatsApp)
│   │   └── storage/
│   │       ├── local/
│   │       │   └── index.ts      # LocalStorage (filesystem)
│   │       ├── googledrive/
│   │       │   ├── index.ts      # GoogleDriveStorage
│   │       │   ├── oauth.ts      # OAuth para Google Drive
│   │       │   └── service-account.ts  # Service Account auth
│   │       └── git/
│   │           └── index.ts      # GitStorage (placeholder)
│   ├── web/
│   │   ├── index.ts              # Servidor web (Hono)
│   │   ├── routes.ts             # Rutas del dashboard
│   │   ├── sse.ts                # Server-Sent Events
│   │   └── templates/
│   │       ├── dashboard.ts      # Template principal
│   │       ├── groups.ts         # Template de grupos
│   │       └── categories.ts     # Template de categorías
│   ├── config/
│   │   └── index.ts              # Gestión de configuración (Zod)
│   └── utils/
│       ├── logger.ts            # Logger (Pino)
│       └── logger-sse.ts        # Integración logger con SSE
├── data/                        # Datos generados (no en git)
│   ├── session/                 # Sesiones de WhatsApp
│   ├── vault/                   # Archivos markdown generados
│   │   ├── categories/          # Archivos por categoría
│   │   └── .google-oauth-tokens.json  # Tokens OAuth
│   ├── googledrive/             # Credenciales Google Drive
│   │   ├── service-account.json # Service Account (opcional)
│   │   └── oauth-credentials.json  # OAuth credentials (opcional)
│   ├── monitored-groups.json   # Grupos monitoreados
│   └── categories.json          # Configuración de categorías
├── scripts/
│   ├── dev.sh                   # Script desarrollo
│   ├── test-production-local.sh # Test producción local
│   └── entrypoint.sh            # Entrypoint Docker
├── docs/
│   ├── GOOGLE-DRIVE-OAUTH-SETUP.md  # Guía OAuth
│   └── GCP-SERVICE-ACCOUNT-SETUP.md # Guía Service Account
├── docker-compose.yml           # Docker Compose (todos los perfiles)
├── Dockerfile                   # Multi-stage build
├── package.json                 # Dependencias y scripts
├── tsconfig.json                # Configuración TypeScript
├── env.example                  # Ejemplo de variables de entorno
├── w2m.md                       # Este documento
└── README.md                    # Documentación usuario
```

---

## 🔧 Componentes Principales

### 1. Entry Point (`src/index.ts`)

**Responsabilidad**: Inicializar el sistema y coordinar componentes.

**Flujo de Inicialización**:

```typescript
1. GroupManager.load() → Lee ./data/monitored-groups.json
2. CategoryManager.load() → Lee ./data/categories.json
3. createStorage() → Crea storage según STORAGE_TYPE
4. storage.initialize() → Inicializa storage (local siempre, Drive opcional)
5. createIngestor() → Carga plugin según INGESTOR_TYPE
6. ingestor.initialize() → Inicializa plugin
7. startWebServer() → Inicia servidor web (si WEB_ENABLED)
8. W2MCLI.start() → Inicia CLI
9. ingestor.start() → Intenta conectar (silenciosamente)
```

**Manejo de Señales**:
- `SIGTERM`: Cerrar ingestor, web server y salir
- `SIGINT`: Manejado por CLI, pero también aquí como fallback

### 2. CLI (`src/cli/index.ts`)

**Clase**: `W2MCLI`

**Responsabilidades**:
- Mostrar menú interactivo
- Procesar entrada del usuario
- Gestionar menús anidados (grupos, categorías)
- Mostrar mensajes en tiempo real
- Coordinar operaciones entre componentes

**Estado Interno**:
- `isInSubMenu: boolean` - Flag para evitar conflictos de entrada entre menús

**Menú Principal**:
```
1) QR              - Generar código QR para conectar
2) Estado          - Mostrar estado de conexión
3) Desconectar     - Desconectar del servicio
4) Grupos (N)      - Gestionar grupos monitoreados
5) Categorías (N)   - Gestionar categorías
6) Salir           - Cerrar aplicación
```

**Submenú de Grupos**:
```
1) Listar grupos disponibles y agregar
2) Remover grupo monitoreado
3) Volver al menú principal
```

**Submenú de Categorías**:
```
1) Crear categoría
2) Eliminar categoría
3) Configurar campos de categoría
4) Configurar separador de categoría
5) Volver al menú principal
```

**Manejo de Mensajes**:
- Los mensajes se muestran inmediatamente cuando llegan
- Se pausa el readline para mostrar el mensaje sin interferir con el prompt
- Formato: `Group: [nombre]`, `Sender: [autor]`, `Time: [hora]`, `Message: [contenido]`

### 3. Ingestor Interface (`src/core/ingestor/interface.ts`)

**Interfaz**: `IngestorInterface`

**Contrato que todos los plugins deben implementar**:

```typescript
interface IngestorInterface {
  initialize(): Promise<void>;           // Inicializar recursos
  start(): Promise<void>;                // Iniciar conexión
  stop(): Promise<void>;                 // Detener conexión
  generateQR(): Promise<void>;           // Generar QR (si aplica)
  isConnected(): boolean;                // Estado de conexión
  getConnectionState(): ConnectionState; // Estado detallado
  onConnected(callback: () => void): void; // Callback conexión
  onMessage(callback: (message: Message) => void): void; // Callback mensajes
  listGroups(): Promise<Group[]>;        // Listar grupos disponibles
}
```

**Tipos de Datos**:

```typescript
interface Message {
  group: string;    // Nombre del grupo
  sender: string;   // Nombre del remitente
  time: string;     // Formato: "HH:MM:SS - DD/MM/YYYY"
  content: string;  // Contenido del mensaje
}

interface Group {
  name: string;           // Nombre del grupo
  jid?: string;          // ID del grupo (opcional)
  participants?: number; // Número de participantes (opcional)
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected';
```

### 4. Storage Interface (`src/core/storage/interface.ts`)

**Interfaz**: `StorageInterface`

**Contrato que todos los sistemas de almacenamiento deben implementar**:

```typescript
interface StorageInterface {
  initialize(): Promise<void>;                    // Inicializar storage
  saveFile(path: string, content: string): Promise<void>;  // Guardar archivo
  readFile(path: string): Promise<string | null>; // Leer archivo
  exists(path: string): Promise<boolean>;         // Verificar existencia
  deleteFile(path: string): Promise<void>;        // Eliminar archivo
  listFiles(path: string): Promise<string[]>;     // Listar archivos
}
```

**Principio**: Upload unidireccional - W2M solo empuja cambios, no sincroniza desde remoto.

### 5. Plugin Baileys (`src/plugins/baileys/index.ts`)

**Clase**: `BaileysIngestor implements IngestorInterface`

**Dependencias Opcionales**:
- `@whiskeysockets/baileys`: Cliente WhatsApp WebSocket
- `@hapi/boom`: Manejo de errores
- `qrcode-terminal`: Mostrar QR en terminal

**Características**:
- Conexión automática si hay credenciales guardadas
- Generación de QR solo cuando se solicita explícitamente (flag `shouldDisplayQR`)
- Filtrado de mensajes por grupos monitoreados
- Detección de mensajes históricos (ignora mensajes > 2 minutos de antigüedad)
- Manejo de reconexión automática
- Sincronización inicial (ignora mensajes durante primeros 3 segundos)
- Integración con SSE para enviar QR al dashboard web
- **Sistema de comandos vía WhatsApp**: Detecta "menu,," o "menu" y responde con menú interactivo
- **Envío de mensajes**: Implementa `sendMessageToGroup()` para responder comandos

**Flujo de Conexión**:
1. `start()`: Intenta conectar con credenciales guardadas (no muestra QR)
2. `generateQR()`: Fuerza nueva conexión y muestra QR
3. Eventos `connection.update`: Maneja estados (connecting, open, close, qr)
4. Eventos `messages.upsert`: Procesa mensajes nuevos

**Filtrado de Mensajes**:
- Solo grupos (`@g.us`)
- Solo grupos monitoreados (usando `GroupManager`)
- Ignora mensajes históricos
- Ignora mensajes durante sincronización inicial

### 6. Group Manager (`src/core/groups/index.ts`)

**Clase**: `GroupManager`

**Responsabilidad**: Gestionar persistencia de grupos monitoreados.

**Persistencia**: `./data/monitored-groups.json`

**Estructura de Datos**:
```json
[
  {
    "name": "Nombre del Grupo",
    "jid": "1234567890-1234567890@g.us"
  }
]
```

**Métodos Principales**:
- `load()`: Cargar grupos desde JSON
- `save()`: Guardar grupos a JSON
- `addGroup(name, jid?)`: Agregar grupo
- `removeGroup(name)`: Remover grupo
- `getAllGroups()`: Obtener todos los grupos
- `isMonitored(name)`: Verificar si un grupo está monitoreado

### 7. Category Manager (`src/core/categories/index.ts`)

**Clase**: `CategoryManager`

**Responsabilidad**: Gestionar configuración de categorías.

**Persistencia**: `./data/categories.json`

**Estructura de Datos**:
```json
{
  "categories": {
    "code": {
      "name": "code",
      "description": "Código y snippets",
      "enabledFields": ["AUTOR", "HORA", "FECHA", "CONTENIDO"],
      "separator": ",,"
    }
  }
}
```

**Campos Disponibles**:
- `AUTOR`: Nombre del remitente
- `HORA`: Hora del mensaje
- `FECHA`: Fecha del mensaje
- `CONTENIDO`: Contenido del mensaje

**Separador**: Cada categoría puede tener un separador personalizado (1-3 caracteres, default: `,,`)

**Métodos Principales**:
- `load()`: Cargar categorías desde JSON
- `save()`: Guardar categorías a JSON
- `addCategory(name, description, enabledFields, separator)`: Crear categoría
- `removeCategory(name)`: Eliminar categoría
- `updateCategory(name, updates)`: Actualizar categoría
- `getCategory(name)`: Obtener categoría
- `getAllCategories()`: Obtener todas las categorías
- `detectCategory(messageContent)`: Detectar categoría en mensaje
- `getCategoryMarkdownRelativePath(name)`: Obtener ruta relativa del archivo markdown

### 8. Category Writer (`src/core/categories/writer.ts`)

**Clase**: `CategoryWriter`

**Responsabilidad**: Escribir mensajes categorizados en archivos markdown usando `StorageInterface`.

**Formato de Markdown**:

```markdown
# CATEGORIA: Code

## Mensaje #1

**AUTOR:** Juan Pérez  
**HORA:** 14:30:15  
**FECHA:** 27/12/2025  
**CONTENIDO:**  
```python
def hello():
    print("Hello")
```

---

## Mensaje #2

**AUTOR:** María García  
**HORA:** 15:45:22  
**FECHA:** 27/12/2025  
**CONTENIDO:**  
Aquí está el código que necesitabas.

---
```

**Características**:
- Preserva mensajes existentes al agregar nuevos
- Ordena mensajes por timestamp (más reciente primero)
- Evita duplicados (compara contenido, sender, timestamp)
- Formato legible para humanos y LLMs
- Parseo bidireccional (puede leer archivos existentes)
- Usa `StorageInterface` para abstraer el almacenamiento

**Ruta de Archivos**: `VAULT_PATH/categories/{categoria}.md`

### 9. Storage Implementations

#### LocalStorage (`src/plugins/storage/local/index.ts`)

**Clase**: `LocalStorage implements StorageInterface`

**Características**:
- Usa filesystem local (`fs/promises`)
- Base path: `VAULT_PATH`
- Operaciones síncronas y rápidas
- Siempre disponible (no requiere configuración)

#### GoogleDriveStorage (`src/plugins/storage/googledrive/index.ts`)

**Clase**: `GoogleDriveStorage implements StorageInterface`

**Características**:
- **Almacenamiento Híbrido**: Siempre guarda localmente primero, luego sincroniza a Drive
- **Dos Métodos de Autenticación**:
  1. **OAuth** (recomendado): Usa tu cuenta personal de Google Drive (15 GB gratis)
  2. **Service Account**: Para Google Workspace / Shared Drives
- **Prioridad**: OAuth tiene prioridad sobre Service Account
- **Auto-deshabilitación**: Si Drive falla, continúa solo con almacenamiento local
- **Carpeta W2M**: Crea o busca carpeta "W2M" en Google Drive

**OAuth Flow** (`src/plugins/storage/googledrive/oauth.ts`):
1. Genera URL de autorización
2. Usuario abre URL en navegador
3. Usuario autoriza y copia código
4. Intercambia código por tokens
5. Tokens se guardan en `./data/vault/.google-oauth-tokens.json`
6. Auto-refresh de tokens

**Service Account** (`src/plugins/storage/googledrive/service-account.ts`):
- Autenticación usando JSON key file
- Requiere carpeta compartida (Service Accounts no tienen cuota propia)

### 11. Web Dashboard (`src/web/`)

**Stack Tecnológico**:
- **Hono**: Framework web ligero
- **HTMX**: Actualizaciones dinámicas sin JavaScript complejo
- **TailwindCSS (CDN)**: Estilos
- **Server-Sent Events (SSE)**: Logs y QR en tiempo real

**Rutas Principales**:
- `GET /web`: Dashboard principal
- `GET /web/api/status`: Estado de conexión
- `POST /web/api/qr/generate`: Generar QR
- `GET /web/api/groups/available`: Listar grupos disponibles
- `POST /web/api/groups`: Agregar grupo
- `DELETE /web/api/groups/:name`: Remover grupo
- `GET /web/api/categories`: Listar categorías
- `POST /web/api/categories`: Crear categoría
- `GET /web/api/categories/:name/markdown`: Ver markdown de categoría
- `GET /web/api/storage/status`: Estado de almacenamiento
- `GET /web/api/oauth/authorize`: Obtener URL de autorización OAuth
- `POST /web/api/oauth/callback`: Intercambiar código por tokens
- `POST /web/api/oauth/revoke`: Revocar tokens OAuth
- `GET /web/api/logs/stream`: Stream de logs (SSE)
- `GET /web/api/qr/stream`: Stream de QR (SSE)

**Características**:
- Estado de conexión en tiempo real
- Visualización de QR code
- Logs en tiempo real vía SSE
- Gestión de grupos y categorías
- Configuración de Google Drive (OAuth)
- Visualización de markdown de categorías

### 12. Config (`src/config/index.ts`)

**Responsabilidad**: Gestión centralizada de configuración.

**Tecnología**: Zod para validación y parsing.

**Variables de Configuración**:

```typescript
{
  // WhatsApp (genérico, usado por plugins)
  WA_SESSION_PATH: string;           // default: './data/session'
  WA_ALLOWED_GROUPS: string[];       // default: []
  WA_QR_TIMEOUT: number;             // default: 60000
  WA_RECONNECT_INTERVAL: number;     // default: 5000
  
  // Vault
  VAULT_PATH: string;                // default: './data/vault'
  VAULT_DATE_FORMAT: string;         // default: 'yyyy-MM-dd'
  VAULT_ENABLE_FRONTMATTER: boolean; // default: true
  
  // Git Sync
  GIT_ENABLED: boolean;               // default: false
  GIT_REMOTE: string;                 // default: 'origin'
  GIT_BRANCH: string;                 // default: 'main'
  GIT_COMMIT_PREFIX: string;          // default: '[W2M]'
  GIT_SYNC_INTERVAL: number;          // default: 300000
  
  // Feedback
  FEEDBACK_CONFIRMATIONS: boolean;    // default: true
  FEEDBACK_ERRORS: boolean;           // default: true
  FEEDBACK_RATE_LIMIT: number;        // default: 1000
  
  // Logging
  LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  LOG_FORMAT: 'json' | 'pretty';
  
  // Memory
  NODE_MAX_OLD_SPACE: number;         // default: 1024
  
  // Timezone
  TZ: string;                         // default: 'America/Santiago'
  
  // Web Dashboard
  WEB_ENABLED: boolean;               // default: true
  WEB_PORT: number;                   // default: 3000
  WEB_HOST: string;                   // default: '0.0.0.0'
  
  // Storage
  STORAGE_TYPE: 'local' | 'googledrive' | 'git';  // default: 'local'
  
  // Google Drive
  GOOGLE_SERVICE_ACCOUNT_PATH?: string;  // Opcional
  GOOGLE_DRIVE_FOLDER_ID?: string;      // Opcional
}
```

**Uso**: `getConfig()` retorna objeto tipado con todas las configuraciones.

### 13. Logger (`src/utils/logger.ts`)

**Tecnología**: Pino

**Características**:
- Formato JSON o Pretty según `LOG_FORMAT`
- Niveles configurables según `LOG_LEVEL`
- Structured logging para mejor parseo
- Integración con SSE para dashboard web

---

## 🔄 Flujos de Datos

### Flujo de Inicialización

```
1. index.ts ejecuta
   ↓
2. GroupManager.load() → Lee ./data/monitored-groups.json
   ↓
3. CategoryManager.load() → Lee ./data/categories.json
   ↓
4. createStorage() → Crea storage según STORAGE_TYPE
   ↓
5. storage.initialize() → Inicializa storage
   - LocalStorage: Crea directorios
   - GoogleDriveStorage: Autentica (OAuth o Service Account)
   ↓
6. createIngestor() → Carga plugin según INGESTOR_TYPE
   ↓
7. ingestor.initialize() → Inicializa plugin
   ↓
8. startWebServer() → Inicia servidor web (si WEB_ENABLED)
   ↓
9. W2MCLI.start() → Inicia CLI
   ↓
10. ingestor.start() → Intenta conectar (silenciosamente)
   ↓
11. Si hay credenciales → Conecta automáticamente
    Si no → Espera que usuario genere QR
```

### Flujo de Recepción de Mensajes

```
1. Plugin recibe mensaje (ej: Baileys events)
   ↓
2. Filtra: solo grupos monitoreados
   ↓
3. Filtra: ignora mensajes históricos (> 2 min)
   ↓
4. Extrae: group, sender, time, content
   ↓
5. Crea objeto Message
   ↓
6. Llama callbacks onMessage
   ↓
7. CLI recibe → CategoryWriter.processMessage()
   ↓
8. CategoryWriter detecta categoría (si aplica)
   ↓
9. Si tiene categoría → Escribe en markdown usando StorageInterface
   ↓
10. Storage guarda:
    - LocalStorage: Guarda en filesystem
    - GoogleDriveStorage: Guarda localmente + sincroniza a Drive
   ↓
11. CLI muestra mensaje en consola
```

### Flujo de Categorización

```
1. Mensaje llega con formato "CATEGORIA<separador>contenido"
   ↓
2. CategoryManager.detectCategory() analiza contenido
   ↓
3. Busca categoría por nombre (case-insensitive)
   ↓
4. Verifica separador de la categoría
   ↓
5. Si encuentra → Extrae { categoryName, content }
   ↓
6. CategoryWriter.appendToCategoryFile()
   ↓
7. Lee archivo existente usando StorageInterface
   ↓
8. Agrega mensaje (evita duplicados)
   ↓
9. Ordena por timestamp descendente
   ↓
10. Genera markdown con formato estructurado
   ↓
11. Escribe archivo usando StorageInterface.saveFile()
   ↓
12. Storage guarda:
    - LocalStorage: Guarda en filesystem
    - GoogleDriveStorage: Guarda localmente + sincroniza a Drive
```

### Flujo de OAuth Google Drive

```
1. Usuario hace clic en "Conectar Google Drive" en dashboard
   ↓
2. GET /web/api/oauth/authorize
   ↓
3. Sistema genera URL de autorización
   ↓
4. Dashboard muestra URL y campo para código
   ↓
5. Usuario abre URL en navegador
   ↓
6. Usuario autoriza en Google
   ↓
7. Google muestra código de autorización
   ↓
8. Usuario copia código y lo pega en dashboard
   ↓
9. POST /web/api/oauth/callback con código
   ↓
10. Sistema intercambia código por tokens
   ↓
11. Tokens se guardan en ./data/vault/.google-oauth-tokens.json
   ↓
12. storage.reinitializeDrive() → Reinicializa con OAuth
   ↓
13. GoogleDriveStorage ahora usa OAuth (tu cuenta personal)
```

### Flujo de Gestión de Grupos

```
Usuario selecciona opción 4 (Grupos)
   ↓
CLI.manageGroups() → isInSubMenu = true
   ↓
Muestra lista de grupos monitoreados
   ↓
Usuario selecciona opción (1-3)
   ↓
Si opción 1 (Agregar):
  - ingestor.listGroups() → Obtiene grupos disponibles
  - Muestra lista numerada
  - Usuario selecciona número
  - groupManager.addGroup() → Guarda en JSON
  - isInSubMenu = false → Vuelve al menú principal

Si opción 2 (Remover):
  - Muestra grupos monitoreados
  - Usuario selecciona número
  - groupManager.removeGroup() → Actualiza JSON
  - isInSubMenu = false → Vuelve al menú principal
```

### Flujo de Gestión de Categorías

```
Usuario selecciona opción 5 (Categorías)
   ↓
CLI.manageCategories() → isInSubMenu = true
   ↓
Muestra lista de categorías
   ↓
Usuario selecciona opción (1-5)
   ↓
Si opción 1 (Crear):
  - Pide nombre
  - Pide selección de campos (1-4)
  - Pide separador (1-3 caracteres, default: ,,)
  - Pide descripción (opcional)
  - categoryManager.addCategory() → Guarda en JSON
  - isInSubMenu = false

Si opción 2 (Eliminar):
  - Muestra categorías
  - Usuario selecciona número
  - Pregunta si eliminar archivo markdown
  - categoryManager.removeCategory()
  - Si sí → categoryManager.deleteCategoryMarkdown() usando StorageInterface
  - isInSubMenu = false

Si opción 3 (Configurar campos):
  - Muestra categorías
  - Usuario selecciona número
  - Muestra campos actuales
  - Usuario selecciona campos nuevos
  - categoryManager.updateCategory()
  - isInSubMenu = false

Si opción 4 (Configurar separador):
  - Muestra categorías
  - Usuario selecciona número
  - Pide nuevo separador (1-3 caracteres)
  - categoryManager.updateCategory()
  - isInSubMenu = false
```

---

## 🔌 Sistema de Plugins

### Crear un Nuevo Ingestor Plugin

**Paso 1**: Crear estructura en `src/plugins/{nombre-plugin}/`

```
src/plugins/{nombre-plugin}/
├── index.ts          # Implementación
└── README.md         # Documentación (opcional)
```

**Paso 2**: Implementar `IngestorInterface`

**Paso 3**: Registrar en Factory (`src/core/ingestor/factory.ts`)

**Paso 4**: Agregar dependencias opcionales en `package.json`

**Paso 5**: Configurar variable de entorno `INGESTOR_TYPE`

### Crear un Nuevo Storage Plugin

**Paso 1**: Crear estructura en `src/plugins/storage/{nombre-storage}/`

**Paso 2**: Implementar `StorageInterface`

**Paso 3**: Registrar en Factory (`src/core/storage/factory.ts`)

**Paso 4**: Configurar variable de entorno `STORAGE_TYPE`

---

## 💾 Sistema de Almacenamiento

### StorageInterface

Todas las implementaciones de storage deben implementar:

```typescript
interface StorageInterface {
  initialize(): Promise<void>;
  saveFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  deleteFile(path: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
}
```

### LocalStorage

- **Ubicación**: `src/plugins/storage/local/index.ts`
- **Base Path**: `VAULT_PATH` (default: `./data/vault`)
- **Características**: Operaciones síncronas, siempre disponible

### GoogleDriveStorage

- **Ubicación**: `src/plugins/storage/googledrive/index.ts`
- **Autenticación**: OAuth (recomendado) o Service Account
- **Características**:
  - Almacenamiento híbrido (local + Drive)
  - Siempre guarda localmente primero
  - Sincroniza a Drive después
  - Auto-deshabilitación si Drive falla

**OAuth Setup**: Ver `docs/GOOGLE-DRIVE-OAUTH-SETUP.md`

**Service Account Setup**: Ver `docs/GCP-SERVICE-ACCOUNT-SETUP.md`

### GitStorage

- **Ubicación**: `src/plugins/storage/git/index.ts`
- **Estado**: Placeholder (no implementado aún)

---

## 📊 Gestión de Grupos

Los grupos monitoreados se guardan en `./data/monitored-groups.json`.

**Estructura**:
```json
[
  {
    "name": "Nombre del Grupo",
    "jid": "1234567890-1234567890@g.us"
  }
]
```

**Operaciones**:
- Agregar: `groupManager.addGroup(name, jid?)`
- Remover: `groupManager.removeGroup(name)`
- Listar: `groupManager.getAllGroups()`
- Verificar: `groupManager.isMonitored(name)`

---

## 📁 Sistema de Categorías

### Formato de Mensaje Categorizado

```
CATEGORIA<separador>contenido
```

Ejemplo:
```
CODE,,function test() { return true; }
```

### Configuración de Categoría

```json
{
  "name": "code",
  "description": "Código y snippets",
  "enabledFields": ["AUTOR", "HORA", "FECHA", "CONTENIDO"],
  "separator": ",,"
}
```

### Campos Disponibles

- `AUTOR`: Nombre del remitente
- `HORA`: Hora del mensaje (HH:MM:SS)
- `FECHA`: Fecha del mensaje (DD/MM/YYYY)
- `CONTENIDO`: Contenido del mensaje

### Separador

- Cada categoría puede tener un separador personalizado
- Longitud: 1-3 caracteres
- Default: `,,`
- El contenido después del separador se captura (ignorando espacios iniciales)

---

## 🖥️ Interfaz de Línea de Comandos (CLI)

### Menú Principal

```
📱 W2M - WhatsApp to Markdown [✅ Conectado]
─────────────────────────────────────────────────────
1) QR  |  2) Estado  |  3) Desconectar  |  4) Grupos (2)  |  5) Categorías (3)  |  6) Salir
─────────────────────────────────────────────────────
>
```

### Características

- Menús anidados con flag `isInSubMenu`
- Selección numérica
- Mensajes en tiempo real
- Confirmaciones de operaciones

---

## 🌐 Dashboard Web

### Acceso

- **Local**: `http://localhost:3000/web`
- **Producción**: `http://YOUR-EC2-IP:3000/web`

### Características

- Estado de conexión en tiempo real
- Visualización de QR code
- Logs en tiempo real (SSE)
- Gestión de grupos
- Gestión de categorías
- Visualización de markdown
- Configuración de Google Drive (OAuth)

### Tecnologías

- **Hono**: Framework web ligero
- **HTMX**: Actualizaciones dinámicas
- **TailwindCSS (CDN)**: Estilos
- **Server-Sent Events**: Logs y QR en tiempo real

---

## ⚙️ Configuración

Ver `env.example` para todas las variables disponibles.

### Variables Principales

- `STORAGE_TYPE`: Tipo de almacenamiento (`local`, `googledrive`, `git`)
- `INGESTOR_TYPE`: Tipo de ingestor (`baileys`, etc.)
- `WEB_ENABLED`: Habilitar dashboard web
- `WEB_PORT`: Puerto del dashboard
- `TZ`: Zona horaria

---

## 🐳 Docker y Deployment

### Docker Compose

Un solo archivo `docker-compose.yml` para todos los perfiles:

- **Producción**: Usa imagen de GHCR
- **Desarrollo**: Build local con hot-reload
- **Test Producción**: Build local sin hot-reload

### Comandos

```bash
# Producción (EC2)
docker-compose up -d

# Desarrollo
BUILD_TARGET=development docker-compose up --build

# Ver logs
docker-compose logs -f w2m

# Reiniciar
docker-compose restart w2m
```

---

## 🚀 CI/CD

### GitHub Actions

Pipeline automatizado que:
1. Builda imagen Docker
2. Publica a GHCR
3. Despliega a EC2

### Configuración

Ver `.github/workflows/` para detalles.

---

## 📄 Formato de Datos

### Markdown de Categorías

```markdown
# CATEGORIA: Code

## Mensaje #1

**AUTOR:** Juan Pérez  
**HORA:** 14:30:15  
**FECHA:** 27/12/2025  
**CONTENIDO:**  
```python
def hello():
    print("Hello")
```

---
```

### JSON de Grupos

```json
[
  {
    "name": "Nombre del Grupo",
    "jid": "1234567890-1234567890@g.us"
  }
]
```

### JSON de Categorías

```json
{
  "categories": {
    "code": {
      "name": "code",
      "description": "Código y snippets",
      "enabledFields": ["AUTOR", "HORA", "FECHA", "CONTENIDO"],
      "separator": ",,"
    }
  }
}
```

---

## 🤖 Guía para LLMs

### Al Desarrollar con W2M

1. **Modularidad**: El core NO debe depender de plugins específicos
2. **Interfaces**: Usar `IngestorInterface` y `StorageInterface` para nuevos plugins
3. **Persistencia**: Usar JSON para datos simples
4. **Configuración**: Agregar nuevas opciones en `src/config/index.ts`
5. **CLI**: Respetar el sistema de flags (`isInSubMenu`)
6. **Formato**: Mantener formato de markdown consistente
7. **Storage**: Siempre usar `StorageInterface`, nunca `fs` directamente

### Al Agregar Funcionalidad

1. **Identificar Capa**: ¿Core, Plugin, CLI, Web, Config?
2. **Mantener Separación**: No acoplar componentes
3. **Documentar**: Actualizar este archivo
4. **Testing**: Agregar tests si es posible
5. **Backward Compatibility**: No romper formatos existentes

### Al Debuggear

1. **Logs**: Usar `logger` de `src/utils/logger.ts`
2. **Niveles**: `debug` para desarrollo, `info` para producción
3. **Formato**: `pretty` para desarrollo, `json` para producción
4. **Estado**: Verificar flags (`isInSubMenu`, `connectionState`)
5. **Persistencia**: Verificar archivos JSON en `./data/`
6. **Storage**: Verificar que se use `StorageInterface` correctamente

### Rutas Importantes

- **Entry Point**: `src/index.ts`
- **CLI**: `src/cli/index.ts`
- **Web Dashboard**: `src/web/`
- **Ingestor Interface**: `src/core/ingestor/interface.ts`
- **Storage Interface**: `src/core/storage/interface.ts`
- **Plugin Baileys**: `src/plugins/baileys/index.ts`
- **Google Drive Storage**: `src/plugins/storage/googledrive/`
- **Group Manager**: `src/core/groups/index.ts`
- **Category Manager**: `src/core/categories/index.ts`
- **Category Writer**: `src/core/categories/writer.ts`
- **Config**: `src/config/index.ts`

### Archivos de Datos

- **Grupos**: `./data/monitored-groups.json`
- **Categorías**: `./data/categories.json`
- **Sesiones**: `./data/session/` (estructura de Baileys)
- **Markdown**: `./data/vault/categories/{categoria}.md`
- **OAuth Tokens**: `./data/vault/.google-oauth-tokens.json`

---

**Última actualización**: 2025-12-27  
**Mantener este documento actualizado** cuando se agreguen nuevas funcionalidades o se modifique la arquitectura.
