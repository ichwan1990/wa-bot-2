const sqlite3 = require('sqlite3').verbose();
const { logger, adminNumbers, dbPath } = require('../config');

let db;

// Initialize database
function initDB() {
  logger.info('Initializing database', { path: dbPath });
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error('Database connection error', { error: err.message });
    } else {
      logger.info('Database connected successfully');
    }
  });
  
  // Create tables
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) logger.error('Error creating users table', { error: err.message });
      else logger.debug('Users table ready');
    });

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount REAL,
      category TEXT,
      description TEXT,
      date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) logger.error('Error creating transactions table', { error: err.message });
      else logger.debug('Transactions table ready');
    });

    // Whitelist table
    db.run(`CREATE TABLE IF NOT EXISTS whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) logger.error('Error creating whitelist table', { error: err.message });
      else logger.debug('Whitelist table ready');
    });

    // Tambahkan setelah pembuatan tabel users dan transactions
db.run(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('masuk', 'pulang')),
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    photo_path TEXT,
    distance INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`, (err) => {
  if (err) {
    logger.error('Error creating attendance table', { error: err.message });
  } else {
    logger.info('Attendance table ready');
  }
});

// Index untuk performa
db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_user_created ON attendance(user_id, created_at)`);

    // Add admin numbers to whitelist
    adminNumbers.forEach(phone => {
      const fullPhone = phone + '@s.whatsapp.net';
      db.run('INSERT OR IGNORE INTO whitelist (phone) VALUES (?)', [fullPhone], (err) => {
        if (err) {
          logger.error('Error adding admin to whitelist', { phone, error: err.message });
        } else {
          logger.debug('Admin added to whitelist', { phone });
        }
      });
    });
  });

  logger.info('Database initialization completed');
}

// Get database instance
function getDB() {
  return db;
}

// Close database
function closeDB(callback) {
  if (db) {
    db.close((err) => {
      if (err) {
        logger.error('Error closing database', { error: err.message });
      } else {
        logger.info('Database connection closed');
      }
      if (callback) callback(err);
    });
  } else {
    if (callback) callback();
  }
}

module.exports = {
  initDB,
  getDB,
  closeDB
};