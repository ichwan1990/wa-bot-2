const { logger, adminNumbers } = require('../config');
const { isGroupChat, isBroadcast, isPrivateChat } = require('../utils/chatUtils');
const { messageStats, getStatsText } = require('../utils/messageStats');
const { getUser, isAuthorized } = require('../services/userService');
const { 
  userHasPermission, 
  userCanUseCommand,
  userCanUseShortcut,
  userCanUseQuickNumber
} = require('../services/roleService');

// ... existing imports

// Updated role-based command handler
async function handleRoleBasedCommand(sock, sender, user, command, args) {
  const userNumber = sender.split('@')[0];
  
  // Check if user has role
  if (!user.role) {
    await sock.sendMessage(sender, { 
      text: `❌ Anda belum memiliki role yang terdaftar.\n\nHubungi administrator untuk mendapatkan akses.`
    });
    return;
  }
  
  // Check command permission
  const canUse = await userCanUseCommand(user.id, `/${command}`);
  if (!canUse) {
    await sock.sendMessage(sender, { 
      text: `❌ Command /${command} tidak tersedia untuk role ${user.role.emoji} ${user.role.display_name}\n\nKetik /help untuk melihat command yang tersedia.`
    });
    return;
  }
  
  logger.info('Role-based command received', { 
    from: userNumber, 
    command, 
    role: user.role.name,
    userId: user.id,
    args: args.join(' ') 
  });
  
  // Route to appropriate handler based on role and command
  switch (user.role.name) {
    case 'finance':
      await handleFinanceCommand(sock, sender, user, command, args);
      break;
      
    case 'attendance':
      await handleAttendanceCommand(sock, sender, userNumber, args);
      break;
      
    case 'cashier':
      await handleCashierCommand(sock, sender, user, command, args);
      break;
      
    case 'admin':
      // Admin can access all commands, route based on command type
      if (await userHasPermission(user.id, 'transactions') && 
          ['saldo', 'bulan', 'kategori', 'chart', 'pie', 'compare', 'hapus', 'ocr'].includes(command)) {
        await handleFinanceCommand(sock, sender, user, command, args);
      } else if (command === 'absen') {
        await handleAttendanceCommand(sock, sender, userNumber, args);
      } else if (['jual', 'stok', 'laporan'].includes(command)) {
        await handleCashierCommand(sock, sender, user, command, args);
      } else {
        await handleAdminCommand(sock, sender, user, command, args);
      }
      break;
      
    default:
      await sock.sendMessage(sender, { 
        text: `❌ Role "${user.role.display_name}" tidak dikenali. Hubungi administrator.` 
      });
  }
}

// Updated handleTextMessage with database role checking
async function handleTextMessage(sock, sender, user, text) {
  const userNumber = sender.split('@')[0];
  
  // Check if user has role
  if (!user.role) {
    await sock.sendMessage(sender, { 
      text: `❌ Anda belum memiliki role yang terdaftar.\n\nHubungi administrator untuk mendapatkan akses.\n\nNomor Anda: ${userNumber}`
    });
    return;
  }
  
  try {
    // Existing OCR and attendance checks...
    
    // Handle numbered quick commands with database role checking
    if (/^[0-9]$/.test(text.trim()) && 
        !OCRStateManager.isWaitingForConfirmation(userNumber) &&
        !OCRStateManager.isWaitingForImage(userNumber) &&
        !AttendanceStateManager.isInAttendanceMode(userNumber)) {
      
      const quickNumber = parseInt(text.trim());
      
      const canUse = await userCanUseQuickNumber(user.id, quickNumber);
      if (!canUse) {
        await sock.sendMessage(sender, { 
          text: `❌ Quick command ${quickNumber} tidak tersedia untuk role ${user.role.emoji} ${user.role.display_name}` 
        });
        return;
      }
      
      messageStats.commands++;
      
      // Route based on role
      if (user.role.name === 'finance' || user.role.name === 'admin') {
        await handleQuickNumber(sock, sender, user, quickNumber);
      }
      return;
    }
    
    // Handle shortcut commands with database role checking
    if (/^[mtgjsl]\s+/.test(text.toLowerCase()) &&
        !OCRStateManager.isWaitingForConfirmation(userNumber) &&
        !OCRStateManager.isWaitingForImage(userNumber) &&
        !AttendanceStateManager.isInAttendanceMode(userNumber)) {
      
      const shortcut = text.toLowerCase().charAt(0);
      
      const canUse = await userCanUseShortcut(user.id, shortcut);
      if (!canUse) {
        await sock.sendMessage(sender, { 
          text: `❌ Shortcut "${shortcut}" tidak tersedia untuk role ${user.role.emoji} ${user.role.display_name}` 
        });
        return;
      }
      
      // Route based on shortcut and role
      if (['m', 't', 'g'].includes(shortcut) && (user.role.name === 'finance' || user.role.name === 'admin')) {
        await handleShortcutCommand(sock, sender, user, text);
      } else if (['j', 's'].includes(shortcut) && (user.role.name === 'cashier' || user.role.name === 'admin')) {
        await handleCashierShortcut(sock, sender, user, text);
      }
      return;
    }
    
    if (text.startsWith('/')) {
      // Handle commands with database role checking
      messageStats.commands++;
      const [command, ...args] = text.slice(1).split(' ');
      await handleRoleBasedCommand(sock, sender, user, command, args);
    } else {
      // Handle natural language berdasarkan role
      await handleNaturalLanguage(sock, sender, user, text);
    }
    
  } catch (error) {
    logger.error('Error handling text message', { 
      from: userNumber, 
      role: user.role?.name,
      userId: user.id,
      error: error.message,
      stack: error.stack
    });
    
    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan sistem' });
  }
}

// Updated main message handler
async function handleMessage(sock, m) {
  const message = m.messages[0];
  if (!message?.message || message.key.fromMe) return;
  
  const sender = message.key.remoteJid;
  const userNumber = sender.split('@')[0];
  
  // Increment total message counter
  messageStats.total++;
  
  // Existing group/broadcast/private checks...
  
  // Check if user is authorized (has role)
  if (!await isAuthorized(sender)) {
    messageStats.ignored.unauthorized++;
    logger.warn('Message from user without role silently ignored', { 
      from: userNumber,
      totalUnauthorizedIgnored: messageStats.ignored.unauthorized
    });
    
    // Send info message for unregistered users
    await sock.sendMessage(sender, {
      text: `👋 Selamat datang!\n\nAnda belum terdaftar dalam sistem.\nHubungi administrator untuk mendapatkan akses.\n\n📱 Nomor Anda: ${userNumber}`
    });
    return;
  }
  
  // Increment processed counter
  messageStats.processed++;
  
  const user = await getUser(sender);
  if (!user) {
    logger.error('Failed to get user', { sender });
    return;
  }
  
  // Welcome new users with role info
  if (user.role && !user.welcomed) {
    const welcomeMsg = `👋 Selamat datang ${user.role.emoji} *${user.role.display_name}*!\n\n${user.role.description}\n\nKetik /help untuk panduan atau /menu untuk pilihan cepat.`;
    await sock.sendMessage(sender, { text: welcomeMsg });
    
    logger.info('User welcomed with role', { 
      userNumber, 
      userId: user.id,
      role: user.role.name 
    });
  }
  
  // Continue with existing message handling...
  
  try {
    // Handle different message types
    if (message.message.conversation || message.message.extendedTextMessage) {
      const text = message.message.conversation || message.message.extendedTextMessage.text;
      
      logger.info('Private text message received', { 
        from: userNumber, 
        userId: user.id,
        role: user.role?.name,
        textLength: text.length,
        textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
      });
      
      await handleTextMessage(sock, sender, user, text);
      
    } else if (message.message.imageMessage) {
      // Handle image message with role checking
      if (user.role && await userHasPermission(user.id, 'ocr')) {
        // Existing OCR/attendance image handling...
      } else {
        await sock.sendMessage(sender, {
          text: `📸 Foto diterima, tapi role ${user.role?.emoji} ${user.role?.display_name} tidak memiliki akses untuk memproses foto.`
        });
      }
      
    } else if (message.message.locationMessage) {
      // Handle location message with role checking
      if (user.role && await userHasPermission(user.id, 'attendance')) {
        // Existing attendance location handling...
      } else {
        await sock.sendMessage(sender, {
          text: `📍 Lokasi diterima, tapi role ${user.role?.emoji} ${user.role?.display_name} tidak memiliki akses absensi.`
        });
      }
      
    } else {
      // Other message types
      logger.debug('Unsupported message type', { 
        userNumber,
        userId: user.id,
        role: user.role?.name,
        messageType: Object.keys(message.message)[0]
      });
    }
    
  } catch (error) {
    logger.error('Error handling message', { 
      from: userNumber, 
      userId: user.id,
      role: user.role?.name,
      error: error.message,
      stack: error.stack
    });
    
    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan sistem' });
  }
}

module.exports = {
  handleMessage
};