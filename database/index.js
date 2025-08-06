const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { logger, adminNumbers, dbPath } = require("../config");

let db;

function initDB() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error("Error opening database", { error: err.message });
    } else {
      logger.info("Connected to SQLite database", { path: dbPath });
      createTables();
    }
  });
}

function createTables() {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err)
        logger.error("Error creating users table", { error: err.message });
      else logger.debug("Users table ready");
    }
  );

  // Transactions table
  db.run(
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount REAL,
      category TEXT,
      description TEXT,
      payment_method TEXT DEFAULT 'cash',
      date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err)
        logger.error("Error creating transactions table", {
          error: err.message,
        });
      else logger.debug("Transactions table ready");
    }
  );

  // Add payment_method column if it doesn't exist (for existing databases)
  db.run(
    `ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT 'cash'`,
    (err) => {
      // Ignore error if column already exists
      if (err && !err.message.includes('duplicate column name')) {
        logger.error("Error adding payment_method column", { error: err.message });
      } else {
        logger.debug("Payment method column ready");
      }
    }
  );

  // User balances table
  db.run(
    `CREATE TABLE IF NOT EXISTS user_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      cash_balance REAL DEFAULT 0,
      bank_balance REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
    (err) => {
      if (err)
        logger.error("Error creating user_balances table", {
          error: err.message,
        });
      else logger.debug("User balances table ready");
    }
  );

  // Whitelist table
  db.run(
    `CREATE TABLE IF NOT EXISTS whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => {
      if (err)
        logger.error("Error creating whitelist table", {
          error: err.message,
        });
      else logger.debug("Whitelist table ready");
    }
  );

  // Add admin numbers to whitelist
  adminNumbers.forEach((phone) => {
    const fullPhone = phone + "@s.whatsapp.net";
    db.run(
      "INSERT OR IGNORE INTO whitelist (phone) VALUES (?)",
      [fullPhone],
      (err) => {
        if (err) {
          logger.error("Error adding admin to whitelist", {
            phone,
            error: err.message,
          });
        } else {
          logger.debug("Admin added to whitelist", { phone });
        }
      }
    );
  });

  // Create roles table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      emoji TEXT,
      description TEXT,
      features TEXT, -- JSON string of features array
      commands TEXT, -- JSON string of commands array
      shortcuts TEXT, -- JSON string of shortcuts array
      quick_numbers TEXT, -- JSON string of quick numbers array
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        logger.error("Error creating roles table", { error: err.message });
      } else {
        logger.info("Roles table ready");
        insertDefaultRoles();
      }
    }
  );

  // Create user_roles table (many-to-many relationship)
  db.run(
    `
    CREATE TABLE IF NOT EXISTS user_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      assigned_by INTEGER, -- user_id who assigned this role
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (role_id) REFERENCES roles (id),
      FOREIGN KEY (assigned_by) REFERENCES users (id),
      UNIQUE(user_id, role_id)
    )
  `,
    (err) => {
      if (err) {
        logger.error("Error creating user_roles table", { error: err.message });
      } else {
        logger.info("User_roles table ready");
      }
    }
  );

  // Create role_permissions table for more granular control
  db.run(
    `
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL,
      permission_name TEXT NOT NULL,
      permission_value TEXT, -- JSON for complex permissions
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles (id),
      UNIQUE(role_id, permission_name)
    )
  `,
    (err) => {
      if (err) {
        logger.error("Error creating role_permissions table", {
          error: err.message,
        });
      } else {
        logger.info("Role_permissions table ready");
      }
    }
  );

  // Add indexes for performance
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id, is_active)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id, is_active)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id, permission_name)`
  );
}

// Insert default roles
function insertDefaultRoles() {
  const defaultRoles = [
    {
      name: "finance",
      display_name: "Keuangan",
      emoji: "💰",
      description: "Mengelola transaksi keuangan, laporan, dan grafik",
      features: JSON.stringify([
        "transactions",
        "reports",
        "charts",
        "categories",
      ]),
      commands: JSON.stringify([
        "/saldo",
        "/bulan",
        "/kategori",
        "/chart",
        "/pie",
        "/compare",
        "/hapus",
        "/menu",
        "/help",
        "/stats",
      ]),
      shortcuts: JSON.stringify(["m", "t", "g"]),
      quick_numbers: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    },
    {
      name: "cashier",
      display_name: "Kasir",
      emoji: "🏪",
      description: "Mengelola penjualan, stok, dan laporan kasir",
      features: JSON.stringify(["sales", "inventory", "daily_reports"]),
      commands: JSON.stringify([
        "/jual",
        "/stok",
        "/laporan",
        "/help",
        "/menu",
      ]),
      shortcuts: JSON.stringify(["j", "s"]),
      quick_numbers: JSON.stringify([1, 2, 3, 4, 5]),
    },
    {
      name: "admin",
      display_name: "Administrator",
      emoji: "👑",
      description: "Akses penuh ke semua fitur dan manajemen user",
      features: JSON.stringify([
        "user_management",
        "role_management",
        "all_features",
      ]),
      commands: JSON.stringify(["*"]),
      shortcuts: JSON.stringify(["*"]),
      quick_numbers: JSON.stringify(["*"]),
    },
  ];

  defaultRoles.forEach((role) => {
    db.run(
      `
      INSERT OR IGNORE INTO roles (
        name, display_name, emoji, description, features, commands, shortcuts, quick_numbers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        role.name,
        role.display_name,
        role.emoji,
        role.description,
        role.features,
        role.commands,
        role.shortcuts,
        role.quick_numbers,
      ],
      function (err) {
        if (err) {
          logger.error("Error inserting default role", {
            role: role.name,
            error: err.message,
          });
        } else if (this.changes > 0) {
          logger.info("Default role inserted", {
            role: role.name,
            id: this.lastID,
          });
        }
      }
    );
  });
}

// Get database instance
function getDB() {
  return db;
}

// Get user balance
function getUserBalance(userId, callback) {
  db.get(
    `SELECT cash_balance, bank_balance 
     FROM user_balances 
     WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) {
        logger.error("Error getting user balance", { userId, error: err.message });
        callback(err, null);
      } else if (row) {
        callback(null, {
          cash: row.cash_balance || 0,
          bank: row.bank_balance || 0,
          total: (row.cash_balance || 0) + (row.bank_balance || 0)
        });
      } else {
        // Initialize user balance if doesn't exist
        db.run(
          `INSERT INTO user_balances (user_id, cash_balance, bank_balance) 
           VALUES (?, 0, 0)`,
          [userId],
          function(err) {
            if (err) {
              logger.error("Error initializing user balance", { userId, error: err.message });
              callback(err, null);
            } else {
              callback(null, { cash: 0, bank: 0, total: 0 });
            }
          }
        );
      }
    }
  );
}

// Update user balance
function updateUserBalance(userId, cashChange, bankChange, callback) {
  // First ensure user balance record exists
  db.run(
    `INSERT OR IGNORE INTO user_balances (user_id, cash_balance, bank_balance) 
     VALUES (?, 0, 0)`,
    [userId],
    function(err) {
      if (err) {
        logger.error("Error ensuring user balance exists", { userId, error: err.message });
        callback(err);
        return;
      }
      
      // Update the balance
      db.run(
        `UPDATE user_balances 
         SET cash_balance = cash_balance + ?, 
             bank_balance = bank_balance + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [cashChange, bankChange, userId],
        function(err) {
          if (err) {
            logger.error("Error updating user balance", { 
              userId, 
              cashChange, 
              bankChange, 
              error: err.message 
            });
            callback(err);
          } else {
            logger.debug("User balance updated", { 
              userId, 
              cashChange, 
              bankChange 
            });
            callback(null);
          }
        }
      );
    }
  );
}

// Close database
function closeDB(callback) {
  if (db) {
    db.close((err) => {
      if (err) {
        logger.error("Error closing database", { error: err.message });
      } else {
        logger.info("Database connection closed");
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
  getUserBalance,
  updateUserBalance,
  closeDB,
};
