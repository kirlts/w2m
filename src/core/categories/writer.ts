// W2M - Category Markdown Writer
// Sistema para escribir mensajes categorizados en archivos markdown

import { CategoryManager, CategoryField, Category } from './index.js';
import { Message } from '../ingestor/interface.js';
import { StorageInterface } from '../storage/interface.js';
import { logger } from '../../utils/logger.js';

interface CategorizedMessage {
  content: string;
  sender: string;
  time: string;
  date: string;
  timestamp: number; // Para ordenar por fecha
}

export class CategoryWriter {
  private categoryManager: CategoryManager;
  private storage: StorageInterface;

  constructor(categoryManager: CategoryManager, storage: StorageInterface) {
    this.categoryManager = categoryManager;
    this.storage = storage;
  }

  /**
   * Procesar un mensaje y guardarlo si corresponde a una categoría
   */
  async processMessage(message: Message): Promise<boolean> {
    const detected = this.categoryManager.detectCategory(message.content);
    if (!detected) {
      return false;
    }

    const category = this.categoryManager.getCategory(detected.categoryName);
    if (!category) {
      logger.warn({ categoryName: detected.categoryName }, 'Categoría detectada pero no encontrada en configuración');
      return false;
    }

    // Extraer fecha y hora del time string (formato: "HH:MM:SS - DD/MM/YYYY")
    const parts = message.time.split(' - ');
    const timePart = parts[0] || '';
    const datePart = parts[1] || '';
    const timestamp = this.parseTimestamp(timePart, datePart);

    const categorizedMessage: CategorizedMessage = {
      content: detected.content,
      sender: message.sender,
      time: timePart,
      date: datePart,
      timestamp,
    };

    try {
      await this.appendToCategoryFile(category, categorizedMessage);
      logger.info({ 
        category: category.name, 
        sender: message.sender,
        contentPreview: detected.content.substring(0, 50) + (detected.content.length > 50 ? '...' : '')
      }, `✅ Mensaje guardado en categoría "${category.name}"`);
      return true;
    } catch (error) {
      logger.error({ error, category: category.name, filePath: this.categoryManager.getCategoryMarkdownPath(category.name) }, 'Error al guardar mensaje categorizado');
      return false;
    }
  }

  /**
   * Agregar mensaje a un archivo de categoría
   */
  private async appendToCategoryFile(
    category: Category,
    message: CategorizedMessage
  ): Promise<void> {
    // Obtener ruta relativa (ej: "categories/test.md")
    const relativePath = this.categoryManager.getCategoryMarkdownRelativePath(category.name);

    // Leer archivo existente o crear nuevo
    let existingMessages: CategorizedMessage[] = [];
    let header = '';

    const fileExists = await this.storage.exists(relativePath);
    if (fileExists) {
      const fileContent = await this.storage.readFile(relativePath);
      if (fileContent) {
        const parsed = this.parseMarkdownFile(fileContent);
        header = parsed.header;
        existingMessages = parsed.messages;
      }
    } else {
      // Crear header nuevo
      header = this.generateHeader(category);
    }

    // Agregar nuevo mensaje (no duplicar si ya existe)
    const messageExists = existingMessages.some(
      (m) => m.content === message.content && 
             m.sender === message.sender && 
             m.timestamp === message.timestamp
    );

    if (!messageExists) {
      existingMessages.push(message);
    }

    // Ordenar por timestamp descendente (más reciente primero)
    existingMessages.sort((a, b) => b.timestamp - a.timestamp);

    // Generar contenido del archivo
    const content = this.generateMarkdownContent(header, category, existingMessages);
    
    // Escribir archivo usando StorageInterface
    try {
      await this.storage.saveFile(relativePath, content);
    } catch (error) {
      logger.error({ error, category: category.name, relativePath }, 'Error al escribir archivo markdown');
      throw error;
    }
  }

  /**
   * Generar header del archivo markdown
   */
  private generateHeader(category: Category): string {
    let header = `**CATEGORIA:** ${category.name}\n\n`;
    
    if (category.description) {
      header += `**Descripcion:** ${category.description}\n\n`;
    }
    
    header += '**MENSAJES** (ordenados de más a menos reciente):\n\n';
    return header;
  }

  /**
   * Parsear archivo markdown existente
   */
  private parseMarkdownFile(content: string): { header: string; messages: CategorizedMessage[] } {
    const lines = content.split('\n');
    
    // Buscar donde empiezan los mensajes (después de "MENSAJES")
    let headerEndIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes('MENSAJES')) {
        headerEndIndex = i;
        break;
      }
    }
    
    if (headerEndIndex === -1) {
      // Formato antiguo: buscar por separador ---
      const separatorIndex = lines.findIndex(line => line.trim() === '---');
      if (separatorIndex === -1) {
        return { header: content, messages: [] };
      }
      const header = lines.slice(0, separatorIndex + 1).join('\n') + '\n\n';
      const messagesContent = lines.slice(separatorIndex + 2).join('\n');
      const messages = this.parseMessagesFromContent(messagesContent);
      return { header, messages };
    }

    // Nuevo formato: header hasta "MENSAJES"
    const headerLines = lines.slice(0, headerEndIndex + 1);
    const header = headerLines.join('\n') + '\n\n';
    const messagesContent = lines.slice(headerEndIndex + 1).join('\n');
    const messages = this.parseMessagesFromContent(messagesContent);

    return { header, messages };
  }

  /**
   * Parsear mensajes del contenido (nuevo formato con separadores ---)
   */
  private parseMessagesFromContent(content: string): CategorizedMessage[] {
    const messages: CategorizedMessage[] = [];
    
    // Dividir por separadores ---
    const messageBlocks = content.split(/\n---\n/).filter(block => block.trim());
    
    for (const block of messageBlocks) {
      const parsed = this.parseMessageBlock(block);
      if (parsed) {
        messages.push(parsed);
      }
    }
    
    return messages;
  }

  /**
   * Parsear un bloque de mensaje del markdown
   */
  private parseMessageBlock(block: string): CategorizedMessage | null {
    try {
      const lines = block.split('\n');
      if (lines.length === 0) return null;

      // Formato esperado:
      // ## Mensaje #1
      // - **FECHA:** DD/MM/YYYY
      // - **HORA:** HH:MM:SS
      // - **AUTOR:** Nombre
      // 
      // **CONTENIDO:**
      // 
      // ```
      // contenido del mensaje
      // ```

      let datePart = '';
      let timePart = '';
      let author = 'Desconocido';
      let content = '';

      let inContentBlock = false;
      const contentLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Buscar campos en formato de lista
        if (trimmed.startsWith('- **FECHA:**')) {
          datePart = trimmed.replace('- **FECHA:**', '').trim();
        } else if (trimmed.startsWith('- **HORA:**')) {
          timePart = trimmed.replace('- **HORA:**', '').trim();
        } else if (trimmed.startsWith('- **AUTOR:**')) {
          author = trimmed.replace('- **AUTOR:**', '').trim();
        } else if (trimmed === '```') {
          // Inicio o fin de bloque de código
          inContentBlock = !inContentBlock;
        } else if (inContentBlock) {
          // Dentro del bloque de código - preservar formato original
          contentLines.push(line);
        } else if (trimmed.startsWith('**CONTENIDO:**')) {
          // Esperar bloque de código después
          continue;
        }
      }

      content = contentLines.join('\n').trim();

      if (!datePart || !timePart || !content) {
        return null;
      }

      const timestamp = this.parseTimestamp(timePart, datePart);

      return {
        content,
        sender: author,
        time: timePart,
        date: datePart,
        timestamp,
      };
    } catch (error) {
      logger.warn({ error, block }, 'Error al parsear bloque de mensaje');
      return null;
    }
  }

  /**
   * Generar contenido markdown completo
   */
  private generateMarkdownContent(
    header: string,
    category: Category,
    messages: CategorizedMessage[]
  ): string {
    let content = header;

    if (messages.length === 0) {
      content += '---\n\n';
      content += '_No hay mensajes en esta categoría aún._\n';
      return content;
    }

    messages.forEach((message, index) => {
      const messageNumber = messages.length - index; // Más reciente = número más alto
      content += '---\n\n';
      content += this.formatMessage(message, category.enabledFields, messageNumber);
      content += '\n\n';
    });

    return content.trim() + '\n';
  }

  /**
   * Formatear un mensaje según los campos habilitados
   */
  private formatMessage(message: CategorizedMessage, enabledFields: CategoryField[], messageNumber: number): string {
    const parts: string[] = [];

    // Título del mensaje con número
    parts.push(`## Mensaje #${messageNumber}`);

    // Agregar campos según los habilitados en una lista
    const fieldParts: string[] = [];
    
    if (enabledFields.includes('FECHA')) {
      fieldParts.push(`- **FECHA:** ${message.date}`);
    }

    if (enabledFields.includes('HORA')) {
      fieldParts.push(`- **HORA:** ${message.time}`);
    }

    if (enabledFields.includes('AUTOR')) {
      fieldParts.push(`- **AUTOR:** ${message.sender}`);
    }

    if (fieldParts.length > 0) {
      parts.push(fieldParts.join('\n'));
    }

    // CONTENIDO siempre está presente - formateado como bloque de código para mejor legibilidad
    if (enabledFields.includes('CONTENIDO')) {
      parts.push(`\n**CONTENIDO:**\n\n\`\`\`\n${message.content}\n\`\`\``);
    }

    return parts.join('\n');
  }

  /**
   * Parsear timestamp desde fecha y hora
   */
  private parseTimestamp(time: string, date: string): number {
    try {
      // Formato esperado: "DD/MM/YYYY" y "HH:MM:SS"
      const dateParts = date.split('/').map(Number);
      const timeParts = time.split(':').map(Number);
      
      const day = dateParts[0];
      const month = dateParts[1];
      const year = dateParts[2];
      const hour = timeParts[0] || 0;
      const minute = timeParts[1] || 0;
      const second = timeParts[2] || 0;
      
      if (!day || !month || !year) {
        throw new Error('Fecha incompleta');
      }
      
      const dateObj = new Date(year, month - 1, day, hour, minute, second);
      return dateObj.getTime();
    } catch (error) {
      logger.warn({ error, time, date }, 'Error al parsear timestamp');
      return Date.now(); // Fallback a timestamp actual
    }
  }
}
