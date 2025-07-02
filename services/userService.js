const { logger } = require('../config');
const { getDB } = require('../database');
const { getUserPrimaryRole } = require('./roleService');

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

// Update getUser function
async function getUser(phone) {
  return new Promise(async (resolve) => {
    const db = getDB();
    
    db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, row) => {
      if (err) {
        logger.error('Error getting user', { phone, error: err.message });
        resolve(null);
      } else if (row) {
        // Get user's primary role
        const primaryRole = await getUserPrimaryRole(row.id);
        
        resolve({
          ...row,
          role: primaryRole
        });
      } else {
        // Create new user (without role assignment)
        db.run(
          'INSERT INTO users (phone, created_at) VALUES (?, ?)',
          [phone, new Date().toISOString()],
          async function(err) {
            if (err) {
              logger.error('Error creating user', { phone, error: err.message });
              resolve(null);
            } else {
              logger.info('New user created without role', { 
                userId: this.lastID, 
                phone
              });
              
              fileLogger.info('user_created', {
                id: this.lastID,
                phone,
                timestamp: new Date().toISOString()
              });
              
              resolve({
                id: this.lastID,
                phone,
                role: null, // No role assigned yet
                created_at: new Date().toISOString()
              });
            }
          }
        );
      }
    });
  });
}

// Check if user is authorized (has any active role)
async function isAuthorized(phone) {
  const user = await getUser(phone);
  return user && user.role !== null;
}

// Get user by phone with full role info
async function getUserWithRoles(phone) {
  const user = await getUser(phone);
  if (!user) return null;
  
  const { getUserRoles } = require('./roleService');
  const roles = await getUserRoles(user.id);
  
  return {
    ...user,
    roles: roles
  };
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
  isAuthorized,
  getUserWithRoles,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelist
};