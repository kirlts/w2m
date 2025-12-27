// W2M - Google Drive Storage Plugin
// Implementación de StorageInterface usando Google Drive API
// Enfoque híbrido: Local + Google Drive

import { StorageInterface } from '../../../core/storage/interface.js';
import { logger } from '../../../utils/logger.js';
import { google } from 'googleapis';
import { getServiceAccountClient, isServiceAccountConfigured } from './service-account.js';
import { promises as fs } from 'fs';
import path from 'path';
import { getConfig } from '../../../config/index.js';

export class GoogleDriveStorage implements StorageInterface {
  private drive: any = null;
  private w2mFolderId: string | null = null;
  private localBasePath: string;
  private driveEnabled: boolean = false;
  private serviceAccountEmail: string = '';

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

    // Intentar inicializar Google Drive (opcional)
    try {
      if (!isServiceAccountConfigured()) {
        logger.warn('⚠️ Google Drive no configurado, usando solo almacenamiento local');
        return;
      }
      
      logger.info({}, '🔐 Inicializando Google Drive con Service Account');
      const auth = await getServiceAccountClient();
      
      this.drive = google.drive({ version: 'v3', auth });
      
      // Obtener email de la service account para logging
      const credentials = await auth.getCredentials();
      this.serviceAccountEmail = (credentials as any).client_email || 'desconocido';
      logger.info({ serviceAccountEmail: this.serviceAccountEmail }, '✅ Service Account autenticado');
      
      // Buscar carpeta "W2M" compartida
      this.w2mFolderId = await this.findSharedW2MFolder();
      
      if (this.w2mFolderId) {
        this.driveEnabled = true;
        logger.info({ folderId: this.w2mFolderId }, '✅ Google Drive habilitado (sincronización activa)');
      } else {
        logger.warn('⚠️ No se encontró carpeta W2M compartida, usando solo almacenamiento local');
        logger.warn(`📧 Comparte una carpeta "W2M" con: ${this.serviceAccountEmail}`);
      }
    } catch (error: any) {
      logger.warn({ error: error.message }, '⚠️ Error al inicializar Google Drive, usando solo almacenamiento local');
    }
  }

  /**
   * Buscar carpeta "W2M" que esté COMPARTIDA con la Service Account (no creada por ella)
   */
  private async findSharedW2MFolder(): Promise<string | null> {
    try {
      const config = getConfig();
      const configuredFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (config as any).GOOGLE_DRIVE_FOLDER_ID;
      
      // Si hay un ID configurado, intentar usarlo
      if (configuredFolderId) {
        try {
          const response = await this.drive.files.get({
            fileId: configuredFolderId,
            fields: 'id, name, owners, shared',
            supportsAllDrives: true,
          });
          
          const fileData = response.data;
          const isOwnedByServiceAccount = fileData.owners?.some((owner: any) => 
            owner.emailAddress === this.serviceAccountEmail
          );
          
          if (isOwnedByServiceAccount) {
            logger.warn({ folderId: configuredFolderId }, '⚠️ La carpeta configurada es propiedad de la Service Account (sin cuota)');
          } else if (fileData.shared) {
            logger.info({ folderId: configuredFolderId, name: fileData.name }, '📁 Usando carpeta W2M compartida (ID configurado)');
            return configuredFolderId;
          } else {
            logger.warn({ folderId: configuredFolderId }, '⚠️ La carpeta existe pero no está compartida correctamente');
          }
        } catch (error: any) {
          logger.warn({ folderId: configuredFolderId, error: error.message }, '⚠️ No se pudo acceder a la carpeta configurada');
        }
      }

      // Buscar carpeta "W2M" compartida (no propia)
      const response = await this.drive.files.list({
        q: "name='W2M' and mimeType='application/vnd.google-apps.folder' and trashed=false and sharedWithMe=true",
        fields: 'files(id, name, owners, shared)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      if (response.data.files && response.data.files.length > 0) {
        // Filtrar carpetas que NO sean propiedad de la Service Account
        for (const folder of response.data.files) {
          const isOwnedByServiceAccount = folder.owners?.some((owner: any) => 
            owner.emailAddress === this.serviceAccountEmail
          );
          
          if (!isOwnedByServiceAccount) {
            logger.info({ 
              folderId: folder.id, 
              name: folder.name,
              shared: folder.shared 
            }, '📁 Carpeta W2M compartida encontrada');
            return folder.id!;
          }
        }
      }

      // Última opción: buscar cualquier carpeta W2M accesible (pero no propia)
      const fallbackResponse = await this.drive.files.list({
        q: "name='W2M' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name, owners)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      if (fallbackResponse.data.files && fallbackResponse.data.files.length > 0) {
        for (const folder of fallbackResponse.data.files) {
          const isOwnedByServiceAccount = folder.owners?.some((owner: any) => 
            owner.emailAddress === this.serviceAccountEmail
          );
          
          if (!isOwnedByServiceAccount) {
            logger.info({ folderId: folder.id }, '📁 Carpeta W2M encontrada (verificar permisos)');
            return folder.id!;
          } else {
            logger.warn({ folderId: folder.id }, '⚠️ Carpeta W2M encontrada pero es propiedad de Service Account (no usable)');
          }
        }
      }

      return null;
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al buscar carpeta W2M');
      return null;
    }
  }

  /**
   * Convertir ruta relativa a estructura de carpetas en Drive
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
        // Buscar carpeta existente
        const response = await this.drive.files.list({
          q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive',
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        });

        if (response.data.files && response.data.files.length > 0) {
          currentParentId = response.data.files[0].id!;
        } else {
          // Crear carpeta dentro de la carpeta compartida
          const createResponse = await this.drive.files.create({
            requestBody: {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [currentParentId],
            },
            fields: 'id, name',
            supportsAllDrives: true,
          });
          currentParentId = createResponse.data.id!;
          logger.debug({ folderName, parentId: currentParentId }, '📁 Subcarpeta creada en Google Drive');
        }
      } catch (error: any) {
        logger.error({ error: error.message, folderName }, '❌ Error al crear subcarpeta en Google Drive');
        return null;
      }
    }

    return currentParentId;
  }

  /**
   * Buscar archivo por nombre y carpeta padre en Drive
   */
  private async findFile(filename: string, parentId: string): Promise<string | null> {
    try {
      const response = await this.drive.files.list({
        q: `name='${filename}' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
      }

      return null;
    } catch (error) {
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
      logger.error({ error: error.message, path: relativePath }, '❌ Error al guardar archivo localmente');
      throw error;
    }

    // 2. Sincronizar a Google Drive si está habilitado
    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        await this.syncToDrive(relativePath, content);
        logger.info({ path: relativePath }, '☁️ Archivo sincronizado a Google Drive');
      } catch (error: any) {
        // No fallar si Drive falla - ya está guardado localmente
        logger.warn({ 
          error: error.message, 
          path: relativePath,
          hint: 'El archivo está guardado localmente, la sincronización a Drive falló'
        }, '⚠️ Error al sincronizar a Google Drive');
        
        // Deshabilitar Drive si hay errores de cuota
        if (error.code === 403 && error.message?.includes('quota')) {
          this.driveEnabled = false;
          logger.error('❌ Google Drive deshabilitado debido a error de cuota. Verifica que la carpeta W2M esté compartida correctamente.');
        }
      }
    }
  }

  /**
   * Sincronizar archivo a Google Drive
   */
  private async syncToDrive(relativePath: string, content: string): Promise<void> {
    const { folders, filename } = this.parsePath(relativePath);
    
    // Crear estructura de carpetas
    const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId!);
    
    if (!parentId) {
      throw new Error('No se pudo crear la estructura de carpetas en Drive');
    }
    
    // Buscar archivo existente
    const existingFileId = await this.findFile(filename, parentId);
    
    if (existingFileId) {
      // Actualizar archivo existente
      await this.drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType: 'text/markdown',
          body: content,
        },
        supportsAllDrives: true,
      });
    } else {
      // Crear nuevo archivo
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
        supportsAllDrives: true,
      });
    }
  }

  /**
   * Leer archivo (primero local, fallback a Drive)
   */
  async readFile(relativePath: string): Promise<string | null> {
    const localPath = path.join(this.localBasePath, relativePath);
    
    // Intentar leer localmente primero
    try {
      const content = await fs.readFile(localPath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error({ error: error.message, path: relativePath }, '❌ Error al leer archivo local');
      }
    }

    // Fallback a Google Drive
    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        const { folders, filename } = this.parsePath(relativePath);
        const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
        
        if (!parentId) return null;
        
        const fileId = await this.findFile(filename, parentId);
        
        if (!fileId) return null;

        const response = await this.drive.files.get(
          { fileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'text' }
        );

        const content = response.data as string;
        
        // Guardar localmente para cache
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, content, 'utf-8');
        
        return content;
      } catch (error: any) {
        if (error.code !== 404) {
          logger.error({ error: error.message, path: relativePath }, '❌ Error al leer archivo de Google Drive');
        }
      }
    }

    return null;
  }

  /**
   * Verificar si archivo existe (local o Drive)
   */
  async exists(relativePath: string): Promise<boolean> {
    const localPath = path.join(this.localBasePath, relativePath);
    
    // Verificar localmente primero
    try {
      await fs.access(localPath);
      return true;
    } catch {}

    // Verificar en Drive
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

  /**
   * Eliminar archivo (local y Drive)
   */
  async deleteFile(relativePath: string): Promise<void> {
    const localPath = path.join(this.localBasePath, relativePath);
    
    // Eliminar localmente
    try {
      await fs.unlink(localPath);
      logger.debug({ path: relativePath }, '🗑️ Archivo eliminado localmente');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.warn({ error: error.message, path: relativePath }, '⚠️ Error al eliminar archivo local');
      }
    }

    // Eliminar de Drive
    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        const { folders, filename } = this.parsePath(relativePath);
        const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
        
        if (!parentId) return;
        
        const fileId = await this.findFile(filename, parentId);
        
        if (fileId) {
          await this.drive.files.delete({ fileId, supportsAllDrives: true });
          logger.debug({ path: relativePath }, '🗑️ Archivo eliminado de Google Drive');
        }
      } catch (error: any) {
        logger.warn({ error: error.message, path: relativePath }, '⚠️ Error al eliminar archivo de Google Drive');
      }
    }
  }

  /**
   * Listar archivos (combina local y Drive)
   */
  async listFiles(relativePath: string): Promise<string[]> {
    const localPath = path.join(this.localBasePath, relativePath);
    const files = new Set<string>();
    
    // Listar localmente
    try {
      const entries = await fs.readdir(localPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          files.add(entry.name);
        }
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error({ error: error.message, path: relativePath }, '❌ Error al listar archivos locales');
      }
    }

    // Listar de Drive
    if (this.driveEnabled && this.drive && this.w2mFolderId) {
      try {
        const { folders } = this.parsePath(relativePath);
        const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
        
        if (parentId) {
          const response = await this.drive.files.list({
            q: `'${parentId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType)',
            spaces: 'drive',
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
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
        logger.warn({ error: error.message, path: relativePath }, '⚠️ Error al listar archivos de Google Drive');
      }
    }

    return Array.from(files);
  }

  /**
   * Verificar estado de Google Drive
   */
  isDriveEnabled(): boolean {
    return this.driveEnabled;
  }

  /**
   * Obtener información del estado
   */
  getStatus(): { local: boolean; drive: boolean; driveFolder: string | null } {
    return {
      local: true,
      drive: this.driveEnabled,
      driveFolder: this.w2mFolderId,
    };
  }
}
