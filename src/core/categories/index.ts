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
  async addCategory(name: string, description?: string, enabledFields?: CategoryField[]): Promise<boolean> {
    const normalizedName = name.toLowerCase();
    
    if (this.categories.has(normalizedName)) {
      return false; // Ya existe
    }

    // CONTENIDO siempre está habilitado
    const fields: CategoryField[] = enabledFields || ['AUTOR', 'HORA', 'FECHA', 'CONTENIDO'];
    if (!fields.includes('CONTENIDO')) {
      fields.push('CONTENIDO');
    }

    const category: Category = {
      name: name, // Guardar con el nombre original (case-sensitive para mostrar)
      description,
      enabledFields: fields,
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
   * Formato esperado: "CATEGORIA: contenido"
   */
  detectCategory(messageContent: string): { categoryName: string; content: string } | null {
    const colonIndex = messageContent.indexOf(':');
    if (colonIndex === -1 || colonIndex === 0) {
      return null;
    }

    const potentialCategory = messageContent.substring(0, colonIndex).trim();
    const content = messageContent.substring(colonIndex + 1).trim();

    if (!potentialCategory || !content) {
      return null;
    }

    // Buscar categoría (case-insensitive)
    const category = this.categories.get(potentialCategory.toLowerCase());
    if (!category) {
      return null;
    }

    return {
      categoryName: category.name,
      content: content,
    };
  }

  /**
   * Obtener el path del archivo markdown para una categoría
   */
  getCategoryMarkdownPath(categoryName: string): string {
    const normalizedName = categoryName.toLowerCase();
    return join(this.config.VAULT_PATH, 'categories', `${normalizedName}.md`);
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
