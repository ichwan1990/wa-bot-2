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

  // Tambahkan setelah pembuatan tabel users dan transactions
  db.run(
    `
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
    `,
    (err) => {
      if (err) {
        logger.error("Error creating attendance table", {
          error: err.message,
        });
      } else {
        logger.info("Attendance table ready");
      }
    }
  );

  // Index untuk performa
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_attendance_user_created ON attendance(user_id, created_at)`
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
        "ocr",
      ]),
      commands: JSON.stringify([
        "/saldo",
        "/bulan",
        "/kategori",
        "/chart",
        "/pie",
        "/compare",
        "/hapus",
        "/ocr",
        "/menu",
        "/help",
        "/stats",
      ]),
      shortcuts: JSON.stringify(["m", "t", "g"]),
      quick_numbers: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]),
    },
    {
      name: "attendance",
      display_name: "Absensi",
      emoji: "🏢",
      description: "Mengelola absensi dengan validasi lokasi dan foto",
      features: JSON.stringify([
        "attendance",
        "location_tracking",
        "photo_verification",
      ]),
      commands: JSON.stringify(["/absen", "/help", "/menu"]),
      shortcuts: JSON.stringify([]),
      quick_numbers: JSON.stringify([]),
    },
    {
      name: "cashier",
      display_name: "Kasir",
      emoji: "🏪",
      description: "Mengelola penjualan, stok, dan laporan kasir",
      features: JSON.stringify(["sales", "inventory", "daily_reports", "ocr"]),
      commands: JSON.stringify([
        "/jual",
        "/stok",
        "/laporan",
        "/ocr",
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
  closeDB,
};
