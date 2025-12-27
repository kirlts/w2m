// W2M - Google Drive OAuth Manager
// Maneja el flujo OAuth 2.0 para Google Drive

import { google } from 'googleapis';
import { getConfig } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

const TOKEN_PATH = './data/googledrive/token.json';
const CREDENTIALS_PATH = './data/googledrive/credentials.json';

export interface OAuthTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
}

/**
 * Obtener cliente OAuth2 configurado
 */
export function getOAuth2Client() {
  const config = getConfig();
  
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar configurados');
  }

  const oauth2Client = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REDIRECT_URI || 'http://localhost:3000/web/api/oauth/googledrive/callback'
  );

  return oauth2Client;
}

/**
 * Generar URL de autorización
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/drive.file', // Solo archivos creados por la app
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Forzar consent para obtener refresh_token
  });

  return authUrl;
}

/**
 * Intercambiar código de autorización por tokens
 */
export async function getTokensFromCode(code: string): Promise<OAuthTokens> {
  const oauth2Client = getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  };
}

/**
 * Guardar tokens en archivo
 */
export async function saveTokens(tokens: OAuthTokens): Promise<void> {
  try {
    const dir = dirname(TOKEN_PATH);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
    logger.info({}, '✅ Tokens de Google Drive guardados');
  } catch (error) {
    logger.error({ error }, '❌ Error al guardar tokens de Google Drive');
    throw error;
  }
}

/**
 * Cargar tokens desde archivo
 */
export async function loadTokens(): Promise<OAuthTokens | null> {
  try {
    if (!existsSync(TOKEN_PATH)) {
      return null;
    }
    
    const content = await readFile(TOKEN_PATH, 'utf-8');
    return JSON.parse(content) as OAuthTokens;
  } catch (error) {
    logger.error({ error }, '❌ Error al cargar tokens de Google Drive');
    return null;
  }
}

/**
 * Verificar si hay tokens guardados
 */
export async function hasTokens(): Promise<boolean> {
  const tokens = await loadTokens();
  return tokens !== null && tokens.refresh_token !== null;
}

/**
 * Obtener cliente OAuth2 autenticado
 */
export async function getAuthenticatedClient() {
  const oauth2Client = getOAuth2Client();
  const tokens = await loadTokens();
  
  if (!tokens || !tokens.refresh_token) {
    throw new Error('No hay tokens guardados. Debes autenticarte primero.');
  }
  
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token || undefined,
  });
  
  // Verificar si el token está expirado y refrescarlo si es necesario
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await saveTokens({
        access_token: credentials.access_token || null,
        refresh_token: tokens.refresh_token, // Mantener el refresh_token
        scope: credentials.scope || null,
        token_type: credentials.token_type || null,
        expiry_date: credentials.expiry_date || null,
      });
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      logger.error({ error }, '❌ Error al refrescar token de Google Drive');
      throw new Error('Error al refrescar token. Reautentica la aplicación.');
    }
  } else {
    oauth2Client.setCredentials({
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      scope: tokens.scope || undefined,
      token_type: tokens.token_type || undefined,
      expiry_date: tokens.expiry_date || undefined,
    });
  }
  
  return oauth2Client;
}

