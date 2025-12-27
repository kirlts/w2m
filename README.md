# 📱➡️📝 W2M (WhatsApp to Markdown)

> Modular and extensible universal ingestion framework to transform ephemeral messages into structured knowledge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)

## 🎯 What is W2M?

W2M is a modular framework designed to capture ephemeral information streams and transform them into structured Markdown files, ready to be consumed by any Personal Knowledge Management (PKM) tool:

- 📓 **Obsidian**
- 📋 **Logseq**
- 💻 **VS Code / Cursor**
- 📄 **Any text editor**

## ✨ Key Features

- 🔌 **Modular Architecture** - Decoupled plugin system for different messaging sources
- 🧩 **Extensible** - Easy to add new plugins and integrations
- 🌐 **Web Dashboard** - Real-time monitoring, QR display, and configuration via browser
- 📁 **Category System** - Automatic message categorization with customizable separators
- ☁️ **Google Drive Sync** - OAuth or Service Account integration for cloud backup
- 🔄 **Hybrid Storage** - Always saves locally first, syncs to cloud when available
- 🐳 **Docker Ready** - Simple deployment on any server
- 🔒 **Data Sovereignty** - Everything in your infrastructure, no external service dependencies
- ⚡ **Low Resource Consumption** - Optimized for resource-constrained environments (e.g., AWS t3.small)

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose (optional, for deployment)
- Account on the messaging platform you want to use

### Basic Installation

```bash
# Clone the repository
git clone https://github.com/your-username/w2m.git
cd w2m

# Install base dependencies
npm install

# Install WhatsApp plugin (Baileys) - OPTIONAL
npm install @whiskeysockets/baileys @hapi/boom qrcode-terminal

# Copy configuration
cp env.example .env

# Edit configuration
nano .env

# Build
npm run build

# Start
npm start
```

### Docker Installation

#### Production (EC2)

```bash
# Clone the repository
git clone https://github.com/your-username/w2m.git
cd w2m

# Copy configuration
cp env.example .env

# Edit configuration
nano .env

# Start W2M (uses image from GHCR)
docker-compose up -d

# View logs
docker-compose logs -f w2m
```

#### Development (Local)

```bash
# Start in development mode with hot-reload
BUILD_TARGET=development NODE_ENV=development LOG_LEVEL=debug LOG_FORMAT=pretty \
  docker-compose up --build
```

## 🔌 Available Plugins

### Baileys Plugin (WhatsApp)

The Baileys plugin allows connecting W2M to WhatsApp using the [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) library.

**Installation**: `npm install @whiskeysockets/baileys @hapi/boom qrcode-terminal`

**Configuration**: Set `INGESTOR_TYPE=baileys` in your `.env` file.

**Usage**: 
1. Start W2M: `npm start` or `docker-compose up`
2. Generate QR code via CLI (option 1) or web dashboard
3. Scan QR with WhatsApp (Settings → Linked Devices)
4. Add groups to monitor

## 🌐 Web Dashboard

W2M includes a lightweight web dashboard for easy management without SSH access.

### Accessing the Dashboard

**After CI/CD Deployment (EC2)**:
1. Get your EC2 Public IP from AWS Console
2. Configure Security Group to allow TCP port 3000
3. Access: `http://YOUR-EC2-IP:3000/web`

**Local Development**: `http://localhost:3000/web`

### Dashboard Features

- **Connection Status**: Real-time connection status with connect/disconnect buttons
- **QR Code Display**: Visual QR code for WhatsApp authentication
- **Real-time Logs**: Live log streaming via Server-Sent Events
- **Group Management**: Add/remove monitored groups
- **Category Management**: Create, configure, and delete categories
- **Markdown Viewer**: View and copy category markdown content
- **Google Drive Setup**: OAuth authorization flow for Google Drive sync

## ☁️ Google Drive Synchronization

W2M supports two methods to sync with Google Drive:

### Method 1: OAuth (Recommended)

Uses your personal Google Drive account (15 GB free). Perfect for personal use.

**Setup**: See [`docs/GOOGLE-DRIVE-OAUTH-SETUP.md`](docs/GOOGLE-DRIVE-OAUTH-SETUP.md)

**Quick Steps**:
1. Create OAuth Client ID in Google Cloud Console (Desktop app type)
2. Download JSON and upload to `./data/googledrive/oauth-credentials.json`
3. Set `STORAGE_TYPE=googledrive` in `.env`
4. Authorize via web dashboard

### Method 2: Service Account

For Google Workspace / Shared Drives only. Service Accounts have no storage quota.

**Setup**: See [`docs/GCP-SERVICE-ACCOUNT-SETUP.md`](docs/GCP-SERVICE-ACCOUNT-SETUP.md)

**Note**: Service Accounts require a shared folder to work properly.

### How It Works

- **Hybrid Storage**: Always saves locally first, then syncs to Google Drive
- **Auto-fallback**: If Drive fails, continues with local storage only
- **Unidirectional**: W2M pushes changes to Drive (no sync from Drive to W2M)
- **Real-time**: Files are uploaded immediately when messages are categorized

## 📁 Message Categories

W2M supports automatic message categorization. Messages matching the format `CATEGORY<separator>content` are saved to category-specific markdown files.

### Example Message

```
CODE,,function test() { return true; }
```

This message will be saved to `data/vault/categories/code.md` if a "CODE" category exists with separator `,,`.

### Category Features

- **Custom Separator**: Each category can have its own separator (1-3 characters, default: `,,`)
- **Configurable Fields**: Choose which fields to include (AUTOR, HORA, FECHA, CONTENIDO)
- **Markdown Export**: View and copy generated markdown via CLI or dashboard

## ⚙️ Configuration

See [`.env.example`](.env.example) for all available options.

### Main Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INGESTOR_TYPE` | Plugin type to use (`baileys`, etc.) | `baileys` |
| `STORAGE_TYPE` | Storage type (`local`, `googledrive`, `git`) | `local` |
| `WA_SESSION_PATH` | Path for sessions (Baileys plugin) | `./data/session` |
| `VAULT_PATH` | Markdown vault path | `./data/vault` |
| `WEB_ENABLED` | Enable web dashboard | `true` |
| `WEB_PORT` | Web dashboard port | `3000` |
| `WEB_HOST` | Web dashboard host | `0.0.0.0` |
| `TZ` | System timezone | `America/Santiago` |
| `LOG_LEVEL` | Logging level | `info` |

## 🐳 Docker

### Usage Modes

W2M supports different Docker deployment modes via a single `docker-compose.yml` file:

**Production (EC2)**: Uses pre-built image from GitHub Container Registry (GHCR)
```bash
docker-compose up -d
```

**Development**: Builds locally with hot-reload
```bash
BUILD_TARGET=development NODE_ENV=development LOG_LEVEL=debug LOG_FORMAT=pretty \
  docker-compose up --build
```

### Useful Commands

```bash
# View logs
docker-compose logs -f w2m

# Restart
docker-compose restart w2m

# Stop
docker-compose down

# View resource usage
docker stats w2m
```

## 📊 System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 512 MB | 1 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 1 GB | 5 GB |
| Node.js | >= 20.0.0 | >= 20.0.0 |

## 🛠️ Development

```bash
# Install base dependencies
npm install

# Install Baileys plugin (for development)
npm install @whiskeysockets/baileys @hapi/boom qrcode-terminal

# Development with hot-reload
npm run dev

# Build
npm run build

# Run
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

## 📚 Documentation

**For complete technical documentation**, see [`w2m.md`](w2m.md). It includes:

- Complete architecture overview
- Component details and interfaces
- Data flows and processes
- Plugin development guide
- Storage system documentation
- Configuration reference
- Docker and deployment guide
- LLM development guide

## 🔒 Legal Considerations

**IMPORTANT**: W2M is an agnostic framework and does not include WhatsApp-specific or other platform-specific code in its core. Plugins are optional and installed by the user. Please ensure that:

1. You comply with the Terms of Service of the platforms you use
2. You do not use W2M for illegal or unauthorized activities
3. You respect user privacy
4. You use plugins at your own risk

The Baileys plugin is included as an optional dependency for convenience, but you can create your own plugins for other platforms.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-plugin`)
3. Commit your changes (`git commit -am 'Add new plugin'`)
4. Push to the branch (`git push origin feature/my-plugin`)
5. Open a Pull Request

## 📄 License

MIT © 2025

## 🙏 Acknowledgments

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp WebSocket client (optional plugin)
- [Hono](https://hono.dev/) - Ultrafast web framework
- [HTMX](https://htmx.org/) - Dynamic HTML updates
- [Pino](https://github.com/pinojs/pino) - Ultra-fast logger

---

**W2M** - Transform ephemeral communication into permanent knowledge 🚀
