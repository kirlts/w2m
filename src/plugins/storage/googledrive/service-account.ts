// W2M - Google Drive Service Account Authentication
// Autenticación usando Service Account (más simple, sin OAuth)

import { google } from 'googleapis';
import { getConfig } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Obtener cliente autenticado usando Service Account
 */
export async function getServiceAccountClient() {
  const config = getConfig();
  
  if (!config.GOOGLE_SERVICE_ACCOUNT_PATH) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH debe estar configurado con la ruta al archivo JSON de Service Account');
  }

  if (!existsSync(config.GOOGLE_SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Archivo de Service Account no encontrado: ${config.GOOGLE_SERVICE_ACCOUNT_PATH}`);
  }

  try {
    const credentials = JSON.parse(await readFile(config.GOOGLE_SERVICE_ACCOUNT_PATH, 'utf-8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.file', // Solo archivos creados por la app
      ],
    });

    logger.info({ serviceAccountEmail: credentials.client_email }, '✅ Service Account autenticado');
    
    return auth;
  } catch (error: any) {
    logger.error({ error: error.message, path: config.GOOGLE_SERVICE_ACCOUNT_PATH }, '❌ Error al cargar Service Account');
    throw new Error(`Error al cargar Service Account: ${error.message}`);
  }
}

/**
 * Verificar si Service Account está configurado
 */
export function isServiceAccountConfigured(): boolean {
  const config = getConfig();
  return !!config.GOOGLE_SERVICE_ACCOUNT_PATH && existsSync(config.GOOGLE_SERVICE_ACCOUNT_PATH);
}

