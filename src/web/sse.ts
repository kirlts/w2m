// W2M - Server-Sent Events para logs en tiempo real

import { Hono } from 'hono';
import { logger } from '../utils/logger.js';
import { WebServerContext } from './index.js';

// Store para clientes SSE conectados
const sseClients = new Set<ReadableStreamDefaultController>();

/**
 * Agregar cliente SSE
 */
export function addSSEClient(controller: ReadableStreamDefaultController): void {
  sseClients.add(controller);
}

/**
 * Remover cliente SSE
 */
export function removeSSEClient(controller: ReadableStreamDefaultController): void {
  sseClients.delete(controller);
}

/**
 * Enviar mensaje a todos los clientes SSE
 */
export function broadcastSSE(event: string, data: any): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  
  for (const client of sseClients) {
    try {
      client.enqueue(encoded);
    } catch (error) {
      // Cliente desconectado, removerlo
      removeSSEClient(client);
    }
  }
}

/**
 * Configurar SSE para logs y QR
 */
export function setupSSE(app: Hono, context: WebServerContext): void {
  const { ingestor } = context;

  // Endpoint SSE para logs
  app.get('/web/api/logs/stream', (c) => {
    const stream = new ReadableStream({
      start(controller) {
        addSSEClient(controller);

        // Enviar mensaje de conexión
        controller.enqueue(new TextEncoder().encode(`event: connected\ndata: ${JSON.stringify({ message: 'Conectado al stream de logs' })}\n\n`));

        // Mantener conexión abierta - enviar heartbeat cada 30 segundos
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
          } catch (error) {
            clearInterval(heartbeat);
            removeSSEClient(controller);
          }
        }, 30000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  });

  // Endpoint SSE para QR
  app.get('/web/api/qr/stream', (c) => {
    const stream = new ReadableStream({
      start(controller) {
        addSSEClient(controller);

        // Enviar estado inicial
        const state = ingestor.getConnectionState();
        controller.enqueue(new TextEncoder().encode(`event: state\ndata: ${JSON.stringify({ state })}\n\n`));

        // Mantener conexión abierta - enviar heartbeat cada 30 segundos
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: heartbeat\n\n`));
          } catch (error) {
            clearInterval(heartbeat);
            removeSSEClient(controller);
          }
        }, 30000);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  });
}

