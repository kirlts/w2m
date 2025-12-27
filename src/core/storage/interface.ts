// W2M - Storage Interface
// Interfaz abstracta para sistemas de almacenamiento
// Enfoque: Upload unidireccional - W2M solo empuja cambios

/**
 * Interfaz para sistemas de almacenamiento
 * W2M es el productor, no nos importa si el archivo cambia remotamente
 */
export interface StorageInterface {
  /**
   * Guardar o actualizar un archivo
   * @param path Ruta relativa del archivo (ej: "categories/test.md")
   * @param content Contenido del archivo
   */
  saveFile(path: string, content: string): Promise<void>;

  /**
   * Leer un archivo
   * @param path Ruta relativa del archivo
   * @returns Contenido del archivo o null si no existe
   */
  readFile(path: string): Promise<string | null>;

  /**
   * Verificar si un archivo existe
   * @param path Ruta relativa del archivo
   */
  exists(path: string): Promise<boolean>;

  /**
   * Eliminar un archivo
   * @param path Ruta relativa del archivo
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Listar archivos en un directorio
   * @param path Ruta relativa del directorio
   * @returns Array de rutas relativas de archivos
   */
  listFiles(path: string): Promise<string[]>;

  /**
   * Inicializar el sistema de almacenamiento
   */
  initialize(): Promise<void>;
}

