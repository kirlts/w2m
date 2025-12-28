// W2M - Category Management
// Sistema modular para gestionar categorías de mensajes

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../../utils/logger.js';
import { getConfig } from '../../config/index.js';

export type CategoryField = 'AUTOR' | 'HORA' | 'FECHA' | 'CONTENIDO';

export interface Category {
  name: string;
  description?: string;
  enabledFields: CategoryField[];
  separator: string; // Separador para detectar categoría (default: ",,")
  createdAt: string;
}

export class CategoryManager {
  private config = getConfig();
  private categoriesPath: string;
  private categories: Map<string, Category> = new Map();

  constructor() {
    // Usar directorio de datos genérico
    this.categoriesPath = join(this.config.VAULT_PATH, '..', 'categories.json');
  }

  /**
   * Cargar categorías desde el archivo
   */
  async load(): Promise<void> {
    try {
      if (existsSync(this.categoriesPath)) {
        const data = await readFile(this.categoriesPath, 'utf-8');
        const categoriesArray = JSON.parse(data) as Category[];
        
        this.categories.clear();
        for (const category of categoriesArray) {
          this.categories.set(category.name.toLowerCase(), category);
        }
        
        logger.debug({ count: this.categories.size }, 'Categorías cargadas');
      } else {
        logger.debug('No hay categorías configuradas');
      }
    } catch (error) {
      logger.error({ error }, 'Error al cargar categorías');
      this.categories.clear();
    }
  }

  /**
   * Guardar categorías al archivo
   */
  private async save(): Promise<void> {
    try {
      const categoriesArray = Array.from(this.categories.values());
      const dir = join(this.categoriesPath, '..');
      
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      
      await writeFile(this.categoriesPath, JSON.stringify(categoriesArray, null, 2), 'utf-8');
      logger.debug({ count: categoriesArray.length }, 'Categorías guardadas');
    } catch (error) {
      logger.error({ error }, 'Error al guardar categorías');
      throw error;
    }
  }

  /**
   * Agregar una nueva categoría
   */
  async addCategory(name: string, description?: string, enabledFields?: CategoryField[], separator?: string): Promise<boolean> {
    const normalizedName = name.toLowerCase();
    
    if (this.categories.has(normalizedName)) {
      return false; // Ya existe
    }

    // CONTENIDO siempre está habilitado
    const fields: CategoryField[] = enabledFields || ['AUTOR', 'HORA', 'FECHA', 'CONTENIDO'];
    if (!fields.includes('CONTENIDO')) {
      fields.push('CONTENIDO');
    }

    // Validar separador (1-3 caracteres, default: ",,")
    let validSeparator = separator || ',,';
    if (validSeparator.length < 1 || validSeparator.length > 3) {
      validSeparator = ',,';
    }

    const category: Category = {
      name: name, // Guardar con el nombre original (case-sensitive para mostrar)
      description,
      enabledFields: fields,
      separator: validSeparator,
      createdAt: new Date().toISOString(),
    };

    this.categories.set(normalizedName, category);
    await this.save();
    
    return true;
  }

  /**
   * Remover una categoría
   */
  async removeCategory(name: string): Promise<boolean> {
    const normalizedName = name.toLowerCase();
    
    if (!this.categories.has(normalizedName)) {
      return false; // No existe
    }

    this.categories.delete(normalizedName);
    await this.save();
    
    return true;
  }

  /**
   * Actualizar una categoría
   */
  async updateCategory(name: string, updates: Partial<Omit<Category, 'name' | 'createdAt'>>): Promise<boolean> {
    const normalizedName = name.toLowerCase();
    const category = this.categories.get(normalizedName);
    
    if (!category) {
      return false;
    }

    // Asegurar que CONTENIDO siempre esté habilitado
    if (updates.enabledFields && !updates.enabledFields.includes('CONTENIDO')) {
      updates.enabledFields.push('CONTENIDO');
    }

    Object.assign(category, updates);
    await this.save();
    
    return true;
  }

  /**
   * Obtener una categoría por nombre
   */
  getCategory(name: string): Category | undefined {
    return this.categories.get(name.toLowerCase());
  }

  /**
   * Obtener todas las categorías
   */
  getAllCategories(): Category[] {
    return Array.from(this.categories.values());
  }

  /**
   * Detectar si un mensaje pertenece a una categoría
   * Formato esperado: "CATEGORIA<separador>contenido"
   * El separador por defecto es ",," pero puede ser configurado por categoría (1-3 caracteres)
   */
  detectCategory(messageContent: string): { categoryName: string; content: string } | null {
    // Iterar sobre todas las categorías y buscar coincidencia con su separador al PRINCIPIO
    for (const category of this.categories.values()) {
      const separator = category.separator || ',,';
      
      // El separador debe estar al PRINCIPIO del mensaje
      if (!messageContent.startsWith(separator)) {
        continue;
      }

      // Extraer el contenido después del separador
      const contentAfterSeparator = messageContent.substring(separator.length).trimStart();
      
      // Buscar el primer espacio o el final para separar categoría del contenido
      const firstSpaceIndex = contentAfterSeparator.indexOf(' ');
      
      let potentialCategory: string;
      let content: string;
      
      if (firstSpaceIndex === -1) {
        // No hay espacio, todo es la categoría (sin contenido)
        potentialCategory = contentAfterSeparator;
        content = '';
      } else {
        // Separar categoría (antes del primer espacio) y contenido (después)
        potentialCategory = contentAfterSeparator.substring(0, firstSpaceIndex);
        content = contentAfterSeparator.substring(firstSpaceIndex + 1).trim();
      }

      if (!potentialCategory || potentialCategory.length === 0) {
        continue;
      }

      // Verificar si coincide con esta categoría (case-insensitive)
      if (potentialCategory.toLowerCase() === category.name.toLowerCase()) {
        logger.debug({ categoryName: category.name, separator, contentLength: content.length }, 'Categoría detectada en mensaje');
        return {
          categoryName: category.name,
          content: content,
        };
      }
    }

    logger.debug({ availableCategories: Array.from(this.categories.keys()) }, 'No se encontró categoría en mensaje');
    return null;
  }

  /**
   * Obtener el path absoluto del archivo markdown para una categoría (legacy)
   * @deprecated Usar getCategoryMarkdownRelativePath en su lugar
   */
  getCategoryMarkdownPath(categoryName: string): string {
    const normalizedName = categoryName.toLowerCase();
    return join(this.config.VAULT_PATH, 'categories', `${normalizedName}.md`);
  }

  /**
   * Obtener la ruta relativa del archivo markdown para una categoría
   * Ejemplo: "categories/test.md"
   */
  getCategoryMarkdownRelativePath(categoryName: string): string {
    const normalizedName = categoryName.toLowerCase();
    return `categories/${normalizedName}.md`;
  }

  /**
   * Eliminar el archivo markdown de una categoría
   */
  async deleteCategoryMarkdown(categoryName: string): Promise<boolean> {
    const { unlink } = await import('fs/promises');
    const { existsSync } = await import('fs');
    
    try {
      const filePath = this.getCategoryMarkdownPath(categoryName);
      if (existsSync(filePath)) {
        await unlink(filePath);
        logger.debug({ category: categoryName, filePath }, 'Archivo markdown de categoría eliminado');
        return true;
      }
      return false; // Archivo no existe
    } catch (error) {
      logger.error({ error, category: categoryName }, 'Error al eliminar archivo markdown de categoría');
      return false;
    }
  }
}
