const { logger } = require('../config');
const { 
  getAllRoles, 
  getUsersByRole, 
  assignRoleToUser, 
  removeRoleFromUser,
  getRoleStatistics,
  createRole
} = require('../services/roleService');
const { getUser } = require('../services/userService');

// Handle admin commands
async function handleAdminCommand(sock, sender, user, command, args) {
  const userNumber = sender.split('@')[0];
  
  switch (command.toLowerCase()) {
    case 'help':
      const adminHelp = generateAdminHelp();
      await sock.sendMessage(sender, { text: adminHelp });
      break;
      
    case 'role':
      await handleRoleManagement(sock, sender, user, args);
      break;
      
    case 'users':
      await handleUserManagement(sock, sender, user, args);
      break;
      
    case 'stats':
      await handleAdminStats(sock, sender, user);
      break;
      
    default:
      await sock.sendMessage(sender, { 
        text: '❌ Command admin tidak dikenal. Ketik /help untuk bantuan.' 
      });
  }
}

// Handle role management
async function handleRoleManagement(sock, sender, user, args) {
  if (args.length === 0) {
    // Show all roles
    const roles = await getAllRoles();
    let roleList = '👑 *DAFTAR ROLE*\n\n';
    
    roles.forEach(role => {
      roleList += `${role.emoji} *${role.display_name}* (${role.name})\n`;
      roleList += `   ${role.description}\n`;
      roleList += `   Features: ${role.features.length}\n\n`;
    });
    
    roleList += '\n💡 Commands:\n';
    roleList += '• `/role assign [phone] [role_name]` - Assign role\n';
    roleList += '• `/role remove [phone] [role_name]` - Remove role\n';
    roleList += '• `/role stats` - Role statistics';
    
    await sock.sendMessage(sender, { text: roleList });
    return;
  }
  
  const subCommand = args[0].toLowerCase();
  
  switch (subCommand) {
    case 'assign':
      if (args.length < 3) {
        await sock.sendMessage(sender, { 
          text: '❌ Format: /role assign [phone] [role_name]\nContoh: /role assign 628123456789 finance' 
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
          text: '❌ Format: /role remove [phone] [role_name]\nContoh: /role remove 628123456789 finance' 
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
        text: '❌ Sub-command tidak dikenal. Gunakan: assign, remove, atau stats' 
      });
  }
}

// Assign role to user
async function assignUserRole(sock, sender, adminUser, targetPhone, roleName) {
  try {
    const { getRoleByName } = require('../services/roleService');
    
    // Get role
    const role = await getRoleByName(roleName);
    if (!role) {
      await sock.sendMessage(sender, { 
        text: `❌ Role "${roleName}" tidak ditemukan.\n\nRole yang tersedia: finance, attendance, cashier, admin` 
      });
      return;
    }
    
    // Get target user
    const targetUser = await getUser(targetPhone);
    if (!targetUser) {
      await sock.sendMessage(sender, { 
        text: `❌ User dengan nomor ${targetPhone.replace('@s.whatsapp.net', '')} tidak ditemukan.\n\nUser harus mengirim pesan ke bot terlebih dahulu.` 
      });
      return;
    }
    
    // Assign role
    const result = await assignRoleToUser(targetUser.id, role.id, adminUser.id);
    
    if (result.success) {
      await sock.sendMessage(sender, { 
        text: `✅ Role ${role.emoji} *${role.display_name}* berhasil diberikan kepada ${targetPhone.replace('@s.whatsapp.net', '')}` 
      });
      
      // Notify target user
      await sock.sendMessage(targetPhone, {
        text: `🎉 Anda telah diberikan akses sebagai ${role.emoji} *${role.display_name}*!\n\n${role.description}\n\nKetik /help untuk melihat fitur yang tersedia.`
      });
      
      logger.info('Role assigned via admin command', {
        adminId: adminUser.id,
        targetUserId: targetUser.id,
        roleId: role.id,
        roleName: role.name
      });
    } else {
      await sock.sendMessage(sender, { 
        text: `❌ Gagal memberikan role: ${result.message}` 
      });
    }
    
  } catch (error) {
    logger.error('Error assigning role via admin', { error: error.message });
    await sock.sendMessage(sender, { 
      text: '❌ Terjadi kesalahan saat memberikan role' 
    });
  }
}

// Remove role from user
async function removeUserRole(sock, sender, adminUser, targetPhone, roleName) {
  try {
    const { getRoleByName } = require('../services/roleService');
    
    // Get role
    const role = await getRoleByName(roleName);
    if (!role) {
      await sock.sendMessage(sender, { 
        text: `❌ Role "${roleName}" tidak ditemukan.` 
      });
      return;
    }
    
    // Get target user
    const targetUser = await getUser(targetPhone);
    if (!targetUser) {
      await sock.sendMessage(sender, { 
        text: `❌ User tidak ditemukan.` 
      });
      return;
    }
    
    // Remove role
    const result = await removeRoleFromUser(targetUser.id, role.id, adminUser.id);
    
    if (result.success) {
      await sock.sendMessage(sender, { 
        text: `✅ Role ${role.emoji} *${role.display_name}* berhasil dihapus dari ${targetPhone.replace('@s.whatsapp.net', '')}` 
      });
      
      // Notify target user
      await sock.sendMessage(targetPhone, {
        text: `⚠️ Akses Anda sebagai ${role.emoji} *${role.display_name}* telah dicabut oleh administrator.`
      });
      
      logger.info('Role removed via admin command', {
        adminId: adminUser.id,
        targetUserId: targetUser.id,
        roleId: role.id,
        roleName: role.name
      });
    } else {
      await sock.sendMessage(sender, { 
        text: `❌ ${result.message}` 
      });
    }
    
  } catch (error) {
    logger.error('Error removing role via admin', { error: error.message });
    await sock.sendMessage(sender, { 
      text: '❌ Terjadi kesalahan saat menghapus role' 
    });
  }
}

// Show role statistics
async function showRoleStats(sock, sender) {
  try {
    const stats = await getRoleStatistics();
    
    let statsText = '📊 *STATISTIK ROLE*\n\n';
    
    stats.forEach(stat => {
      statsText += `${stat.emoji} *${stat.display_name}*\n`;
      statsText += `   👥 Users: ${stat.user_count}\n`;
      statsText += `   📈 Recent: ${stat.recent_assignments} (30 hari)\n\n`;
    });
    
    await sock.sendMessage(sender, { text: statsText });
    
  } catch (error) {
    logger.error('Error getting role stats', { error: error.message });
    await sock.sendMessage(sender, { 
      text: '❌ Gagal mengambil statistik role' 
    });
  }
}

// Generate admin help
function generateAdminHelp() {
  return `👑 *PANDUAN ADMINISTRATOR*

🔧 *ROLE MANAGEMENT:*
- /role - Lihat semua role
- /role assign [phone] [role] - Berikan role
- /role remove [phone] [role] - Hapus role  
- /role stats - Statistik role

👥 *USER MANAGEMENT:*
- /users - Lihat semua user
- /users [role] - User dengan role tertentu

📊 *STATISTICS:*
- /stats - Statistik sistem umum

💡 *ROLE YANG TERSEDIA:*
- finance - Keuangan (transaksi, laporan)
- attendance - Absensi (lokasi, foto)
- cashier - Kasir (penjualan, stok)
- admin - Administrator (semua akses)

Contoh: /role assign 628123456789 finance`;
}

module.exports = {
  handleAdminCommand,
  handleRoleManagement,
  assignUserRole,
  removeUserRole,
  showRoleStats,
  generateAdminHelp
};