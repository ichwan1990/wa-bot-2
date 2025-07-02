const { logger, fileLogger } = require('../config');
const { getDB } = require('../database');

// Get role by name
function getRoleByName(roleName) {
  return new Promise((resolve) => {
    const db = getDB();
    db.get(
      'SELECT * FROM roles WHERE name = ? AND is_active = 1',
      [roleName],
      (err, row) => {
        if (err) {
          logger.error('Error getting role by name', { roleName, error: err.message });
          resolve(null);
        } else if (row) {
          // Parse JSON fields
          resolve({
            ...row,
            features: JSON.parse(row.features || '[]'),
            commands: JSON.parse(row.commands || '[]'),
            shortcuts: JSON.parse(row.shortcuts || '[]'),
            quick_numbers: JSON.parse(row.quick_numbers || '[]')
          });
        } else {
          resolve(null);
        }
      }
    );
  });
}

// Get all roles
function getAllRoles() {
  return new Promise((resolve) => {
    const db = getDB();
    db.all(
      'SELECT * FROM roles WHERE is_active = 1 ORDER BY display_name',
      [],
      (err, rows) => {
        if (err) {
          logger.error('Error getting all roles', { error: err.message });
          resolve([]);
        } else {
          const roles = rows.map(row => ({
            ...row,
            features: JSON.parse(row.features || '[]'),
            commands: JSON.parse(row.commands || '[]'),
            shortcuts: JSON.parse(row.shortcuts || '[]'),
            quick_numbers: JSON.parse(row.quick_numbers || '[]')
          }));
          resolve(roles);
        }
      }
    );
  });
}

// Get user roles
function getUserRoles(userId) {
  return new Promise((resolve) => {
    const db = getDB();
    const query = `
      SELECT r.*, ur.assigned_at, ur.assigned_by, ur.is_active as role_is_active
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
      ORDER BY ur.assigned_at DESC
    `;
    
    db.all(query, [userId], (err, rows) => {
      if (err) {
        logger.error('Error getting user roles', { userId, error: err.message });
        resolve([]);
      } else {
        const roles = rows.map(row => ({
          id: row.id,
          name: row.name,
          display_name: row.display_name,
          emoji: row.emoji,
          description: row.description,
          features: JSON.parse(row.features || '[]'),
          commands: JSON.parse(row.commands || '[]'),
          shortcuts: JSON.parse(row.shortcuts || '[]'),
          quick_numbers: JSON.parse(row.quick_numbers || '[]'),
          assigned_at: row.assigned_at,
          assigned_by: row.assigned_by
        }));
        resolve(roles);
      }
    });
  });
}

// Get user primary role (first active role)
async function getUserPrimaryRole(userId) {
  const roles = await getUserRoles(userId);
  return roles.length > 0 ? roles[0] : null;
}

// Assign role to user
function assignRoleToUser(userId, roleId, assignedBy = null) {
  return new Promise((resolve) => {
    const db = getDB();
    
    // First check if role exists and is active
    db.get('SELECT id FROM roles WHERE id = ? AND is_active = 1', [roleId], (err, role) => {
      if (err) {
        logger.error('Error checking role', { roleId, error: err.message });
        resolve({ success: false, message: 'Error checking role' });
        return;
      }
      
      if (!role) {
        resolve({ success: false, message: 'Role not found or inactive' });
        return;
      }
      
      // Insert or update user role
      const query = `
        INSERT OR REPLACE INTO user_roles (user_id, role_id, assigned_by, assigned_at, is_active)
        VALUES (?, ?, ?, datetime('now'), 1)
      `;
      
      db.run(query, [userId, roleId, assignedBy], function(err) {
        if (err) {
          logger.error('Error assigning role', { 
            userId, roleId, assignedBy, error: err.message 
          });
          resolve({ success: false, message: 'Error assigning role' });
        } else {
          logger.info('Role assigned successfully', { 
            userId, roleId, assignedBy, userRoleId: this.lastID 
          });
          
          fileLogger.info('role_assigned', {
            userId, roleId, assignedBy, 
            userRoleId: this.lastID,
            timestamp: new Date().toISOString()
          });
          
          resolve({ success: true, userRoleId: this.lastID });
        }
      });
    });
  });
}

// Remove role from user
function removeRoleFromUser(userId, roleId, removedBy = null) {
  return new Promise((resolve) => {
    const db = getDB();
    
    db.run(
      'UPDATE user_roles SET is_active = 0 WHERE user_id = ? AND role_id = ?',
      [userId, roleId],
      function(err) {
        if (err) {
          logger.error('Error removing role', { 
            userId, roleId, removedBy, error: err.message 
          });
          resolve({ success: false, message: 'Error removing role' });
        } else {
          const removed = this.changes > 0;
          
          if (removed) {
            logger.info('Role removed successfully', { userId, roleId, removedBy });
            
            fileLogger.info('role_removed', {
              userId, roleId, removedBy,
              timestamp: new Date().toISOString()
            });
          }
          
          resolve({ 
            success: removed, 
            message: removed ? 'Role removed' : 'User role not found' 
          });
        }
      }
    );
  });
}

// Check if user has permission
async function userHasPermission(userId, feature) {
  const roles = await getUserRoles(userId);
  
  for (const role of roles) {
    // Admin has all permissions
    if (role.name === 'admin') return true;
    
    // Check if feature is in role's features
    if (role.features.includes(feature) || role.features.includes('all_features')) {
      return true;
    }
  }
  
  return false;
}

// Check if user can use command
async function userCanUseCommand(userId, command) {
  const roles = await getUserRoles(userId);
  
  for (const role of roles) {
    // Admin can use all commands
    if (role.name === 'admin' || role.commands.includes('*')) return true;
    
    // Check if command is in role's commands
    if (role.commands.includes(command)) {
      return true;
    }
  }
  
  return false;
}

// Check if user can use shortcut
async function userCanUseShortcut(userId, shortcut) {
  const roles = await getUserRoles(userId);
  
  for (const role of roles) {
    // Admin can use all shortcuts
    if (role.name === 'admin' || role.shortcuts.includes('*')) return true;
    
    // Check if shortcut is in role's shortcuts
    if (role.shortcuts.includes(shortcut)) {
      return true;
    }
  }
  
  return false;
}

// Check if user can use quick number
async function userCanUseQuickNumber(userId, number) {
  const roles = await getUserRoles(userId);
  
  for (const role of roles) {
    // Admin can use all quick numbers
    if (role.name === 'admin' || role.quick_numbers.includes('*')) return true;
    
    // Check if number is in role's quick numbers
    if (role.quick_numbers.includes(number)) {
      return true;
    }
  }
  
  return false;
}

// Get users by role
function getUsersByRole(roleId) {
  return new Promise((resolve) => {
    const db = getDB();
    const query = `
      SELECT u.*, ur.assigned_at, r.name as role_name, r.display_name
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.role_id = ? AND ur.is_active = 1 AND r.is_active = 1
      ORDER BY ur.assigned_at DESC
    `;
    
    db.all(query, [roleId], (err, rows) => {
      if (err) {
        logger.error('Error getting users by role', { roleId, error: err.message });
        resolve([]);
      } else {
        resolve(rows);
      }
    });
  });
}

// Create new role
function createRole(roleData) {
  return new Promise((resolve) => {
    const db = getDB();
    
    const {
      name, display_name, emoji, description,
      features = [], commands = [], shortcuts = [], quick_numbers = []
    } = roleData;
    
    const query = `
      INSERT INTO roles (
        name, display_name, emoji, description, features, commands, shortcuts, quick_numbers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
      name, display_name, emoji, description,
      JSON.stringify(features), JSON.stringify(commands),
      JSON.stringify(shortcuts), JSON.stringify(quick_numbers)
    ], function(err) {
      if (err) {
        logger.error('Error creating role', { name, error: err.message });
        resolve({ success: false, message: err.message });
      } else {
        logger.info('Role created successfully', { name, id: this.lastID });
        
        fileLogger.info('role_created', {
          roleId: this.lastID, name, display_name,
          timestamp: new Date().toISOString()
        });
        
        resolve({ success: true, roleId: this.lastID });
      }
    });
  });
}

// Get role statistics
function getRoleStatistics() {
  return new Promise((resolve) => {
    const db = getDB();
    const query = `
      SELECT 
        r.id, r.name, r.display_name, r.emoji,
        COUNT(ur.user_id) as user_count,
        COUNT(CASE WHEN ur.assigned_at >= date('now', '-30 days') THEN 1 END) as recent_assignments
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = 1
      WHERE r.is_active = 1
      GROUP BY r.id, r.name, r.display_name, r.emoji
      ORDER BY user_count DESC, r.display_name
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        logger.error('Error getting role statistics', { error: err.message });
        resolve([]);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  getRoleByName,
  getAllRoles,
  getUserRoles,
  getUserPrimaryRole,
  assignRoleToUser,
  removeRoleFromUser,
  userHasPermission,
  userCanUseCommand,
  userCanUseShortcut,
  userCanUseQuickNumber,
  getUsersByRole,
  createRole,
  getRoleStatistics
};