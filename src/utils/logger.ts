// W2M - Logger Configuration
import pino from 'pino';
import { getConfig } from '../config/index.js';

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

// Crear logger con destino stderr
export const logger = pino(loggerOptions, destination);

