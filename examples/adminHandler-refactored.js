/**
 * Contoh refactor adminHandler.js menggunakan sistem messages terpusat
 * File ini menunjukkan bagaimana menggunakan utils/messages.js
 */

const { logger } = require('../config');
const { getUser } = require('../services/userService');
const { adminMessages, error } = require('../utils/messages');
const { 
  getRoleByName, 
  assignRoleToUser, 
  removeRoleFromUser 
} = require('../services/roleService');

// Handle role management - REFACTORED VERSION
async function handleRoleManagement(sock, sender, user, args) {
  if (args.length === 0) {
    // Show role information - this would use a dedicated template
    const roleList = await generateRoleList(); // Function to generate role list
    await sock.sendMessage(sender, { text: roleList });
    return;
  }
  
  const subCommand = args[0].toLowerCase();
  
  switch (subCommand) {
    case 'assign':
      if (args.length < 3) {
        await sock.sendMessage(sender, { 
          text: adminMessages.formatError.roleAssign 
        });
        return;
      }
      
      const assignPhone = args[1] + '@s.whatsapp.net';
      const assignRoleName = args[2];
      
      await assignUserRole(sock, sender, user, assignPhone, assignRoleName);
      break;
      
    case 'remove':
      if (args.length < 3) {
        await sock.sendMessage(sender, { 
          text: adminMessages.formatError.roleRemove 
        });
        return;
      }
      
      const removePhone = args[1] + '@s.whatsapp.net';
      const removeRoleName = args[2];
      
      await removeUserRole(sock, sender, user, removePhone, removeRoleName);
      break;
      
    case 'stats':
      await showRoleStats(sock, sender);
      break;
      
    default:
      await sock.sendMessage(sender, { 
        text: adminMessages.invalidSubCommand('assign, remove, atau stats')
      });
  }
}

// Assign role to user - REFACTORED VERSION
async function assignUserRole(sock, sender, adminUser, targetPhone, roleName) {
  try {
    // Get role
    const role = await getRoleByName(roleName);
    if (!role) {
      await sock.sendMessage(sender, { 
        text: adminMessages.roleNotFound(roleName)
      });
      return;
    }
    
    // Get target user
    const targetUser = await getUser(targetPhone);
    if (!targetUser) {
      const phoneDisplay = targetPhone.replace('@s.whatsapp.net', '');
      await sock.sendMessage(sender, { 
        text: adminMessages.userNotFound(phoneDisplay)
      });
      return;
    }
    
    // Assign role
    const result = await assignRoleToUser(targetUser.id, role.id, adminUser.id);
    
    if (result.success) {
      const phoneDisplay = targetPhone.replace('@s.whatsapp.net', '');
      
      // Send success message to admin
      await sock.sendMessage(sender, { 
        text: adminMessages.roleAssigned(role.emoji, role.display_name, phoneDisplay)
      });
      
      // Notify target user
      await sock.sendMessage(targetPhone, {
        text: adminMessages.roleNotification(role.emoji, role.display_name, role.description)
      });
      
      logger.info('Role assigned via admin command', {
        adminId: adminUser.id,
        targetUserId: targetUser.id,
        roleId: role.id,
        roleName: role.name
      });
    } else {
      await sock.sendMessage(sender, { 
        text: adminMessages.roleAssignFailed(result.message)
      });
    }
    
  } catch (error) {
    logger.error('Error assigning role', { 
      adminId: adminUser.id, 
      targetPhone, 
      roleName,
      error: error.message 
    });
    
    await sock.sendMessage(sender, { text: error.systemError });
  }
}

// Remove role from user - REFACTORED VERSION
async function removeUserRole(sock, sender, adminUser, targetPhone, roleName) {
  try {
    // Get role
    const role = await getRoleByName(roleName);
    if (!role) {
      await sock.sendMessage(sender, { 
        text: adminMessages.roleNotFound(roleName)
      });
      return;
    }
    
    // Get target user
    const targetUser = await getUser(targetPhone);
    if (!targetUser) {
      const phoneDisplay = targetPhone.replace('@s.whatsapp.net', '');
      await sock.sendMessage(sender, { 
        text: adminMessages.userNotFound(phoneDisplay)
      });
      return;
    }
    
    // Remove role
    const result = await removeRoleFromUser(targetUser.id, role.id, adminUser.id);
    
    if (result.success) {
      const phoneDisplay = targetPhone.replace('@s.whatsapp.net', '');
      
      // Send success message to admin
      await sock.sendMessage(sender, { 
        text: adminMessages.roleRemoved(role.emoji, role.display_name, phoneDisplay)
      });
      
      // Notify target user
      await sock.sendMessage(targetPhone, {
        text: adminMessages.roleRemovedNotification(role.emoji, role.display_name)
      });
      
      logger.info('Role removed via admin command', {
        adminId: adminUser.id,
        targetUserId: targetUser.id,
        roleId: role.id,
        roleName: role.name
      });
    } else {
      await sock.sendMessage(sender, { 
        text: adminMessages.roleRemoveFailed(result.message)
      });
    }
    
  } catch (error) {
    logger.error('Error removing role', { 
      adminId: adminUser.id, 
      targetPhone, 
      roleName,
      error: error.message 
    });
    
    await sock.sendMessage(sender, { text: error.systemError });
  }
}

module.exports = {
  handleRoleManagement,
  assignUserRole,
  removeUserRole
};
