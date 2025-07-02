require('dotenv').config();
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Setup Pino logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

// File transport for production logs
const fileLogger = pino(pino.destination({
  dest: './logs/app.log',
  sync: false
}));

// Create necessary directories
function createDirectories() {
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
  }

  if (!fs.existsSync('./charts')) {
    fs.mkdirSync('./charts');
  }

  if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions');
  }
}

// Admin numbers from environment
const adminNumbers = process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : [];

// Database path
const dbPath = process.env.DB_PATH || './financial.db';

function createDirectories() {
  const dirs = [
    path.join(__dirname, '..', 'logs'),
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'uploads', 'attendance'),
    path.join(__dirname, '..', 'uploads', 'charts'),
    path.join(__dirname, '..', 'uploads', 'ocr'),
    path.join(__dirname, '..', 'sessions')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

module.exports = {
  logger,
  fileLogger,
  createDirectories,
  adminNumbers,
  dbPath
};