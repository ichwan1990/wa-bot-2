const { logger } = require('../config');
const { getDB } = require('../database');

// Check if user is whitelisted
function isWhitelisted(phone) {
  return new Promise((resolve) => {
    const db = getDB();
    db.get('SELECT * FROM whitelist WHERE phone = ?', [phone], (err, row) => {
      if (err) {
        logger.error('Error checking whitelist', { phone, error: err.message });
        resolve(false);
      } else {
        const isAllowed = !!row;
        logger.debug('Whitelist check', { phone: phone.split('@')[0], allowed: isAllowed });
        resolve(isAllowed);
      }
    });
  });
}

// Get or create user
function getUser(phone) {
  return new Promise((resolve) => {
    const db = getDB();
    db.get('SELECT * FROM users WHERE phone = ?', [phone], (err, row) => {
      if (err) {
        logger.error('Error getting user', { phone, error: err.message });
        resolve(null);
        return;
      }
      
      if (row) {
        logger.debug('User found', { userId: row.id, phone: phone.split('@')[0] });
        resolve(row);
      } else {
        // Create new user
        const userName = phone.split('@')[0];
        db.run('INSERT INTO users (phone, name) VALUES (?, ?)', [phone, userName], function(err) {
          if (err) {
            logger.error('Error creating user', { phone, error: err.message });
            resolve(null);
          } else {
            const newUser = { id: this.lastID, phone, name: userName };
            logger.info('New user created', { userId: newUser.id, phone: phone.split('@')[0] });
            resolve(newUser);
          }
        });
      }
    });
  });
}

// Add user to whitelist
function addToWhitelist(phone) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.run('INSERT OR IGNORE INTO whitelist (phone) VALUES (?)', [phone], (err) => {
      if (err) {
        logger.error('Error adding to whitelist', { phone, error: err.message });
        reject(err);
      } else {
        logger.info('User added to whitelist', { phone });
        resolve(true);
      }
    });
  });
}

// Remove user from whitelist
function removeFromWhitelist(phone) {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.run('DELETE FROM whitelist WHERE phone = ?', [phone], function(err) {
      if (err) {
        logger.error('Error removing from whitelist', { phone, error: err.message });
        reject(err);
      } else if (this.changes > 0) {
        logger.info('User removed from whitelist', { phone });
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// Get whitelist
function getWhitelist() {
  return new Promise((resolve, reject) => {
    const db = getDB();
    db.all('SELECT phone FROM whitelist ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        logger.error('Error getting whitelist', { error: err.message });
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

module.exports = {
  isWhitelisted,
  getUser,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelist
};