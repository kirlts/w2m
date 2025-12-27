// W2M - Google Drive Storage Plugin
// Implementación híbrida: Local + Google Drive (OAuth o Service Account)

import { StorageInterface } from '../../../core/storage/interface.js';
import { logger } from '../../../utils/logger.js';
import { google } from 'googleapis';
import { getServiceAccountClient, isServiceAccountConfigured } from './service-account.js';
import { getAuthenticatedClient, hasOAuthTokens, isOAuthConfigured } from './oauth.js';
import { promises as fs } from 'fs';
import path from 'path';
import { getConfig } from '../../../config/index.js';

export class GoogleDriveStorage implements StorageInterface {
  private drive: any = null;
  private w2mFolderId: string | null = null;
  private localBasePath: string;
  private driveEnabled: boolean = false;
  private authMethod: 'oauth' | 'service-account' | 'none' = 'none';
  private userEmail: string = '';

  constructor() {
    const config = getConfig();
    this.localBasePath = config.VAULT_PATH;
  }

  async initialize(): Promise<void> {
    // Siempre inicializar almacenamiento local
    try {
      await fs.mkdir(this.localBasePath, { recursive: true });
      logger.info({ path: this.localBasePath }, '📁 Almacenamiento local inicializado');
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al inicializar almacenamiento local');
      throw error;
    }

    // Intentar autenticación (OAuth tiene prioridad sobre Service Account)
    await this.initializeGoogleDrive();
  }

  /**
   * Inicializar Google Drive con OAuth o Service Account
   */
  private async initializeGoogleDrive(): Promise<void> {
    // Prioridad 1: OAuth (usa cuota del usuario)
    if (await isOAuthConfigured() && await hasOAuthTokens()) {
      try {
        logger.info({}, '🔐 Inicializando Google Drive con OAuth');
        const auth = await getAuthenticatedClient();
        this.drive = google.drive({ version: 'v3', auth });
        this.authMethod = 'oauth';
        
        // Obtener info del usuario
        try {
          const oauth2 = google.oauth2({ version: 'v2', auth });
          const userInfo = await oauth2.userinfo.get();
          this.userEmail = userInfo.data.email || 'usuario';
          logger.info({ email: this.userEmail }, '✅ Autenticado con OAuth');
        } catch {
          this.userEmail = 'usuario autenticado';
        }
        
        // Buscar o crear carpeta W2M
        this.w2mFolderId = await this.findOrCreateW2MFolder();
        
        if (this.w2mFolderId) {
          this.driveEnabled = true;
          logger.info({ folderId: this.w2mFolderId }, '✅ Google Drive habilitado (OAuth)');
        }
        return;
      } catch (error: any) {
        logger.warn({ error: error.message }, '⚠️ Error con OAuth, intentando Service Account');
      }
    }

    // Prioridad 2: Service Account (solo funciona con Shared Drives o Workspace)
    if (isServiceAccountConfigured()) {
      try {
        logger.info({}, '🔐 Inicializando Google Drive con Service Account');
        const auth = await getServiceAccountClient();
        this.drive = google.drive({ version: 'v3', auth });
        this.authMethod = 'service-account';
        
        const credentials = await auth.getCredentials();
        this.userEmail = (credentials as any).client_email || 'service account';
        logger.info({ email: this.userEmail }, '✅ Autenticado con Service Account');
        
        // Buscar carpeta W2M compartida
        this.w2mFolderId = await this.findSharedW2MFolder();
        
        if (this.w2mFolderId) {
          this.driveEnabled = true;
          logger.info({ folderId: this.w2mFolderId }, '✅ Google Drive habilitado (Service Account)');
        } else {
          logger.warn('⚠️ No se encontró carpeta W2M compartida para Service Account');
        }
        return;
      } catch (error: any) {
        logger.warn({ error: error.message }, '⚠️ Error con Service Account');
      }
    }

    logger.info('ℹ️ Google Drive no configurado, usando solo almacenamiento local');
  }

  /**
   * Buscar o crear carpeta W2M (para OAuth - usuario tiene cuota)
   */
  private async findOrCreateW2MFolder(): Promise<string | null> {
    try {
      // Buscar carpeta existente
      const response = await this.drive.files.list({
        q: "name='W2M' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents",
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        logger.info({ folderId: response.data.files[0].id }, '📁 Carpeta W2M encontrada');
        return response.data.files[0].id!;
      }

      // Crear carpeta si no existe
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: 'W2M',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, name',
      });

      logger.info({ folderId: createResponse.data.id }, '📁 Carpeta W2M creada');
      return createResponse.data.id!;
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al buscar/crear carpeta W2M');
      return null;
    }
  }

  /**
   * Buscar carpeta W2M compartida (para Service Account)
   */
  private async findSharedW2MFolder(): Promise<string | null> {
    try {
      const config = getConfig();
      const configuredFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (config as any).GOOGLE_DRIVE_FOLDER_ID;
      
      if (configuredFolderId) {
        try {
          await this.drive.files.get({
            fileId: configuredFolderId,
            fields: 'id, name',
            supportsAllDrives: true,
          });
          return configuredFolderId;
        } catch (error: any) {
          logger.warn({ error: error.message }, '⚠️ No se pudo acceder a carpeta configurada');
        }
      }

      // Buscar carpeta compartida
      const response = await this.drive.files.list({
        q: "name='W2M' and mimeType='application/vnd.google-apps.folder' and trashed=false and sharedWithMe=true",
        fields: 'files(id, name)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
      }

      return null;
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al buscar carpeta W2M compartida');
      return null;
    }
  }

  /**
   * Convertir ruta relativa a estructura de carpetas
   */
  private parsePath(relativePath: string): { folders: string[]; filename: string } {
    const parts = relativePath.split('/');
    const filename = parts.pop() || '';
    return { folders: parts, filename };
  }

  /**
   * Buscar o crear estructura de carpetas en Drive
   */
  private async findOrCreateFolderPath(folders: string[], parentId: string): Promise<string | null> {
    let currentParentId = parentId;

    for (const folderName of folders) {
      if (!folderName) continue;

      try {
        const response = await this.drive.files.list({
          q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
        });

        if (response.data.files && response.data.files.length > 0) {
          currentParentId = response.data.files[0].id!;
        } else {
          const createResponse = await this.drive.files.create({
            requestBody: {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [currentParentId],
            },
            fields: 'id, name',
          });
          currentParentId = createResponse.data.id!;
        }
      } catch (error: any) {
        logger.error({ error: error.message, folderName }, '❌ Error al crear subcarpeta');
        return null;
      }
    }

    return currentParentId;
  }

  /**
   * Buscar archivo por nombre y carpeta padre
   */
  private async findFile(filename: string, parentId: string): Promise<string | null> {
    try {
      const response = await this.drive.files.list({
        q: `name='${filename}' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Guardar archivo (primero local, luego sincronizar a Drive)
   */
  async saveFile(relativePath: string, content: string): Promise<void> {
    const localPath = path.join(this.localBasePath, relativePath);
    
    // 1. SIEMPRE guardar localmente primero
    try {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, content, 'utf-8');
      logger.debug({ path: relativePath }, '💾 Archivo guardado localmente');
    } catch (error: any) {
      logger.error({ error: error.message, path: relativePath }, '❌ Error al guardar localmente');
      throw error;
    }

    // 2. Sincronizar a Google Drive si está habilitado
    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        await this.syncToDrive(relativePath, content);
        logger.info({ path: relativePath }, '☁️ Sincronizado a Google Drive');
      } catch (error: any) {
        logger.warn({ 
          error: error.message, 
          path: relativePath,
        }, '⚠️ Error al sincronizar a Drive (guardado localmente)');
        
        // Deshabilitar Drive si hay errores de cuota
        if (error.code === 403) {
          this.driveEnabled = false;
          logger.error('❌ Google Drive deshabilitado debido a error. Verifica permisos.');
        }
      }
    }
  }

  /**
   * Sincronizar archivo a Google Drive
   */
  private async syncToDrive(relativePath: string, content: string): Promise<void> {
    const { folders, filename } = this.parsePath(relativePath);
    
    const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId!);
    if (!parentId) {
      throw new Error('No se pudo crear estructura de carpetas');
    }
    
    const existingFileId = await this.findFile(filename, parentId);
    
    if (existingFileId) {
      await this.drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType: 'text/markdown',
          body: content,
        },
      });
    } else {
      await this.drive.files.create({
        requestBody: {
          name: filename,
          mimeType: 'text/markdown',
          parents: [parentId],
        },
        media: {
          mimeType: 'text/markdown',
          body: content,
        },
        fields: 'id, name',
      });
    }
  }

  /**
   * Leer archivo (primero local, fallback a Drive)
   */
  async readFile(relativePath: string): Promise<string | null> {
    const localPath = path.join(this.localBasePath, relativePath);
    
    try {
      return await fs.readFile(localPath, 'utf-8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error({ error: error.message, path: relativePath }, '❌ Error al leer archivo local');
      }
    }

    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        const { folders, filename } = this.parsePath(relativePath);
        const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
        if (!parentId) return null;
        
        const fileId = await this.findFile(filename, parentId);
        if (!fileId) return null;

        const response = await this.drive.files.get(
          { fileId, alt: 'media' },
          { responseType: 'text' }
        );

        const content = response.data as string;
        
        // Cache local
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, content, 'utf-8');
        
        return content;
      } catch (error: any) {
        if (error.code !== 404) {
          logger.error({ error: error.message, path: relativePath }, '❌ Error al leer de Drive');
        }
      }
    }

    return null;
  }

  async exists(relativePath: string): Promise<boolean> {
    const localPath = path.join(this.localBasePath, relativePath);
    
    try {
      await fs.access(localPath);
      return true;
    } catch {}

    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        const { folders, filename } = this.parsePath(relativePath);
        const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
        if (!parentId) return false;
        
        const fileId = await this.findFile(filename, parentId);
        return fileId !== null;
      } catch {
        return false;
      }
    }

    return false;
  }

  async deleteFile(relativePath: string): Promise<void> {
    const localPath = path.join(this.localBasePath, relativePath);
    
    try {
      await fs.unlink(localPath);
      logger.debug({ path: relativePath }, '🗑️ Archivo eliminado localmente');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.warn({ error: error.message, path: relativePath }, '⚠️ Error al eliminar localmente');
      }
    }

    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        const { folders, filename } = this.parsePath(relativePath);
        const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
        if (!parentId) return;
        
        const fileId = await this.findFile(filename, parentId);
        if (fileId) {
          await this.drive.files.delete({ fileId });
          logger.debug({ path: relativePath }, '🗑️ Archivo eliminado de Drive');
        }
      } catch (error: any) {
        logger.warn({ error: error.message, path: relativePath }, '⚠️ Error al eliminar de Drive');
      }
    }
  }

  async listFiles(relativePath: string): Promise<string[]> {
    const localPath = path.join(this.localBasePath, relativePath);
    const files = new Set<string>();
    
    try {
      const entries = await fs.readdir(localPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          files.add(entry.name);
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error({ error: error.message, path: relativePath }, '❌ Error al listar archivos');
      }
    }

    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        const { folders } = this.parsePath(relativePath);
        const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
        
        if (parentId) {
          const response = await this.drive.files.list({
            q: `'${parentId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType)',
            spaces: 'drive',
          });

          if (response.data.files) {
            for (const file of response.data.files) {
              if (file.mimeType !== 'application/vnd.google-apps.folder') {
                files.add(file.name);
              }
            }
          }
        }
      } catch (error: any) {
        logger.warn({ error: error.message, path: relativePath }, '⚠️ Error al listar de Drive');
      }
    }

    return Array.from(files);
  }

  /**
   * Obtener estado del storage
   */
  getStatus(): { 
    local: boolean; 
    drive: boolean; 
    authMethod: string; 
    userEmail: string;
    folderId: string | null;
  } {
    return {
      local: true,
      drive: this.driveEnabled,
      authMethod: this.authMethod,
      userEmail: this.userEmail,
      folderId: this.w2mFolderId,
    };
  }

  /**
   * Reinicializar conexión a Drive (después de autorizar OAuth)
   */
  async reinitializeDrive(): Promise<void> {
    this.drive = null;
    this.w2mFolderId = null;
    this.driveEnabled = false;
    this.authMethod = 'none';
    this.userEmail = '';
    
    await this.initializeGoogleDrive();
  }
}
