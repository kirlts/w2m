// W2M - Google Drive Storage Plugin
// Implementación de StorageInterface usando Google Drive API

import { StorageInterface } from '../../../core/storage/interface.js';
import { logger } from '../../../utils/logger.js';
import { google } from 'googleapis';
import { getServiceAccountClient, isServiceAccountConfigured } from './service-account.js';

export class GoogleDriveStorage implements StorageInterface {
  private drive: any = null;
  private w2mFolderId: string | null = null;

  async initialize(): Promise<void> {
    try {
      if (!isServiceAccountConfigured()) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH debe estar configurado. Ve a docs/GCP-SERVICE-ACCOUNT-SETUP.md para más información.');
      }
      
      logger.info({}, '🔐 Inicializando Google Drive con Service Account');
      const auth = await getServiceAccountClient();
      
      this.drive = google.drive({ version: 'v3', auth });
      
      // Buscar o crear carpeta "W2M"
      this.w2mFolderId = await this.findOrCreateW2MFolder();
      
      logger.info({ folderId: this.w2mFolderId }, '✅ GoogleDriveStorage inicializado');
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Error al inicializar GoogleDriveStorage');
      throw error;
    }
  }

  /**
   * Buscar o crear carpeta "W2M" en Google Drive
   */
  private async findOrCreateW2MFolder(): Promise<string> {
    try {
      // Buscar carpeta "W2M"
      const response = await this.drive.files.list({
        q: "name='W2M' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id;
        logger.info({ folderId }, '📁 Carpeta W2M encontrada en Google Drive');
        return folderId!;
      }

      // Crear carpeta "W2M" si no existe
      const createResponse = await this.drive.files.create({
        requestBody: {
          name: 'W2M',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id, name',
      });

      const folderId = createResponse.data.id;
      logger.info({ folderId }, '📁 Carpeta W2M creada en Google Drive');
      return folderId!;
    } catch (error) {
      logger.error({ error }, '❌ Error al buscar/crear carpeta W2M');
      throw error;
    }
  }

  /**
   * Convertir ruta relativa a estructura de carpetas en Drive
   * Ej: "categories/test.md" -> ["categories", "test.md"]
   */
  private parsePath(path: string): { folders: string[]; filename: string } {
    const parts = path.split('/');
    const filename = parts.pop() || '';
    return { folders: parts, filename };
  }

  /**
   * Buscar o crear estructura de carpetas
   */
  private async findOrCreateFolderPath(folders: string[], parentId: string): Promise<string> {
    let currentParentId = parentId;

    for (const folderName of folders) {
      if (!folderName) continue;

      // Buscar carpeta
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        currentParentId = response.data.files[0].id!;
      } else {
        // Crear carpeta
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
    } catch (error) {
      logger.error({ error, filename, parentId }, '❌ Error al buscar archivo en Google Drive');
      return null;
    }
  }

  async saveFile(path: string, content: string): Promise<void> {
    if (!this.drive || !this.w2mFolderId) {
      throw new Error('GoogleDriveStorage no está inicializado');
    }

    try {
      const { folders, filename } = this.parsePath(path);
      
      // Crear estructura de carpetas
      const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
      
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
        });
        logger.debug({ path, fileId: existingFileId }, '📝 Archivo actualizado en Google Drive');
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
        });
        logger.debug({ path }, '📝 Archivo creado en Google Drive');
      }
    } catch (error) {
      logger.error({ error, path }, '❌ Error al guardar archivo en Google Drive');
      throw error;
    }
  }

  async readFile(path: string): Promise<string | null> {
    if (!this.drive || !this.w2mFolderId) {
      throw new Error('GoogleDriveStorage no está inicializado');
    }

    try {
      const { folders, filename } = this.parsePath(path);
      
      // Crear estructura de carpetas
      const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
      
      // Buscar archivo
      const fileId = await this.findFile(filename, parentId);
      
      if (!fileId) {
        return null;
      }

      // Descargar contenido
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
      );

      return response.data as string;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      logger.error({ error, path }, '❌ Error al leer archivo de Google Drive');
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    if (!this.drive || !this.w2mFolderId) {
      return false;
    }

    try {
      const { folders, filename } = this.parsePath(path);
      const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
      const fileId = await this.findFile(filename, parentId);
      return fileId !== null;
    } catch (error) {
      logger.error({ error, path }, '❌ Error al verificar existencia de archivo en Google Drive');
      return false;
    }
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.drive || !this.w2mFolderId) {
      throw new Error('GoogleDriveStorage no está inicializado');
    }

    try {
      const { folders, filename } = this.parsePath(path);
      const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
      const fileId = await this.findFile(filename, parentId);
      
      if (!fileId) {
        logger.warn({ path }, '⚠️ Archivo no encontrado para eliminar');
        return;
      }

      await this.drive.files.delete({ fileId });
      logger.debug({ path, fileId }, '🗑️ Archivo eliminado de Google Drive');
    } catch (error) {
      logger.error({ error, path }, '❌ Error al eliminar archivo de Google Drive');
      throw error;
    }
  }

  async listFiles(path: string): Promise<string[]> {
    if (!this.drive || !this.w2mFolderId) {
      return [];
    }

    try {
      const { folders } = this.parsePath(path);
      const parentId = await this.findOrCreateFolderPath(folders, this.w2mFolderId);
      
      const response = await this.drive.files.list({
        q: `'${parentId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        spaces: 'drive',
      });

      if (!response.data.files) {
        return [];
      }

      // Filtrar solo archivos (no carpetas) y retornar nombres
      return response.data.files
        .filter((file: any) => file.mimeType !== 'application/vnd.google-apps.folder')
        .map((file: any) => file.name);
    } catch (error) {
      logger.error({ error, path }, '❌ Error al listar archivos de Google Drive');
      return [];
    }
  }
}
