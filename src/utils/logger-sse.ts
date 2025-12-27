// W2M - Logger SSE Integration
// Integración del logger con Server-Sent Events para el dashboard web

import { broadcastSSE } from '../web/sse.js';

let sseEnabled = false;

/**
 * Habilitar integración SSE del logger
 */
export function enableLoggerSSE(): void {
  sseEnabled = true;
}

/**
 * Deshabilitar integración SSE del logger
 */
export function disableLoggerSSE(): void {
  sseEnabled = false;
}

/**
 * Enviar log a SSE
 */
export function sendLogToSSE(level: string, message: string, data?: any): void {
  if (!sseEnabled) return;

  try {
    broadcastSSE('log', {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Ignorar errores de SSE (puede que no haya clientes conectados)
  }
}

