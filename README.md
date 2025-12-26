# 📱➡️📝 W2M (WhatsApp to Markdown)

> Framework de ingestión universal para transformar chats de WhatsApp en conocimiento estructurado

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)

## 🎯 ¿Qué es W2M?

W2M captura flujos de información efímeros desde WhatsApp y los transforma en archivos Markdown permanentes, listos para ser consumidos por cualquier herramienta de texto plano:

- 📓 **Obsidian**
- 📋 **Logseq**
- 💻 **VS Code / Cursor**
- 📄 **Cualquier editor de texto**

## ✨ Características

- 🔌 **Conexión WebSocket** - Sin navegador headless, mínimo consumo de RAM
- 🧩 **Arquitectura de Plugins** - Añade nuevos comandos fácilmente
- 🔄 **Git Auto-sync** - Sincronización automática con tu repositorio
- 💬 **Feedback Bidireccional** - Confirmaciones y ayuda en el chat
- 🐳 **Docker Ready** - Despliegue sencillo en cualquier servidor
- 🔒 **Soberanía de Datos** - Todo en tu infraestructura

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker y Docker Compose
- Cuenta de WhatsApp
- (Opcional) Repositorio Git para sincronización

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/w2m.git
cd w2m

# Copiar configuración
cp .env.example .env

# Editar configuración
nano .env

# Iniciar W2M
docker-compose up
```

### Escanear QR

1. Observa los logs: `docker-compose logs -f w2m`
2. Escanea el código QR con WhatsApp
3. ¡Listo! W2M está escuchando

## 📖 Comandos Disponibles

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `NOTA:` | Captura una nota rápida | `NOTA: Recordar comprar leche` |
| `TODO:` | Crea una tarea pendiente | `TODO: Revisar documentación` |
| `IDEA:` | Guarda una idea creativa | `IDEA: App para gatos` |
| `LINK:` | Guarda un enlace | `LINK: https://ejemplo.com Artículo interesante` |
| `AYUDA` | Lista comandos disponibles | `AYUDA` |
| `COMANDOS` | Alias de AYUDA | `COMANDOS` |

## 📁 Estructura del Vault

```
vault/
├── notas/           # Notas rápidas
├── todos/           # Tareas pendientes
├── ideas/           # Ideas y brainstorming
├── links/           # Enlaces guardados
└── inbox/           # Mensajes sin clasificar
```

## ⚙️ Configuración

Ver [`.env.example`](.env.example) para todas las opciones disponibles.

### Variables Principales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `WA_ALLOWED_GROUPS` | IDs de grupos a monitorear | - |
| `VAULT_PATH` | Ruta del vault | `./data/vault` |
| `GIT_ENABLED` | Habilitar Git sync | `true` |
| `GIT_SYNC_INTERVAL` | Intervalo de sync (ms) | `300000` |

## 🧩 Crear una Nueva Estrategia

1. Crea un archivo en `src/strategies/`:

```typescript
// src/strategies/mi-comando.strategy.ts
import { BaseStrategy } from './base';

export class MiComandoStrategy extends BaseStrategy {
  readonly name = 'mi-comando';
  readonly displayName = '🎯 Mi Comando';
  readonly description = 'Descripción del comando';
  readonly example = 'MICOMANDO: texto';
  readonly priority = 50;
  readonly triggers = [/^micomando:/i];

  protected async process(message) {
    // Tu lógica aquí
    return { success: true };
  }
}
```

2. Regístrala en `src/strategies/index.ts`

3. ¡Listo! Reinicia W2M

Ver [docs/STRATEGIES.md](docs/STRATEGIES.md) para más detalles.

## 🐳 Docker

### Comandos Útiles

```bash
# Ver logs
docker-compose logs -f w2m

# Reiniciar
docker-compose restart

# Parar
docker-compose down

# Ver uso de recursos
docker stats w2m
```

### Límites de Memoria

El contenedor está configurado para usar máximo 512MB de RAM, optimizado para instancias EC2 Free Tier (t3.micro).

## 📊 Requisitos del Sistema

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 512 MB | 1 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disco | 1 GB | 5 GB |
| Red | Constante | Constante |

## 🛠️ Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo con hot-reload
npm run dev

# Build
npm run build

# Tests
npm run test

# Linting
npm run lint
```

## 📚 Documentación

- [Documento de Diseño Técnico](docs/TDD-W2M.md)
- [Guía de Estrategias](docs/STRATEGIES.md)
- [Contribuir](docs/CONTRIBUTING.md)

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Por favor lee [CONTRIBUTING.md](docs/CONTRIBUTING.md) primero.

## 📄 Licencia

MIT © 2025

## 🙏 Agradecimientos

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - Cliente WebSocket de WhatsApp
- [simple-git](https://github.com/steveukx/git-js) - Wrapper Git para Node.js
- [pino](https://github.com/pinojs/pino) - Logger ultra rápido

---

**W2M** - Transforma la comunicación efímera en conocimiento permanente 🚀

