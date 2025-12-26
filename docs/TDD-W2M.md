# W2M (WhatsApp to Markdown)
## Documento de Diseño Técnico (TDD)

**Versión:** 1.0  
**Fecha:** Diciembre 2025  
**Autor:** Arquitecto de Software PKM

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Investigación del Estado del Arte](#2-investigación-del-estado-del-arte)
3. [Stack Tecnológico Recomendado](#3-stack-tecnológico-recomendado)
4. [Arquitectura del Sistema](#4-arquitectura-del-sistema)
5. [Estrategia de Mitigación de Memoria](#5-estrategia-de-mitigación-de-memoria)
6. [Diseño de Extensibilidad](#6-diseño-de-extensibilidad)
7. [Roadmap de Features](#7-roadmap-de-features)
8. [Apéndices](#8-apéndices)

---

## 1. Resumen Ejecutivo

**W2M** es un framework de ingestión universal diseñado para capturar flujos de información efímeros desde WhatsApp y transformarlos en conocimiento permanente estructurado mediante archivos Markdown.

### Principios Fundamentales

| Principio | Descripción |
|-----------|-------------|
| **Agnosticismo de Destino** | Genera Markdown puro compatible con cualquier herramienta (Obsidian, Logseq, VS Code, etc.) |
| **Modularidad (Strategy Pattern)** | Arquitectura de plugins desacoplada del motor principal |
| **Soberanía de Datos** | Todo ocurre en infraestructura controlada por el usuario |
| **Eficiencia de Recursos** | Optimizado para entornos con ≤1GB RAM |

---

## 2. Investigación del Estado del Arte

### 2.1 Comparativa: Chromium (Puppeteer) vs WebSocket Directo

#### Análisis de Librerías de WhatsApp (Diciembre 2025)

| Característica | whatsapp-web.js (Puppeteer) | Baileys (@whiskeysockets/baileys) | WPPConnect |
|----------------|------------------------------|-----------------------------------|------------|
| **Arquitectura** | Chromium Headless | WebSocket Directo | WebSocket + Puppeteer híbrido |
| **RAM Baseline** | 400-800 MB | 50-150 MB | 200-400 MB |
| **RAM Pico** | 1-2 GB | 200-300 MB | 500-800 MB |
| **Memory Leaks** | ⚠️ Reportados frecuentemente ([Issue #3459](https://github.com/pedroslopez/whatsapp-web.js/issues/3459)) | ✅ Estable | ⚠️ Ocasionales |
| **Mantenimiento 2025** | Activo | Muy Activo (@whiskeysockets) | Activo |
| **Riesgo de Baneo** | Medio | Medio-Bajo | Medio |
| **Facilidad de Setup Docker** | Complejo (requiere Chromium) | Simple | Medio |
| **Multi-device Support** | ✅ Sí | ✅ Sí | ✅ Sí |

#### Veredicto: **Baileys (@whiskeysockets/baileys)**

**Justificación:**
1. **Consumo de RAM 5-10x menor** que soluciones basadas en Puppeteer
2. **Sin dependencia de navegador headless** = sin fugas de memoria típicas de Chromium
3. **Imagen Docker más ligera** (~100MB vs ~1GB con Chromium)
4. **Mantenimiento activo** por la comunidad @whiskeysockets
5. **Conexión WebSocket nativa** = menor latencia y mayor estabilidad

### 2.2 Patrones de Sincronización: Git vs Alternativas

| Herramienta | Tipo | RAM Usage | Pros | Contras |
|-------------|------|-----------|------|---------|
| **simple-git** | Wrapper Git CLI | ~20-50 MB | Familiar, robusto | Requiere Git instalado, overkill para sync unidireccional |
| **isomorphic-git** | Git puro en JS | ~30-80 MB | Sin dependencias binarias | Más lento para repos grandes |
| **rsync** | Sincronización de archivos | ~5-10 MB | Extremadamente eficiente | No tiene historial, solo Linux nativo |
| **Syncthing** | P2P Sync | ~50-100 MB | Descentralizado, UI incluida | Overhead para caso simple |
| **rclone** | Sync multi-cloud | ~20-40 MB | Soporta muchos backends | Complejidad innecesaria |

#### Veredicto: **Estrategia Híbrida**

```
┌─────────────────────────────────────────────────────────────────┐
│  RECOMENDACIÓN: Git Automatizado con simple-git                │
├─────────────────────────────────────────────────────────────────┤
│  - simple-git para auto-commit/push en el servidor             │
│  - El usuario hace git pull desde su máquina local             │
│  - Historial completo de cambios                               │
│  - Conflictos manejables (principalmente append-only)          │
│  - Alternativa: rsync sobre SSH para usuarios sin Git          │
└─────────────────────────────────────────────────────────────────┘
```

**Justificación:**
- Git proporciona **historial de cambios** valioso para PKM
- **simple-git** tiene API limpia y es ampliamente probado
- El overhead de RAM es mínimo (~20-50MB)
- Permite usar **GitHub/GitLab/Gitea** como backup automático

---

## 3. Stack Tecnológico Recomendado

### 3.1 Decisiones de Stack

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           STACK W2M                                        │
├────────────────────────────────────────────────────────────────────────────┤
│  Runtime:        Node.js 20 LTS (Alpine)                                   │
│  Lenguaje:       TypeScript 5.x                                            │
│  WhatsApp:       @whiskeysockets/baileys                                   │
│  Git:            simple-git                                                │
│  Logging:        pino (JSON, bajo overhead)                                │
│  Config:         dotenv + zod (validación)                                 │
│  Testing:        vitest                                                    │
│  Container:      Docker + docker-compose                                   │
│  Base Image:     node:20-alpine                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Justificación Detallada

| Decisión | Alternativas Consideradas | Razón de Elección |
|----------|--------------------------|-------------------|
| **Node.js** | Python, Go, Rust | Baileys es nativo JS; ecosistema npm maduro para la tarea |
| **TypeScript** | JavaScript puro | Type safety previene errores; mejor DX para contribuidores |
| **Alpine Linux** | Debian, Ubuntu | Imagen ~5x más pequeña; menor superficie de ataque |
| **pino** | winston, bunyan | 5x más rápido; JSON nativo; ideal para containers |
| **Zod** | Joi, Yup | TypeScript-first; excelente DX; validación en runtime |

### 3.3 Dependencias Principales

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.x",
    "simple-git": "^3.x",
    "pino": "^8.x",
    "zod": "^3.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^1.x",
    "@types/node": "^20.x",
    "tsx": "^4.x"
  }
}
```

---

## 4. Arquitectura del Sistema

### 4.1 Diagrama de Alto Nivel

```
                                    W2M ARCHITECTURE
                                    
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                              EC2 / VPS                                  │
    │  ┌───────────────────────────────────────────────────────────────────┐  │
    │  │                         DOCKER CONTAINER                          │  │
    │  │                                                                   │  │
    │  │   ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │  │
    │  │   │             │    │                  │    │                │  │  │
    │  │   │  INGESTOR   │───▶│  STRATEGY ENGINE │───▶│  FILE SYSTEM   │  │  │
    │  │   │  (Baileys)  │    │   (Middleware)   │    │   (Markdown)   │  │  │
    │  │   │             │    │                  │    │                │  │  │
    │  │   └─────────────┘    └────────┬─────────┘    └───────┬────────┘  │  │
    │  │         │                     │                      │           │  │
    │  │         │                     │                      │           │  │
    │  │         ▼                     ▼                      ▼           │  │
    │  │   ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐  │  │
    │  │   │  FEEDBACK   │◀───│  ERROR HANDLER   │    │   SYNC AGENT   │  │  │
    │  │   │   LOOP      │    │  & NOTIFIER      │    │   (Git Push)   │  │  │
    │  │   │             │    │                  │    │                │  │  │
    │  │   └─────────────┘    └──────────────────┘    └───────┬────────┘  │  │
    │  │                                                      │           │  │
    │  └──────────────────────────────────────────────────────┼───────────┘  │
    │                                                         │              │
    └─────────────────────────────────────────────────────────┼──────────────┘
                                                              │
                                                              ▼
                                                    ┌──────────────────┐
                                                    │  REMOTE GIT REPO │
                                                    │  (GitHub/GitLab) │
                                                    └────────┬─────────┘
                                                             │
                                                             ▼
                                                    ┌──────────────────┐
                                                    │   USER'S LOCAL   │
                                                    │   MACHINE        │
                                                    │   (git pull)     │
                                                    └──────────────────┘
```

### 4.2 Componentes del Sistema

#### 4.2.1 Ingestor (WhatsApp Client)

```typescript
// Responsabilidades:
// - Conexión persistente a WhatsApp vía WebSocket
// - Escucha de eventos en grupos configurados
// - Parsing inicial de mensajes
// - Manejo de reconexión automática

interface IngestorConfig {
  allowedGroups: string[];        // IDs de grupos a monitorear
  sessionPath: string;            // Ruta de persistencia de sesión
  reconnectInterval: number;      // Intervalo de reconexión (ms)
  qrCodeTimeout: number;          // Timeout para escaneo QR
}

interface IncomingMessage {
  id: string;
  timestamp: Date;
  sender: string;
  senderName: string;
  groupId: string;
  groupName: string;
  content: string;
  quotedMessage?: IncomingMessage;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
}
```

#### 4.2.2 Strategy Engine (Middleware)

```typescript
// Responsabilidades:
// - Registro y gestión de estrategias
// - Matching de triggers en mensajes
// - Ejecución de transformaciones
// - Enrutamiento a carpetas destino

interface Strategy {
  name: string;                          // Identificador único
  description: string;                   // Descripción para AYUDA
  triggers: RegExp[];                    // Patrones de activación
  priority: number;                      // Orden de evaluación (mayor = primero)
  
  match(message: IncomingMessage): boolean;
  execute(message: IncomingMessage): Promise<StrategyResult>;
}

interface StrategyResult {
  success: boolean;
  outputPath?: string;                   // Ruta del archivo generado
  feedbackMessage?: string;              // Respuesta para el chat
  error?: Error;
}
```

#### 4.2.3 File System Manager

```typescript
// Responsabilidades:
// - Creación de estructura de directorios
// - Escritura de archivos Markdown
// - Manejo de conflictos de nombres
// - Gestión de metadatos (frontmatter YAML)

interface FileSystemConfig {
  basePath: string;                      // Raíz del vault
  dateFormat: string;                    // Formato para nombres de archivo
  enableFrontmatter: boolean;            // Añadir metadata YAML
  appendMode: boolean;                   // Append vs overwrite
}

interface MarkdownDocument {
  frontmatter: Record<string, unknown>;
  content: string;
  targetPath: string;
}
```

#### 4.2.4 Sync Agent

```typescript
// Responsabilidades:
// - Auto-commit de cambios
// - Push a repositorio remoto
// - Manejo de credenciales Git
// - Retry con backoff exponencial

interface SyncConfig {
  repoPath: string;
  remoteName: string;                    // Típicamente 'origin'
  branch: string;                        // Típicamente 'main'
  commitPrefix: string;                  // Ej: '[W2M]'
  syncInterval: number;                  // Intervalo de sync (ms)
  batchCommits: boolean;                 // Agrupar múltiples archivos
}
```

#### 4.2.5 Feedback Loop

```typescript
// Responsabilidades:
// - Envío de confirmaciones al chat
// - Notificación de errores
// - Respuesta a comandos introspectivos
// - Rate limiting de respuestas

interface FeedbackConfig {
  enableConfirmations: boolean;
  enableErrorNotifications: boolean;
  rateLimitMs: number;                   // Mínimo entre mensajes
  maxMessageLength: number;
}
```

### 4.3 Flujo de Datos

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           MESSAGE FLOW                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   1. WhatsApp Message Received                                             │
│      │                                                                     │
│      ▼                                                                     │
│   2. Ingestor parses to IncomingMessage                                    │
│      │                                                                     │
│      ▼                                                                     │
│   3. Strategy Engine evaluates triggers (by priority)                      │
│      │                                                                     │
│      ├──▶ No match? → Log & discard                                        │
│      │                                                                     │
│      ▼                                                                     │
│   4. Matching Strategy executes transformation                             │
│      │                                                                     │
│      ├──▶ Error? → Error Handler → Notify user                             │
│      │                                                                     │
│      ▼                                                                     │
│   5. File System Manager writes Markdown                                   │
│      │                                                                     │
│      ▼                                                                     │
│   6. Sync Agent commits & pushes                                           │
│      │                                                                     │
│      ▼                                                                     │
│   7. Feedback Loop confirms in chat (optional)                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Estrategia de Mitigación de Memoria

### 5.1 Configuración de EC2 Free Tier

```bash
# Instancia recomendada: t3.micro
# - 2 vCPU (burstable)
# - 1 GB RAM
# - Hasta 5 Gbps network

# Configuración de SWAP (CRÍTICO para 1GB RAM)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persistir swap
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimizar swappiness (usar swap solo cuando sea necesario)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 5.2 Límites de Docker

```yaml
# docker-compose.yml
version: '3.8'

services:
  w2m:
    build: .
    container_name: w2m
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M      # Límite duro
        reservations:
          memory: 256M      # Garantizado
    environment:
      - NODE_OPTIONS=--max-old-space-size=384
    volumes:
      - ./data/vault:/app/vault
      - ./data/session:/app/session
      - ./data/logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 5.3 Dockerfile Optimizado

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias de build
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Build TypeScript
RUN npm run build

# Imagen de producción (multi-stage para menor tamaño)
FROM node:20-alpine AS production

WORKDIR /app

# Solo copiar lo necesario
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S w2m && \
    adduser -u 1001 -S w2m -G w2m && \
    chown -R w2m:w2m /app

USER w2m

# Health check y startup
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "--max-old-space-size=384", "dist/index.js"]
```

### 5.4 Estrategias de Código para Memoria

```typescript
// ✅ BUENAS PRÁCTICAS

// 1. Streaming para archivos grandes
import { createWriteStream } from 'fs';
const stream = createWriteStream(filePath);
stream.write(content);
stream.end();

// 2. Limitar caché de mensajes en Baileys
const sock = makeWASocket({
  logger: pino({ level: 'warn' }),
  getMessage: async () => undefined,  // No cachear mensajes
  syncFullHistory: false,              // No sincronizar historial
  markOnlineOnConnect: false,          // Menor actividad de red
});

// 3. Procesar mensajes en cola con límite
const messageQueue = new Map<string, IncomingMessage>();
const MAX_QUEUE_SIZE = 100;

function addToQueue(msg: IncomingMessage) {
  if (messageQueue.size >= MAX_QUEUE_SIZE) {
    const oldest = messageQueue.keys().next().value;
    messageQueue.delete(oldest);
  }
  messageQueue.set(msg.id, msg);
}

// 4. Forzar garbage collection periódicamente
if (global.gc) {
  setInterval(() => {
    global.gc();
  }, 60000); // Cada minuto
}

// 5. Monitorear memoria
setInterval(() => {
  const used = process.memoryUsage();
  logger.info({
    heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(used.rss / 1024 / 1024) + 'MB',
  }, 'Memory usage');
}, 300000); // Cada 5 minutos
```

### 5.5 Alertas y Monitoreo

```typescript
// Alerta cuando memoria supera umbral
const MEMORY_THRESHOLD_MB = 400;

function checkMemory() {
  const used = process.memoryUsage();
  const heapMB = used.heapUsed / 1024 / 1024;
  
  if (heapMB > MEMORY_THRESHOLD_MB) {
    logger.warn({ heapMB }, 'High memory usage detected');
    // Opcionalmente: notificar vía WhatsApp al admin
    // Opcionalmente: reducir caché, forzar GC
  }
}
```

---

## 6. Diseño de Extensibilidad

### 6.1 Estructura de Directorios del Proyecto

```
w2m/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config/
│   │   ├── index.ts                # Carga de configuración
│   │   ├── schema.ts               # Validación con Zod
│   │   └── defaults.ts             # Valores por defecto
│   │
│   ├── core/
│   │   ├── ingestor/
│   │   │   ├── index.ts            # WhatsApp client wrapper
│   │   │   ├── connection.ts       # Manejo de conexión
│   │   │   └── events.ts           # Event handlers
│   │   │
│   │   ├── engine/
│   │   │   ├── index.ts            # Strategy engine principal
│   │   │   ├── registry.ts         # Registro de estrategias
│   │   │   └── matcher.ts          # Lógica de matching
│   │   │
│   │   ├── filesystem/
│   │   │   ├── index.ts            # File manager
│   │   │   ├── markdown.ts         # Generación de MD
│   │   │   └── paths.ts            # Resolución de rutas
│   │   │
│   │   ├── sync/
│   │   │   ├── index.ts            # Sync agent
│   │   │   └── git.ts              # Operaciones Git
│   │   │
│   │   └── feedback/
│   │       ├── index.ts            # Feedback loop
│   │       └── formatter.ts        # Formateo de mensajes
│   │
│   ├── strategies/                  # 📌 AQUÍ VAN LAS ESTRATEGIAS
│   │   ├── index.ts                # Auto-registro de estrategias
│   │   ├── base.ts                 # Clase base abstracta
│   │   ├── nota.strategy.ts        # Estrategia NOTA:
│   │   ├── todo.strategy.ts        # Estrategia TODO:
│   │   ├── idea.strategy.ts        # Estrategia IDEA:
│   │   ├── link.strategy.ts        # Estrategia LINK:
│   │   └── help.strategy.ts        # Comando AYUDA/COMANDOS
│   │
│   ├── types/
│   │   ├── index.ts                # Exports centralizados
│   │   ├── message.ts              # Tipos de mensajes
│   │   ├── strategy.ts             # Interfaz Strategy
│   │   └── config.ts               # Tipos de configuración
│   │
│   └── utils/
│       ├── logger.ts               # Configuración de pino
│       ├── date.ts                 # Helpers de fecha
│       └── sanitize.ts             # Sanitización de texto
│
├── data/                            # Datos persistentes (gitignore)
│   ├── vault/                       # Archivos Markdown generados
│   ├── session/                     # Sesión de WhatsApp
│   └── logs/                        # Logs de aplicación
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── docs/
│   ├── TDD-W2M.md                  # Este documento
│   ├── CONTRIBUTING.md             # Guía para contribuidores
│   └── STRATEGIES.md               # Cómo crear estrategias
│
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### 6.2 Interfaz de Estrategia (Contrato)

```typescript
// src/types/strategy.ts

import { IncomingMessage } from './message';

/**
 * Resultado de la ejecución de una estrategia
 */
export interface StrategyResult {
  /** Si la estrategia se ejecutó correctamente */
  success: boolean;
  
  /** Ruta del archivo creado/modificado (si aplica) */
  outputPath?: string;
  
  /** Mensaje a enviar como respuesta en el chat (si aplica) */
  feedbackMessage?: string;
  
  /** Error ocurrido (si success=false) */
  error?: Error;
  
  /** Metadata adicional para logging */
  metadata?: Record<string, unknown>;
}

/**
 * Opciones de configuración específicas de cada estrategia
 */
export interface StrategyOptions {
  /** Carpeta destino relativa al vault */
  outputFolder: string;
  
  /** Plantilla de nombre de archivo */
  filenameTemplate: string;
  
  /** Incluir frontmatter YAML */
  includeFrontmatter: boolean;
  
  /** Enviar confirmación al chat */
  sendConfirmation: boolean;
  
  /** Opciones adicionales específicas */
  [key: string]: unknown;
}

/**
 * Interfaz principal que toda estrategia debe implementar
 */
export interface Strategy {
  /** Identificador único (usado internamente) */
  readonly name: string;
  
  /** Nombre para mostrar al usuario */
  readonly displayName: string;
  
  /** Descripción corta para el comando AYUDA */
  readonly description: string;
  
  /** Ejemplo de uso para documentación */
  readonly example: string;
  
  /** Prioridad de evaluación (mayor = primero) */
  readonly priority: number;
  
  /** Patrones regex que activan esta estrategia */
  readonly triggers: RegExp[];
  
  /** Opciones de configuración */
  readonly options: StrategyOptions;
  
  /**
   * Determina si el mensaje debe ser procesado por esta estrategia
   * @param message - Mensaje entrante
   * @returns true si debe procesarse
   */
  match(message: IncomingMessage): boolean;
  
  /**
   * Procesa el mensaje y genera el output
   * @param message - Mensaje entrante
   * @returns Resultado de la operación
   */
  execute(message: IncomingMessage): Promise<StrategyResult>;
}
```

### 6.3 Clase Base para Estrategias

```typescript
// src/strategies/base.ts

import { Strategy, StrategyResult, StrategyOptions } from '../types/strategy';
import { IncomingMessage } from '../types/message';
import { FileSystemManager } from '../core/filesystem';
import { logger } from '../utils/logger';

/**
 * Clase base abstracta que simplifica la creación de estrategias.
 * Los desarrolladores solo necesitan implementar los métodos abstractos.
 */
export abstract class BaseStrategy implements Strategy {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly example: string;
  abstract readonly priority: number;
  abstract readonly triggers: RegExp[];
  
  protected readonly fs: FileSystemManager;
  readonly options: StrategyOptions;

  constructor(options: Partial<StrategyOptions> = {}) {
    this.fs = new FileSystemManager();
    this.options = {
      outputFolder: 'inbox',
      filenameTemplate: '{{date}}-{{title}}',
      includeFrontmatter: true,
      sendConfirmation: true,
      ...options,
    };
  }

  /**
   * Implementación por defecto de match usando triggers
   */
  match(message: IncomingMessage): boolean {
    return this.triggers.some(trigger => trigger.test(message.content));
  }

  /**
   * Template method: wrapper que maneja errores y logging
   */
  async execute(message: IncomingMessage): Promise<StrategyResult> {
    const startTime = Date.now();
    
    try {
      logger.info({ 
        strategy: this.name, 
        messageId: message.id 
      }, 'Executing strategy');
      
      const result = await this.process(message);
      
      logger.info({ 
        strategy: this.name,
        duration: Date.now() - startTime,
        success: result.success,
      }, 'Strategy completed');
      
      return result;
      
    } catch (error) {
      logger.error({ 
        strategy: this.name, 
        error,
        messageId: message.id,
      }, 'Strategy failed');
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        feedbackMessage: `❌ Error en ${this.displayName}: ${error}`,
      };
    }
  }

  /**
   * Método abstracto que cada estrategia debe implementar
   */
  protected abstract process(message: IncomingMessage): Promise<StrategyResult>;

  /**
   * Helpers comunes
   */
  protected extractContent(message: IncomingMessage): string {
    // Remover el trigger del contenido
    let content = message.content;
    for (const trigger of this.triggers) {
      content = content.replace(trigger, '').trim();
    }
    return content;
  }

  protected generateFilename(message: IncomingMessage, title?: string): string {
    const date = new Date(message.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const sanitizedTitle = (title || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    
    return `${dateStr}-${sanitizedTitle}.md`;
  }

  protected generateFrontmatter(message: IncomingMessage): string {
    return `---
source: whatsapp
group: "${message.groupName}"
sender: "${message.senderName}"
date: ${message.timestamp.toISOString()}
strategy: ${this.name}
---

`;
  }
}
```

### 6.4 Ejemplo: Crear una Nueva Estrategia

```typescript
// src/strategies/nota.strategy.ts

import { BaseStrategy } from './base';
import { IncomingMessage } from '../types/message';
import { StrategyResult } from '../types/strategy';

/**
 * Estrategia NOTA:
 * Captura notas rápidas y las guarda en la carpeta /notas/
 * 
 * Ejemplos de uso:
 * - "NOTA: Recordar comprar leche"
 * - "nota: Idea para el proyecto X"
 */
export class NotaStrategy extends BaseStrategy {
  readonly name = 'nota';
  readonly displayName = '📝 Nota';
  readonly description = 'Captura notas rápidas';
  readonly example = 'NOTA: Tu texto aquí';
  readonly priority = 100;
  readonly triggers = [/^nota:/i, /^📝/];

  constructor() {
    super({
      outputFolder: 'notas',
      filenameTemplate: '{{date}}-nota',
      includeFrontmatter: true,
      sendConfirmation: true,
    });
  }

  protected async process(message: IncomingMessage): Promise<StrategyResult> {
    const content = this.extractContent(message);
    
    if (!content) {
      return {
        success: false,
        feedbackMessage: '⚠️ La nota está vacía. Usa: NOTA: tu texto aquí',
      };
    }

    // Generar contenido Markdown
    const markdown = this.options.includeFrontmatter 
      ? this.generateFrontmatter(message) + content
      : content;

    // Escribir archivo
    const filename = this.generateFilename(message, content.slice(0, 30));
    const outputPath = await this.fs.writeFile(
      this.options.outputFolder,
      filename,
      markdown
    );

    return {
      success: true,
      outputPath,
      feedbackMessage: `✅ Nota guardada: ${filename}`,
      metadata: {
        contentLength: content.length,
      },
    };
  }
}
```

### 6.5 Auto-Registro de Estrategias

```typescript
// src/strategies/index.ts

import { Strategy } from '../types/strategy';
import { NotaStrategy } from './nota.strategy';
import { TodoStrategy } from './todo.strategy';
import { IdeaStrategy } from './idea.strategy';
import { LinkStrategy } from './link.strategy';
import { HelpStrategy } from './help.strategy';
import { logger } from '../utils/logger';

/**
 * Registro central de todas las estrategias.
 * Para añadir una nueva estrategia:
 * 1. Crear archivo en /strategies/
 * 2. Importar e instanciar aquí
 * 3. ¡Listo! El engine la detectará automáticamente
 */
const strategyInstances: Strategy[] = [
  new NotaStrategy(),
  new TodoStrategy(),
  new IdeaStrategy(),
  new LinkStrategy(),
  new HelpStrategy(),
];

// Ordenar por prioridad (mayor primero)
export const strategies = strategyInstances
  .sort((a, b) => b.priority - a.priority);

logger.info({ 
  count: strategies.length,
  names: strategies.map(s => s.name),
}, 'Strategies loaded');

// Export individual para testing
export { NotaStrategy, TodoStrategy, IdeaStrategy, LinkStrategy, HelpStrategy };
```

### 6.6 Guía Rápida: Añadir Nueva Estrategia

```markdown
## 🚀 Cómo añadir una nueva estrategia en 3 pasos

### Paso 1: Crear el archivo

Crea `src/strategies/mi-estrategia.strategy.ts`:

```typescript
import { BaseStrategy } from './base';
import { IncomingMessage } from '../types/message';
import { StrategyResult } from '../types/strategy';

export class MiEstrategiaStrategy extends BaseStrategy {
  readonly name = 'mi-estrategia';
  readonly displayName = '🎯 Mi Estrategia';
  readonly description = 'Descripción de lo que hace';
  readonly example = 'MI_TRIGGER: texto de ejemplo';
  readonly priority = 50;  // Ajustar según necesidad
  readonly triggers = [/^mi_trigger:/i, /^🎯/];

  constructor() {
    super({
      outputFolder: 'mi-carpeta',
    });
  }

  protected async process(message: IncomingMessage): Promise<StrategyResult> {
    const content = this.extractContent(message);
    
    // Tu lógica aquí...
    
    return {
      success: true,
      feedbackMessage: '✅ Procesado correctamente',
    };
  }
}
```

### Paso 2: Registrar en index.ts

```typescript
// src/strategies/index.ts
import { MiEstrategiaStrategy } from './mi-estrategia.strategy';

const strategyInstances: Strategy[] = [
  // ... otras estrategias
  new MiEstrategiaStrategy(),  // ← Añadir aquí
];
```

### Paso 3: ¡Listo!

Reinicia W2M y tu nueva estrategia estará activa.
Usa `AYUDA` en el chat para verificar que aparece listada.
```

---

## 7. Roadmap de Features

### 7.1 Fase 1: MVP (Semanas 1-4)

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| **Conexión Baileys** | 🔴 Alta | Conexión estable con WhatsApp, manejo de QR |
| **Estrategia NOTA** | 🔴 Alta | Primera estrategia funcional |
| **Estrategia TODO** | 🔴 Alta | Captura de tareas |
| **Comando AYUDA** | 🔴 Alta | Listado de comandos disponibles |
| **Git Auto-sync** | 🔴 Alta | Commit y push automático |
| **Docker Compose** | 🔴 Alta | Despliegue containerizado |
| **Documentación básica** | 🟡 Media | README y guía de instalación |

### 7.2 Fase 2: Estabilización (Semanas 5-8)

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| **Estrategia LINK** | 🟡 Media | Guardar links con preview |
| **Estrategia IDEA** | 🟡 Media | Captura de ideas creativas |
| **Reconexión automática** | 🔴 Alta | Manejo de desconexiones |
| **Rate limiting** | 🟡 Media | Prevenir spam de respuestas |
| **Logs estructurados** | 🟡 Media | Logs JSON con pino |
| **Health checks** | 🟡 Media | Monitoreo de estado |
| **Tests unitarios** | 🟡 Media | Cobertura básica de tests |

### 7.3 Fase 3: Extensión (Semanas 9-12)

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| **Estrategia MEDIA** | 🟡 Media | Guardar imágenes/archivos |
| **Templates customizables** | 🟡 Media | Plantillas Markdown configurables |
| **Tags automáticos** | 🟢 Baja | Extracción de #hashtags |
| **Backlinks** | 🟢 Baja | Detección de [[wikilinks]] |
| **CLI de gestión** | 🟡 Media | Comandos para administración |
| **Métricas Prometheus** | 🟢 Baja | Observabilidad avanzada |

### 7.4 Fase 4: Ecosistema (Mes 4+)

| Feature | Prioridad | Descripción |
|---------|-----------|-------------|
| **Plugin Telegram** | 🟢 Baja | Soporte para Telegram |
| **Web Dashboard** | 🟢 Baja | UI de configuración |
| **API REST** | 🟢 Baja | Endpoints para integraciones |
| **Obsidian Plugin** | 🟢 Baja | Integración directa con Obsidian |
| **Búsqueda full-text** | 🟢 Baja | Buscar en el vault |
| **AI Summarization** | 🟢 Baja | Resúmenes automáticos con LLM |

### 7.5 Visión a Largo Plazo

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        W2M ECOSYSTEM VISION                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│    │ WhatsApp │  │ Telegram │  │  Signal  │  │  Slack   │                 │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│         │             │             │             │                        │
│         └─────────────┴──────┬──────┴─────────────┘                        │
│                              │                                             │
│                              ▼                                             │
│                   ┌──────────────────────┐                                 │
│                   │                      │                                 │
│                   │    W2M CORE ENGINE   │                                 │
│                   │   (Universal Inbox)  │                                 │
│                   │                      │                                 │
│                   └──────────┬───────────┘                                 │
│                              │                                             │
│         ┌────────────────────┼────────────────────┐                        │
│         │                    │                    │                        │
│         ▼                    ▼                    ▼                        │
│    ┌──────────┐       ┌──────────┐       ┌──────────┐                     │
│    │   Git    │       │  Local   │       │  Cloud   │                     │
│    │  Sync    │       │  Files   │       │  Backup  │                     │
│    └────┬─────┘       └────┬─────┘       └────┬─────┘                     │
│         │                  │                  │                            │
│         └──────────────────┼──────────────────┘                            │
│                            │                                               │
│                            ▼                                               │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│    │ Obsidian │  │  Logseq  │  │ VS Code  │  │  Notion  │                 │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Apéndices

### 8.1 Comandos Docker Útiles

```bash
# Construir imagen
docker-compose build

# Iniciar en foreground (ver QR)
docker-compose up

# Iniciar en background
docker-compose up -d

# Ver logs
docker-compose logs -f w2m

# Reiniciar
docker-compose restart

# Parar
docker-compose down

# Ver uso de memoria
docker stats w2m

# Entrar al container
docker exec -it w2m /bin/sh
```

### 8.2 Variables de Entorno

```bash
# .env.example

# WhatsApp
WA_SESSION_PATH=./data/session
WA_ALLOWED_GROUPS=group1@g.us,group2@g.us
WA_QR_TIMEOUT=60000
WA_RECONNECT_INTERVAL=5000

# Vault
VAULT_PATH=./data/vault
VAULT_DATE_FORMAT=YYYY-MM-DD
VAULT_ENABLE_FRONTMATTER=true

# Git Sync
GIT_ENABLED=true
GIT_REMOTE=origin
GIT_BRANCH=main
GIT_COMMIT_PREFIX=[W2M]
GIT_SYNC_INTERVAL=300000

# Feedback
FEEDBACK_CONFIRMATIONS=true
FEEDBACK_ERRORS=true
FEEDBACK_RATE_LIMIT=1000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### 8.3 Estructura del Vault Generado

```
vault/
├── notas/
│   ├── 2025-12-26-recordar-comprar-leche.md
│   └── 2025-12-26-idea-para-proyecto.md
├── todos/
│   ├── 2025-12-26-revisar-documentacion.md
│   └── 2025-12-26-llamar-al-cliente.md
├── ideas/
│   └── 2025-12-26-app-para-gatos.md
├── links/
│   └── 2025-12-26-articulo-interesante.md
└── inbox/
    └── 2025-12-26-mensaje-sin-clasificar.md
```

### 8.4 Ejemplo de Archivo Generado

```markdown
---
source: whatsapp
group: "Equipo de Desarrollo"
sender: "Juan García"
date: 2025-12-26T14:30:00.000Z
strategy: nota
tags: []
---

Recordar revisar la documentación del API antes de la reunión del viernes.

Puntos importantes:
- Autenticación OAuth2
- Rate limits
- Manejo de errores
```

### 8.5 Troubleshooting Común

| Problema | Causa Probable | Solución |
|----------|----------------|----------|
| QR no aparece | Sesión corrupta | Eliminar `data/session/` y reiniciar |
| Alta RAM | Memory leak | Actualizar Baileys, revisar caché |
| Git push falla | Credenciales | Configurar SSH key o token |
| No recibe mensajes | Desconexión | Verificar logs, reconectar |
| Archivos no se crean | Permisos | Verificar permisos de `data/vault/` |

---

## 9. Estrategia de Resolución de Conflictos Git

### 9.1 El Problema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ESCENARIO DE CONFLICTO                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TIEMPO ──────────────────────────────────────────────────────────▶       │
│                                                                             │
│   [T1] Usuario envía "NOTA: Idea inicial" desde WhatsApp                   │
│         │                                                                   │
│         ▼                                                                   │
│   [T2] W2M crea: 2025-12-26-idea-inicial.md                                │
│         │                                                                   │
│         ▼                                                                   │
│   [T3] W2M hace: git commit + git push                                     │
│         │                                                                   │
│         ├────────────────────────────────────┐                              │
│         ▼                                    ▼                              │
│   [T4] Usuario hace: git pull          [T4] W2M sigue escuchando           │
│         │                                    │                              │
│         ▼                                    │                              │
│   [T5] Usuario EDITA el archivo              │                              │
│         │                                    │                              │
│         ▼                                    │                              │
│   [T6] Usuario hace: git push                │                              │
│         │                                    │                              │
│         │                               [T7] Usuario envía otra nota        │
│         │                                    │                              │
│         │                                    ▼                              │
│         │                               [T8] W2M: git push                  │
│         │                                    │                              │
│         │                                    ▼                              │
│         └───────────────────────────▶  ⚠️ CONFLICTO!                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Estrategia: Append-Only + Conflict Detection

La solución es una combinación de **prevención** y **resolución elegante**:

#### Principio 1: Append-Only por Defecto

W2M **nunca modifica** archivos existentes. Cada mensaje crea un archivo nuevo:

```
vault/notas/
├── 2025-12-26-idea-inicial.md       # Creado por W2M
├── 2025-12-26-otra-nota.md          # Creado por W2M
└── 2025-12-26-tercera-nota.md       # Creado por W2M
```

**Resultado:** El 99% de operaciones nunca generan conflictos.

#### Principio 2: Pull-Before-Push con Rebase

```typescript
// src/core/sync/git.ts

async function safePush(): Promise<SyncResult> {
  const git = simpleGit(config.repoPath);
  
  try {
    // 1. Siempre hacer pull con rebase primero
    await git.pull('origin', config.branch, { '--rebase': 'true' });
    
    // 2. Si llegamos aquí, no hay conflictos → push
    await git.push('origin', config.branch);
    
    return { success: true };
    
  } catch (error) {
    if (isConflictError(error)) {
      return await handleConflict(git, error);
    }
    throw error;
  }
}
```

#### Principio 3: Resolución de Conflictos Automática

Cuando ocurre un conflicto (caso raro), W2M:

1. **Aborta el rebase** para no perder datos
2. **Guarda la versión de W2M** con sufijo de conflicto
3. **Acepta la versión del usuario** como principal
4. **Notifica al usuario** vía WhatsApp

```typescript
// src/core/sync/conflict-resolver.ts

async function handleConflict(git: SimpleGit, error: Error): Promise<SyncResult> {
  const conflictedFiles = await getConflictedFiles(git);
  
  for (const file of conflictedFiles) {
    // Guardar nuestra versión con timestamp
    const timestamp = Date.now();
    const conflictPath = file.replace('.md', `-w2m-${timestamp}.md`);
    
    // Obtener contenido de W2M (ours)
    const oursContent = await git.show([`HEAD:${file}`]);
    await fs.writeFile(conflictPath, oursContent);
    
    // Aceptar versión del usuario (theirs)
    await git.checkout(['--theirs', file]);
  }
  
  // Abortar rebase y hacer commit limpio
  await git.rebase(['--abort']);
  await git.add('.');
  await git.commit('[W2M] Resolved conflicts - user version preserved');
  await git.push('origin', config.branch);
  
  // Notificar al usuario
  await notifyUser(`⚠️ Conflicto detectado en: ${conflictedFiles.join(', ')}
  
Tu versión ha sido preservada.
Versión de W2M guardada como: *-w2m-${timestamp}.md
  
Revisa y fusiona manualmente si es necesario.`);
  
  return {
    success: true,
    hadConflicts: true,
    conflictedFiles,
  };
}
```

### 9.3 Diagrama de Flujo de Sincronización

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE SINCRONIZACIÓN                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Nuevo archivo creado por W2M                                              │
│         │                                                                   │
│         ▼                                                                   │
│   ┌─────────────┐                                                          │
│   │  git add .  │                                                          │
│   └──────┬──────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────────────┐                                                  │
│   │  git commit -m ...  │                                                  │
│   └──────┬──────────────┘                                                  │
│          │                                                                  │
│          ▼                                                                  │
│   ┌───────────────────────────┐                                            │
│   │  git pull --rebase origin │                                            │
│   └──────┬────────────────────┘                                            │
│          │                                                                  │
│          ├──────────────────────┐                                          │
│          │                      │                                          │
│          ▼                      ▼                                          │
│   ┌─────────────┐       ┌─────────────┐                                    │
│   │  Sin cambios │       │  Hay cambios │                                   │
│   │  remotos     │       │  remotos     │                                   │
│   └──────┬──────┘       └──────┬──────┘                                    │
│          │                     │                                            │
│          │                     ├────────────────────┐                       │
│          │                     │                    │                       │
│          │                     ▼                    ▼                       │
│          │              ┌─────────────┐     ┌─────────────┐                │
│          │              │  Rebase OK  │     │  CONFLICTO  │                │
│          │              └──────┬──────┘     └──────┬──────┘                │
│          │                     │                   │                        │
│          │                     │                   ▼                        │
│          │                     │            ┌─────────────────┐            │
│          │                     │            │ Guardar versión │            │
│          │                     │            │ W2M como backup │            │
│          │                     │            └────────┬────────┘            │
│          │                     │                     │                      │
│          │                     │                     ▼                      │
│          │                     │            ┌─────────────────┐            │
│          │                     │            │ Aceptar versión │            │
│          │                     │            │ del usuario     │            │
│          │                     │            └────────┬────────┘            │
│          │                     │                     │                      │
│          │                     │                     ▼                      │
│          │                     │            ┌─────────────────┐            │
│          │                     │            │ Notificar vía   │            │
│          │                     │            │ WhatsApp        │            │
│          │                     │            └────────┬────────┘            │
│          │                     │                     │                      │
│          ▼                     ▼                     ▼                      │
│   ┌────────────────────────────────────────────────────┐                   │
│   │                    git push origin                  │                   │
│   └─────────────────────────────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Configuración Git Recomendada para el Vault

```bash
# En el repositorio del vault (ejecutar una vez)

# Estrategia de merge para Markdown: union (combina líneas de ambos)
git config merge.markdown.driver "union"

# Aplicar a archivos .md
echo "*.md merge=markdown" >> .gitattributes

# Evitar conversiones de línea que causen conflictos falsos
git config core.autocrlf input
```

### 9.5 Alternativa: Rama Dedicada para W2M

Para usuarios avanzados que quieren control total:

```
main (usuario)          w2m-ingest (W2M)
     │                       │
     │◀──── merge ───────────┤  (usuario decide cuándo)
     │                       │
     │                       │◀─── W2M solo escribe aquí
     │                       │
     ▼                       ▼
```

```typescript
// Configuración opcional en .env
GIT_BRANCH=w2m-ingest    # W2M escribe en rama separada
GIT_AUTO_MERGE=false     # Usuario hace merge manual
```

---

## 10. Paridad de Entornos: Desarrollo ↔ Producción

### 10.1 Especificaciones del Entorno de Producción

**AWS EC2 t3.small (Free Tier 12 meses):**

| Recurso | Especificación |
|---------|----------------|
| vCPU | 2 (burstable) |
| RAM | 2 GB |
| Network | Hasta 5 Gbps |
| Storage | EBS (20GB incluido Free Tier) |
| CPU Credits | Acumulables, burst hasta 20% |

### 10.2 Replicar Producción en Desarrollo

#### docker-compose.override.yml (Desarrollo)

```yaml
# docker-compose.override.yml
# Este archivo se aplica automáticamente sobre docker-compose.yml

version: '3.8'

services:
  w2m:
    build:
      context: .
      target: development    # Usar stage de desarrollo
    
    # Simular límites de t3.small
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G         # Igual que t3.small
        reservations:
          memory: 512M
    
    # Hot-reload para desarrollo
    volumes:
      - ./src:/app/src:ro    # Código fuente (read-only)
      - ./data:/app/data     # Datos persistentes
    
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
      - LOG_FORMAT=pretty    # Logs legibles en terminal
    
    # Puerto para debugging
    ports:
      - "9229:9229"          # Node.js inspector
    
    command: ["npx", "tsx", "watch", "--inspect=0.0.0.0:9229", "src/index.ts"]
```

#### Dockerfile Multi-Stage con Target de Desarrollo

```dockerfile
# Dockerfile (actualizado)

# ============================================
# Stage: Base
# ============================================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache git tini

# ============================================
# Stage: Dependencies
# ============================================
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ============================================
# Stage: Development
# ============================================
FROM deps AS development

# Herramientas de desarrollo
RUN npm install -g tsx

# Usuario no-root
RUN addgroup -g 1001 -S w2m && \
    adduser -u 1001 -S w2m -G w2m && \
    mkdir -p /app/data && \
    chown -R w2m:w2m /app

USER w2m

ENV NODE_ENV=development

# Hot-reload con tsx watch
CMD ["npx", "tsx", "watch", "src/index.ts"]

# ============================================
# Stage: Builder
# ============================================
FROM deps AS builder
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
RUN npm prune --production

# ============================================
# Stage: Production
# ============================================
FROM base AS production

RUN addgroup -g 1001 -S w2m && \
    adduser -u 1001 -S w2m -G w2m

COPY --from=builder --chown=w2m:w2m /app/dist ./dist
COPY --from=builder --chown=w2m:w2m /app/node_modules ./node_modules
COPY --from=builder --chown=w2m:w2m /app/package.json ./

RUN mkdir -p /app/data && chown -R w2m:w2m /app/data

USER w2m

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "process.exit(0)"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=1536", "dist/index.js"]
```

### 10.3 Script de Desarrollo Local

```bash
#!/bin/bash
# scripts/dev.sh

set -e

echo "🚀 Iniciando W2M en modo desarrollo..."
echo "   Simulando entorno t3.small (2 vCPU, 2GB RAM)"

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker no está corriendo"
    exit 1
fi

# Crear directorios de datos si no existen
mkdir -p data/{session,vault,logs}

# Iniciar con límites de recursos
docker-compose up --build

# Nota: docker-compose.override.yml se aplica automáticamente
```

### 10.4 Makefile para Comandos Comunes

```makefile
# Makefile

.PHONY: dev prod build test clean logs shell

# Desarrollo local (simula t3.small)
dev:
	@echo "🔧 Iniciando en modo desarrollo..."
	docker-compose up --build

# Producción local (para testing)
prod:
	@echo "🚀 Iniciando en modo producción..."
	docker-compose -f docker-compose.yml up --build

# Build de imagen de producción
build:
	@echo "📦 Construyendo imagen de producción..."
	docker build --target production -t w2m:latest .

# Tests
test:
	@echo "🧪 Ejecutando tests..."
	npm run test

# Limpiar
clean:
	@echo "🧹 Limpiando..."
	docker-compose down -v
	rm -rf dist/
	rm -rf data/logs/*

# Ver logs
logs:
	docker-compose logs -f w2m

# Shell en el contenedor
shell:
	docker-compose exec w2m /bin/sh

# Verificar uso de recursos
stats:
	docker stats w2m --no-stream
```

### 10.5 Checklist de Paridad

| Aspecto | Desarrollo | Producción | Cómo Verificar |
|---------|------------|------------|----------------|
| RAM Limit | 2GB | 2GB | `docker stats` |
| CPU Limit | 2 cores | 2 cores | `docker stats` |
| Node.js | 20 Alpine | 20 Alpine | `node --version` |
| OS Base | Alpine | Alpine | `cat /etc/os-release` |
| Git | Instalado | Instalado | `git --version` |
| Timezone | UTC | UTC | `date` |
| User | w2m (1001) | w2m (1001) | `id` |

---

## 11. CI/CD: Despliegue Automático a EC2

### 11.1 Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD PIPELINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   DESARROLLADOR                                                             │
│        │                                                                    │
│        │ git push origin main                                               │
│        ▼                                                                    │
│   ┌─────────────────┐                                                      │
│   │    GitHub       │                                                      │
│   │    (Repo W2M)   │                                                      │
│   └────────┬────────┘                                                      │
│            │                                                                │
│            │ trigger: push to main                                          │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────┐              │
│   │                  GitHub Actions                          │              │
│   │  ┌─────────────────────────────────────────────────┐    │              │
│   │  │ Job 1: Test                                      │    │              │
│   │  │  - npm ci                                        │    │              │
│   │  │  - npm run lint                                  │    │              │
│   │  │  - npm run test                                  │    │              │
│   │  └─────────────────────────────────────────────────┘    │              │
│   │                         │                                │              │
│   │                         ▼                                │              │
│   │  ┌─────────────────────────────────────────────────┐    │              │
│   │  │ Job 2: Build & Push                              │    │              │
│   │  │  - docker build --target production              │    │              │
│   │  │  - docker push ghcr.io/usuario/w2m:latest       │    │              │
│   │  └─────────────────────────────────────────────────┘    │              │
│   │                         │                                │              │
│   │                         ▼                                │              │
│   │  ┌─────────────────────────────────────────────────┐    │              │
│   │  │ Job 3: Deploy                                    │    │              │
│   │  │  - SSH al EC2                                    │    │              │
│   │  │  - docker-compose pull                           │    │              │
│   │  │  - docker-compose up -d                          │    │              │
│   │  └─────────────────────────────────────────────────┘    │              │
│   └─────────────────────────────────────────────────────────┘              │
│                                                                             │
│                                    │                                        │
│                                    ▼                                        │
│                          ┌─────────────────┐                               │
│                          │   AWS EC2       │                               │
│                          │   t3.small      │                               │
│                          │                 │                               │
│                          │  ┌───────────┐  │                               │
│                          │  │  Docker   │  │                               │
│                          │  │  W2M      │  │                               │
│                          │  └───────────┘  │                               │
│                          └─────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

name: Build and Deploy W2M

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ─────────────────────────────────────────────────────────
  # Job 1: Test
  # ─────────────────────────────────────────────────────────
  test:
    name: 🧪 Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run typecheck
      
      - name: Run tests
        run: npm run test

  # ─────────────────────────────────────────────────────────
  # Job 2: Build & Push Docker Image
  # ─────────────────────────────────────────────────────────
  build:
    name: 📦 Build & Push
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    permissions:
      contents: read
      packages: write
    
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          target: production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─────────────────────────────────────────────────────────
  # Job 3: Deploy to EC2
  # ─────────────────────────────────────────────────────────
  deploy:
    name: 🚀 Deploy
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    environment:
      name: production
      url: ${{ secrets.EC2_HOST }}
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/w2m
            
            # Login to GitHub Container Registry
            echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            
            # Pull latest image
            docker-compose pull
            
            # Restart with zero downtime
            docker-compose up -d --remove-orphans
            
            # Cleanup old images
            docker image prune -f
            
            # Verify deployment
            sleep 5
            docker-compose ps
            docker-compose logs --tail=20 w2m

      - name: Notify success
        if: success()
        run: echo "✅ Deployed successfully to EC2"
      
      - name: Notify failure
        if: failure()
        run: echo "❌ Deployment failed"
```

### 11.3 Configuración de Secrets en GitHub

Ir a **Settings → Secrets and variables → Actions** y crear:

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `EC2_HOST` | IP pública o DNS del EC2 | `ec2-XX-XX-XX-XX.compute-1.amazonaws.com` |
| `EC2_USER` | Usuario SSH | `ubuntu` o `ec2-user` |
| `EC2_SSH_KEY` | Llave privada SSH | Contenido de `~/.ssh/id_rsa` |

### 11.4 Setup Inicial del EC2

```bash
#!/bin/bash
# scripts/setup-ec2.sh
# Ejecutar UNA VEZ en el EC2 para configuración inicial

set -e

echo "🔧 Configurando EC2 para W2M..."

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Configurar Swap (2GB para t3.small)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Crear directorio del proyecto
mkdir -p ~/w2m/data/{session,vault,logs}
cd ~/w2m

# Descargar docker-compose.yml de producción
# (O clonarlo del repo)
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  w2m:
    image: ghcr.io/TU_USUARIO/w2m:latest
    container_name: w2m
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1536M
        reservations:
          memory: 512M
    env_file:
      - .env
    environment:
      - NODE_OPTIONS=--max-old-space-size=1024
    volumes:
      - ./data/session:/app/data/session
      - ./data/vault:/app/data/vault
      - ./data/logs:/app/data/logs
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOF

# Crear archivo .env
cat > .env << 'EOF'
# Configurar según necesidades
WA_SESSION_PATH=./data/session
VAULT_PATH=./data/vault
GIT_ENABLED=true
LOG_LEVEL=info
EOF

echo "✅ EC2 configurado. Recuerda:"
echo "   1. Cerrar sesión y volver a entrar (para grupo docker)"
echo "   2. Configurar .env con tus valores"
echo "   3. Configurar Git credentials para el vault"
```

### 11.5 docker-compose.prod.yml (Producción)

```yaml
# docker-compose.prod.yml
# Usar en EC2 para producción

version: '3.8'

services:
  w2m:
    image: ghcr.io/${GITHUB_REPOSITORY:-usuario/w2m}:latest
    container_name: w2m
    restart: unless-stopped
    
    deploy:
      resources:
        limits:
          memory: 1536M      # Dejar 512MB para sistema en t3.small
        reservations:
          memory: 512M
    
    env_file:
      - .env
    
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=1024
      - TZ=UTC
    
    volumes:
      - ./data/session:/app/data/session
      - ./data/vault:/app/data/vault
      - ./data/logs:/app/data/logs
      - ~/.ssh:/home/w2m/.ssh:ro
      - ~/.gitconfig:/home/w2m/.gitconfig:ro
    
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 60s
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  # Opcional: Watchtower para auto-updates
  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=300    # Check cada 5 min
      - WATCHTOWER_INCLUDE_STOPPED=false
    command: w2m    # Solo monitorear el contenedor w2m
```

### 11.6 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE DESARROLLO A PRODUCCIÓN                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   LOCAL (tu PC)                   GITHUB                    EC2 (AWS)       │
│   ─────────────                   ──────                    ─────────       │
│                                                                             │
│   ┌─────────────┐                                                          │
│   │ Editar      │                                                          │
│   │ código      │                                                          │
│   └──────┬──────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────┐                                                          │
│   │ docker-     │  (simula t3.small)                                       │
│   │ compose up  │                                                          │
│   └──────┬──────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────┐                                                          │
│   │ Tests OK?   │──No──▶ Fix code ──┐                                      │
│   └──────┬──────┘                   │                                      │
│          │ Yes                      │                                      │
│          ◀──────────────────────────┘                                      │
│          │                                                                  │
│          ▼                                                                  │
│   ┌─────────────┐         ┌─────────────┐                                  │
│   │ git push    │────────▶│  GitHub     │                                  │
│   │ origin main │         │  Repo       │                                  │
│   └─────────────┘         └──────┬──────┘                                  │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌─────────────┐                                  │
│                           │  GitHub     │                                  │
│                           │  Actions    │                                  │
│                           └──────┬──────┘                                  │
│                                  │                                          │
│                    ┌─────────────┼─────────────┐                           │
│                    │             │             │                           │
│                    ▼             ▼             ▼                           │
│              ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│              │  Test   │  │  Build  │  │  Push   │                         │
│              │  Job    │─▶│  Image  │─▶│  GHCR   │                         │
│              └─────────┘  └─────────┘  └────┬────┘                         │
│                                             │                               │
│                                             ▼                               │
│                                       ┌─────────┐        ┌─────────────┐   │
│                                       │  SSH    │───────▶│   EC2       │   │
│                                       │  Deploy │        │   t3.small  │   │
│                                       └─────────┘        └──────┬──────┘   │
│                                                                 │          │
│                                                                 ▼          │
│                                                          ┌─────────────┐   │
│                                                          │ docker pull │   │
│                                                          │ docker up   │   │
│                                                          └─────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Conclusión

Este documento establece las bases técnicas para W2M, un framework de ingestión de mensajes diseñado con:

- **Eficiencia**: Stack optimizado para ≤2GB RAM (t3.small)
- **Extensibilidad**: Arquitectura de plugins trivialmente extensible
- **Robustez**: Manejo de errores, reconexión automática y resolución de conflictos
- **Soberanía**: Todo el control en infraestructura del usuario
- **DevOps**: Paridad desarrollo/producción y CI/CD automatizado

El siguiente paso es comenzar la implementación del MVP siguiendo la estructura y patrones definidos en este TDD.

---

*Documento generado por Arquitecto de Software PKM - Diciembre 2025*

