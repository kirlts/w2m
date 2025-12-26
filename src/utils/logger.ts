// W2M - Logger Configuration
import pino from 'pino';
import { getConfig } from '../config/index.js';

const config = getConfig();

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

export const logger = pino(loggerOptions);

