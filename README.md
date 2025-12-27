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
- 🔄 **Git Auto-sync** - Automatic synchronization with your repository
- 🐳 **Docker Ready** - Simple deployment on any server
- 🔒 **Data Sovereignty** - Everything in your infrastructure, no external service dependencies
- ⚡ **Low Resource Consumption** - Optimized for resource-constrained environments (e.g., AWS t3.small)

## 🏗️ Modular Architecture

W2M uses a plugin-based architecture to keep the codebase clean and extensible:

```
┌─────────────────────────────────────────────────────────┐
│                     W2M Core                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   CLI        │  │  Group Mgmt  │  │  Config      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                      │
                      │ Implements
                      ▼
          ┌───────────────────────┐
          │  IngestorInterface    │
          └───────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ Baileys │ │ Plugin2 │ │ Plugin3 │
    │ Plugin  │ │  (TBD)  │ │  (TBD)  │
    └─────────┘ └─────────┘ └─────────┘
```

W2M's core **does not include** WhatsApp-specific or other platform-specific dependencies. These are installed as optional plugins.

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
./scripts/dev.sh

# Or manually:
BUILD_TARGET=development NODE_ENV=development LOG_LEVEL=debug LOG_FORMAT=pretty \
  docker-compose up --build
```

#### Production Testing (Local)

```bash
# Test production build locally
./scripts/test-production-local.sh

# Or manually:
BUILD_TARGET=production docker-compose up --build
```

## 🔌 Available Plugins

### Baileys Plugin (WhatsApp)

The Baileys plugin allows connecting W2M to WhatsApp using the [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) library.

#### Installation

```bash
npm install @whiskeysockets/baileys @hapi/boom qrcode-terminal
```

Or if using Docker, these dependencies are automatically installed from `optionalDependencies`.

#### Configuration

The plugin activates automatically if dependencies are installed. Configure the following variables in your `.env`:

```env
# Ingestor type (default: 'baileys')
INGESTOR_TYPE=baileys

# Path to store WhatsApp session
WA_SESSION_PATH=./data/session

# QR code scan timeout (in ms)
WA_QR_TIMEOUT=60000
```

#### Usage

1. Start W2M: `npm start` or `docker-compose up`
2. Select option `1` in the CLI to generate a QR code
3. Scan the QR with WhatsApp (Settings → Linked Devices)
4. Once connected, add groups to monitor using option `4`

## 📖 How to Add a New Plugin

W2M is designed to be extensible. You can create plugins for any messaging platform by following these steps:

### 1. Create Plugin Structure

Create a new directory in `src/plugins/your-plugin/`:

```
src/plugins/your-plugin/
├── index.ts          # Plugin implementation
└── README.md         # Plugin documentation (optional)
```

### 2. Implement the `IngestorInterface`

Your plugin must implement the `IngestorInterface`:

```typescript
// src/plugins/your-plugin/index.ts
import { IngestorInterface, Message, Group, ConnectionState } from '../../core/ingestor/interface.js';
import { GroupManager } from '../../core/groups/index.js';
import { logger } from '../../utils/logger.js';

export class YourPluginIngestor implements IngestorInterface {
  private groupManager: GroupManager;
  private connectionState: ConnectionState = 'disconnected';

  constructor(groupManager?: GroupManager) {
    this.groupManager = groupManager || new GroupManager();
  }

  async initialize(): Promise<void> {
    await this.groupManager.load();
  }

  async start(): Promise<void> {
    // Your connection logic here
    this.connectionState = 'connected';
  }

  async stop(): Promise<void> {
    // Your disconnection logic here
    this.connectionState = 'disconnected';
  }

  async generateQR(): Promise<void> {
    // If your platform uses QR, implement here
    // Otherwise, you can throw an error or show instructions
    throw new Error('QR not supported for this plugin');
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  onConnected(callback: () => void): void {
    // Register callback for when connected
  }

  onMessage(callback: (message: Message) => void): void {
    // Register callback for when a message is received
    // When you receive a message, call: callback(messageData);
  }

  async listGroups(): Promise<Group[]> {
    // Return list of available groups
    return [];
  }
}
```

### 3. Register Plugin in Factory

Update `src/core/ingestor/factory.ts` to include your new plugin:

```typescript
export async function createIngestor(groupManager?: GroupManager): Promise<IngestorInterface> {
  const ingestorType = process.env.INGESTOR_TYPE || 'baileys';

  try {
    switch (ingestorType) {
      case 'baileys': {
        const { BaileysIngestor } = await import('../../plugins/baileys/index.js');
        return new BaileysIngestor(groupManager);
      }
      
      case 'your-plugin': {
        const { YourPluginIngestor } = await import('../../plugins/your-plugin/index.js');
        return new YourPluginIngestor(groupManager);
      }
      
      default:
        throw new Error(`Unknown ingestor type: ${ingestorType}`);
    }
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      logger.error('Plugin not installed. Please install required dependencies.');
      throw new Error('Plugin not available.');
    }
    throw error;
  }
}
```

### 4. Add Optional Dependencies

If your plugin requires external dependencies, add them to `optionalDependencies` in `package.json`:

```json
{
  "optionalDependencies": {
    "@whiskeysockets/baileys": "^7.0.0-rc.9",
    "your-library": "^1.0.0"
  }
}
```

### 5. Document the Plugin

Create a `README.md` in your plugin directory explaining:

- How to install dependencies
- Required configuration
- Specific features
- Usage examples

### Complete Example

See the Baileys plugin code in `src/plugins/baileys/index.ts` as a complete reference.

## ⚙️ Configuration

See [`.env.example`](.env.example) for all available options.

### Main Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INGESTOR_TYPE` | Plugin type to use (`baileys`, etc.) | `baileys` |
| `WA_SESSION_PATH` | Path for sessions (Baileys plugin) | `./data/session` |
| `VAULT_PATH` | Markdown vault path | `./data/vault` |
| `GIT_ENABLED` | Enable Git sync | `false` |
| `LOG_LEVEL` | Logging level | `info` |
| `WEB_ENABLED` | Enable web dashboard | `true` |
| `WEB_PORT` | Web dashboard port | `3000` |
| `WEB_HOST` | Web dashboard host | `0.0.0.0` |

## 🌐 Web Dashboard

W2M includes a lightweight web dashboard for easy management without SSH access.

### Accessing the Dashboard

#### After CI/CD Deployment (EC2)

Once your CI/CD pipeline has deployed W2M to EC2, follow these steps:

1. **Get your EC2 Public IP**:
   - Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
   - Find your instance
   - Copy the **Public IPv4 address** (e.g., `52.54.190.237`)

2. **Configure Security Group** (if not already done):
   - Select your EC2 instance → **Security** tab → Click **Security groups**
   - Click **Edit inbound rules**
   - Click **Add rule**:
     - **Type**: Custom TCP
     - **Port**: `3000`
     - **Source**: Your IP address (or `0.0.0.0/0` for any IP - less secure)
   - Click **Save rules**

3. **Access the Dashboard**:
   - Open your browser
   - Navigate to: `http://YOUR-EC2-IP:3000/web`
   - Example: `http://52.54.190.237:3000/web`

**⚠️ Security Note**: Using `0.0.0.0/0` allows access from any IP. For better security, use your specific IP address or use a VPN.

#### Local Development

- **Local**: `http://localhost:3000/web`

### Dashboard Features

- **Connection Status**: Real-time connection status with connect/disconnect buttons
- **QR Code Display**: Visual QR code for WhatsApp authentication
- **Real-time Logs**: Live log streaming via Server-Sent Events
- **Group Management**: Add/remove monitored groups
- **Category Management**: Create, configure, and delete categories
- **Markdown Viewer**: View and copy category markdown content
- **Google Drive Status**: Check Google Drive sync configuration and status

### Troubleshooting Access

**Can't access the dashboard?**

1. **Check if the container is running**:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   docker-compose ps
   ```

2. **Check logs**:
   ```bash
   docker-compose logs w2m
   ```

3. **Verify Security Group**:
   - Ensure port 3000 is open in the Security Group
   - Check that your IP is allowed (or 0.0.0.0/0)

4. **Verify WEB_ENABLED**:
   - Check your `.env` file: `WEB_ENABLED=true`
   - Restart if needed: `docker-compose restart w2m`

5. **Check firewall on EC2**:
   ```bash
   sudo ufw status
   # If enabled, allow port 3000:
   sudo ufw allow 3000/tcp
   ```

## 📁 Message Categories

W2M supports automatic message categorization. Messages matching the format `CATEGORY<separator>content` are saved to category-specific markdown files.

### Category Features

- **Custom Separator**: Each category can have its own separator (1-3 characters, default: `,,`)
- **Configurable Fields**: Choose which fields to include (AUTOR, HORA, FECHA, CONTENIDO)
- **Markdown Export**: View and copy generated markdown via CLI or dashboard

### Example Message

```
CODE,,function test() { return true; }
```

This message will be saved to `data/vault/categories/code.md` if a "CODE" category exists with separator `,,`.

## ☁️ Google Drive Synchronization

W2M can automatically sync your markdown files to Google Drive, keeping your data backed up and accessible from anywhere.

### Setup

**Advantages:**
- ✅ No browser authentication required
- ✅ No redirect URIs needed
- ✅ Works automatically on servers
- ✅ No IP/domain restrictions

**Setup Steps:**

1. **Create Service Account in GCP:**
   - Follow the detailed guide: [`docs/GCP-SERVICE-ACCOUNT-SETUP.md`](docs/GCP-SERVICE-ACCOUNT-SETUP.md)
   - Create a Service Account in Google Cloud Console
   - Download the JSON credentials file

2. **Upload JSON to Server:**
   ```bash
   scp -i your-key.pem service-account.json ubuntu@your-ec2:/home/ubuntu/w2m/data/googledrive/service-account.json
   ```

3. **Configure `.env`:**
   ```env
   STORAGE_TYPE=googledrive
   GOOGLE_SERVICE_ACCOUNT_PATH=./data/googledrive/service-account.json
   ```

4. **(Optional) Share Folder:**
   - Create a folder "W2M" in your Google Drive
   - Share it with the Service Account email (found in the JSON file)
   - Give it "Editor" permissions
   - This allows you to see files in your personal Drive

### How It Works

- **Automatic Sync**: All markdown files are automatically uploaded to Google Drive
- **Folder Structure**: Files are organized in a "W2M" folder in Google Drive
- **Unidirectional**: W2M pushes changes to Drive (no sync from Drive to W2M)
- **Real-time**: Files are uploaded immediately when messages are categorized

### Storage Location

Files are stored in Google Drive under:
```
W2M/
├── categories/
│   ├── code.md
│   ├── notes.md
│   └── ...
└── ...
```

### Dashboard Integration

The web dashboard shows:
- ✅ Connection status
- ✅ Storage type (Local or Google Drive)
- ✅ Quick setup instructions
- ✅ Service Account configuration status

### Troubleshooting

**Files not appearing in your Drive:**
- Service Account creates files in its own Drive (not visible in your personal Drive)
- Solution: Share a folder with the Service Account email (see Option 1, step 4)

**Authentication errors:**
- Verify the JSON file path is correct
- Check file permissions: `chmod 600 service-account.json`
- Ensure Google Drive API is enabled in GCP

**See detailed guide:**
- [`docs/GCP-SERVICE-ACCOUNT-SETUP.md`](docs/GCP-SERVICE-ACCOUNT-SETUP.md) - Complete Service Account setup guide

## 📁 Project Structure

```
w2m/
├── src/
│   ├── core/              # Framework core
│   │   ├── ingestor/      # Ingestor interface and factory
│   │   ├── groups/        # Monitored groups management
│   │   └── categories/    # Category management and writer
│   ├── plugins/           # Platform plugins
│   │   └── baileys/       # WhatsApp plugin (Baileys)
│   ├── web/               # Web dashboard (Hono, HTMX)
│   ├── cli/               # Command-line interface
│   ├── config/            # Configuration management
│   └── utils/             # Utilities
├── scripts/               # Utility scripts
│   ├── dev.sh             # Development mode script
│   └── test-production-local.sh  # Local production testing
├── data/                  # Application data (generated)
└── dist/                  # Compiled code (generated)
```

## 🐳 Docker

### Usage Modes

W2M supports different Docker deployment modes via a single `docker-compose.yml` file:

**Production (EC2)**: Uses pre-built image from GitHub Container Registry (GHCR)
```bash
docker-compose up
```

**Development**: Builds locally with hot-reload
```bash
BUILD_TARGET=development NODE_ENV=development LOG_LEVEL=debug LOG_FORMAT=pretty \
  docker-compose up --build
```

**Production Testing**: Builds production image locally
```bash
BUILD_TARGET=production docker-compose up --build
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

# Open shell in container
docker-compose exec w2m sh
```

### Interacting with W2M in Production (EC2 via SSH)

Once deployed to EC2, you can interact with W2M's CLI via SSH:

```bash
# 1. Connect to your EC2 instance
ssh -i ~/.ssh/your-key.pem ubuntu@your-ec2-ip

# 2. Attach to the running container to interact with the CLI
docker attach w2m

# To detach without stopping the container: Press Ctrl+P, then Ctrl+Q
# (DO NOT use Ctrl+C directly as it will stop the container)

# 3. View logs without attaching (non-interactive)
docker-compose logs -f w2m

# 4. Check container status
docker-compose ps

# 5. Restart the container
docker-compose restart w2m

# 6. Pull latest image and update (manual update)
cd ~/w2m
docker-compose pull
docker-compose up -d --remove-orphans
```

**Note**: The CI/CD pipeline automatically updates the container when you push to `main`. Manual updates are only needed if you want to update outside of the CI/CD workflow.

### Memory Limits

The container is configured to use a maximum of 1536MB RAM, optimized for EC2 Free Tier instances (t3.small).

### Timezone Configuration

By default, the container uses `America/Santiago` timezone. To change it:

1. **Set TZ environment variable** in your `.env` file:
   ```env
   TZ=America/New_York
   ```

2. **Or use your system timezone** - The docker-compose.yml mounts `/etc/localtime` from the host, which will automatically use your system's timezone if available.

Common timezones:
- `America/Santiago` - Chile
- `America/New_York` - US Eastern
- `America/Los_Angeles` - US Pacific
- `Europe/Madrid` - Spain
- `Europe/London` - UK

See [List of tz database time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) for all available timezones.

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

# Tests
npm run test

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck
```

### Using Makefile

```bash
# Development mode
make dev

# Production mode (local testing)
make prod

# Build production image
make build

# View logs
make logs

# View resource stats
make stats

# Clean up
make clean

# See all available commands
make help
```

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
- [simple-git](https://github.com/steveukx/git-js) - Git wrapper for Node.js
- [pino](https://github.com/pinojs/pino) - Ultra-fast logger

---

**W2M** - Transform ephemeral communication into permanent knowledge 🚀
