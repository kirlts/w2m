// W2M - Google Drive OAuth (Headless/Manual)
// Permite autenticación OAuth sin necesidad de dominio HTTPS

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';
import { getConfig } from '../../../config/index.js';
import { logger } from '../../../utils/logger.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Obtener path del archivo de tokens
 */
function getTokensPath(): string {
  const config = getConfig();
  return path.join(config.VAULT_PATH, '.google-oauth-tokens.json');
}

/**
 * Obtener path del archivo de credenciales OAuth
 */
function getCredentialsPath(): string {
  return process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || './data/googledrive/oauth-credentials.json';
}

/**
 * Verificar si OAuth está configurado
 */
export async function isOAuthConfigured(): Promise<boolean> {
  try {
    const credentialsPath = getCredentialsPath();
    await fs.access(credentialsPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verificar si hay tokens guardados
 */
export async function hasOAuthTokens(): Promise<boolean> {
  try {
    const tokensPath = getTokensPath();
    await fs.access(tokensPath);
    const content = await fs.readFile(tokensPath, 'utf-8');
    const tokens = JSON.parse(content);
    return !!tokens.refresh_token;
  } catch {
    return false;
  }
}

/**
 * Cargar credenciales OAuth desde archivo
 */
async function loadOAuthCredentials(): Promise<OAuthConfig> {
  const credentialsPath = getCredentialsPath();
  
  try {
    const content = await fs.readFile(credentialsPath, 'utf-8');
    const credentials = JSON.parse(content);
    
    // Soportar formato de Google Cloud Console (web o installed)
    const config = credentials.web || credentials.installed;
    
    if (!config) {
      throw new Error('Formato de credenciales inválido. Descarga el JSON desde Google Cloud Console.');
    }
    
    return {
      clientId: config.client_id,
      clientSecret: config.client_secret,
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Archivo de credenciales OAuth no encontrado: ${credentialsPath}`);
    }
    throw error;
  }
}

/**
 * Crear cliente OAuth2
 */
async function createOAuth2Client(): Promise<OAuth2Client> {
  const config = await loadOAuthCredentials();
  
  // Usar redirect URI especial para aplicaciones de escritorio/headless
  const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
  
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    redirectUri
  );
}

/**
 * Generar URL de autorización
 */
export async function getAuthorizationUrl(): Promise<string> {
  const oauth2Client = await createOAuth2Client();
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Forzar para obtener refresh_token
  });
  
  return authUrl;
}

/**
 * Intercambiar código de autorización por tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const oauth2Client = await createOAuth2Client();
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw new Error('No se recibió refresh_token. Intenta revocar el acceso en https://myaccount.google.com/permissions y vuelve a autorizar.');
    }
    
    // Guardar tokens
    const tokensPath = getTokensPath();
    await fs.mkdir(path.dirname(tokensPath), { recursive: true });
    await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');
    
    logger.info('✅ Tokens OAuth guardados correctamente');
    
    return tokens as OAuthTokens;
  } catch (error: any) {
    logger.error({ error: error.message }, '❌ Error al intercambiar código por tokens');
    throw new Error(`Error al obtener tokens: ${error.message}`);
  }
}

/**
 * Cargar tokens guardados
 */
async function loadTokens(): Promise<OAuthTokens | null> {
  try {
    const tokensPath = getTokensPath();
    const content = await fs.readFile(tokensPath, 'utf-8');
    return JSON.parse(content) as OAuthTokens;
  } catch {
    return null;
  }
}

/**
 * Guardar tokens actualizados
 */
async function saveTokens(tokens: OAuthTokens): Promise<void> {
  const tokensPath = getTokensPath();
  await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');
}

/**
 * Obtener cliente OAuth2 autenticado
 */
export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const tokens = await loadTokens();
  
  if (!tokens) {
    throw new Error('No hay tokens OAuth guardados. Autoriza primero.');
  }
  
  const oauth2Client = await createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  
  // Configurar auto-refresh de tokens
  oauth2Client.on('tokens', async (newTokens) => {
    const updatedTokens = { 
      ...tokens, 
      ...newTokens,
      // Asegurar que los campos requeridos tengan valores
      access_token: newTokens.access_token || tokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
    } as OAuthTokens;
    await saveTokens(updatedTokens);
    logger.debug('🔄 Tokens OAuth actualizados');
  });
  
  return oauth2Client;
}

/**
 * Revocar tokens (logout)
 */
export async function revokeTokens(): Promise<void> {
  try {
    const tokens = await loadTokens();
    
    if (tokens?.access_token) {
      const oauth2Client = await createOAuth2Client();
      await oauth2Client.revokeToken(tokens.access_token);
    }
    
    // Eliminar archivo de tokens
    const tokensPath = getTokensPath();
    await fs.unlink(tokensPath);
    
    logger.info('✅ Sesión OAuth cerrada');
  } catch (error: any) {
    logger.warn({ error: error.message }, '⚠️ Error al revocar tokens');
    
    // Intentar eliminar archivo de todas formas
    try {
      const tokensPath = getTokensPath();
      await fs.unlink(tokensPath);
    } catch {}
  }
}

/**
 * Obtener información del usuario autenticado
 */
export async function getAuthenticatedUserInfo(): Promise<{ email: string; name: string } | null> {
  try {
    const auth = await getAuthenticatedClient();
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const response = await oauth2.userinfo.get();
    
    return {
      email: response.data.email || 'desconocido',
      name: response.data.name || response.data.email || 'Usuario',
    };
  } catch (error) {
    return null;
  }
}

