// W2M - Logger Configuration
import pino from 'pino';
import { getConfig } from '../config/index.js';
import { sendLogToSSE } from './logger-sse.js';

const config = getConfig();

// Escribir logs a stderr para no interferir con el CLI (que usa stdout)
const destination = pino.destination({
  dest: 2, // stderr
  sync: false,
});

const loggerOptions: pino.LoggerOptions = {
  level: config.LOG_LEVEL,
};

if (config.LOG_FORMAT === 'pretty') {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  };
}

// Crear logger base
const baseLogger = pino(loggerOptions, destination);

// Wrapper para enviar logs a SSE también
export const logger = {
  trace: (obj: any, msg?: string) => {
    baseLogger.trace(obj, msg);
    if (msg) sendLogToSSE('trace', msg, obj);
  },
  debug: (obj: any, msg?: string) => {
    baseLogger.debug(obj, msg);
    if (msg) sendLogToSSE('debug', msg, obj);
  },
  info: (obj: any, msg?: string) => {
    baseLogger.info(obj, msg);
    if (msg) sendLogToSSE('info', msg, obj);
  },
  warn: (obj: any, msg?: string) => {
    baseLogger.warn(obj, msg);
    if (msg) sendLogToSSE('warn', msg, obj);
  },
  error: (obj: any, msg?: string) => {
    baseLogger.error(obj, msg);
    if (msg) sendLogToSSE('error', msg, obj);
  },
  fatal: (obj: any, msg?: string) => {
    baseLogger.fatal(obj, msg);
    if (msg) sendLogToSSE('fatal', msg, obj);
  },
  child: baseLogger.child.bind(baseLogger),
};

