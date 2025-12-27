// W2M - Configuration
import { config } from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
config();

const configSchema = z.object({
  // WhatsApp
  WA_SESSION_PATH: z.string().default('./data/session'),
  WA_ALLOWED_GROUPS: z.string().default('').transform((val) => 
    val ? val.split(',').map(g => g.trim()).filter(Boolean) : []
  ),
  WA_QR_TIMEOUT: z.coerce.number().default(60000),
  WA_RECONNECT_INTERVAL: z.coerce.number().default(5000),
  
  // Vault
  VAULT_PATH: z.string().default('./data/vault'),
  VAULT_DATE_FORMAT: z.string().default('yyyy-MM-dd'),
  VAULT_ENABLE_FRONTMATTER: z.coerce.boolean().default(true),
  
  // Git Sync
  GIT_ENABLED: z.coerce.boolean().default(true),
  GIT_REMOTE: z.string().default('origin'),
  GIT_BRANCH: z.string().default('main'),
  GIT_COMMIT_PREFIX: z.string().default('[W2M]'),
  GIT_SYNC_INTERVAL: z.coerce.number().default(300000),
  
  // Feedback
  FEEDBACK_CONFIRMATIONS: z.coerce.boolean().default(true),
  FEEDBACK_ERRORS: z.coerce.boolean().default(true),
  FEEDBACK_RATE_LIMIT: z.coerce.number().default(1000),
  
  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('pretty'), // pretty por defecto para ver QR mejor
  
  // Memory
  NODE_MAX_OLD_SPACE: z.coerce.number().default(1024),
  
  // Timezone
  TZ: z.string().default('America/Santiago'),
  
  // Web Dashboard
  WEB_ENABLED: z.coerce.boolean().default(true),
  WEB_PORT: z.coerce.number().default(3000),
  WEB_HOST: z.string().default('0.0.0.0'),
  
  // Storage
  STORAGE_TYPE: z.enum(['local', 'googledrive', 'git']).default('local'),
  
  // Google Drive OAuth (para autenticación de usuario)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  
  // Google Drive Service Account (más simple, sin OAuth)
  GOOGLE_SERVICE_ACCOUNT_PATH: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

let appConfig: Config | null = null;

export function getConfig(): Config {
  if (!appConfig) {
    appConfig = configSchema.parse(process.env);
  }
  return appConfig;
}

