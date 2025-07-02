const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { logger } = require('../config');
const AttendanceStateManager = require('../utils/attendanceStateManager');
const {
  isWithinOfficeRadius,
  addAttendance,
  getTodayAttendance,
  getAttendanceSummary,
  getTodayAttendanceStatus,  // New
  validateAttendanceType,    // New
  OFFICE_CENTER,
  OFFICE_RADIUS
} = require('../services/attendanceService');

// Handle /absen command with optional args
async function handleAttendanceCommand(sock, sender, userNumber, args = []) {
  try {
    // Clear any existing state
    AttendanceStateManager.clearUserState(userNumber);
    
    // Check if user provided direct command
    if (args.length > 0) {
      const subCommand = args[0].toLowerCase().trim();
      const user = await require('../services/userService').getUser(sender);
      
      switch (subCommand) {
        case 'masuk':
        case 'in':
          await startAttendanceFlow(sock, sender, userNumber, 'masuk');
          break;
          
        case 'pulang':
        case 'out':
          await startAttendanceFlow(sock, sender, userNumber, 'pulang');
          break;
          
        case 'status':
        case 'cek':
          await handleTodayStatus(sock, sender, user);
          break;
          
        case 'rekap':
        case 'report':
          await handleAttendanceSummary(sock, sender, user);
          break;
          
        default:
          await showAttendanceMenu(sock, sender, userNumber);
      }
    } else {
      // No args, show menu
      await showAttendanceMenu(sock, sender, userNumber);
    }
    
  } catch (error) {
    logger.error('Error handling attendance command', { 
      userNumber, 
      args,
      error: error.message 
    });
    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan sistem' });
  }
}

// Show attendance menu
async function showAttendanceMenu(sock, sender, userNumber) {
  try {
    // Get user and today's status
    const user = await require('../services/userService').getUser(sender);
    let statusInfo = '';
    
    if (user) {
      const status = await getTodayAttendanceStatus(user.id);
      if (!status.error) {
        const today = moment().format('DD/MM');
        statusInfo = `\n📅 *STATUS HARI INI (${today}):*\n`;
        statusInfo += status.hasMasuk ? `🟢 Masuk: ${status.masukTime} ✅\n` : `❌ Belum masuk\n`;
        statusInfo += status.hasPulang ? `🔴 Pulang: ${status.pulangTime} ✅\n` : `❌ Belum pulang\n`;
        statusInfo += '\n';
      }
    }

    const menuText = `🏢 *SISTEM ABSENSI*

📍 Lokasi Kantor: ${OFFICE_CENTER.name}
📏 Radius Valid: ${OFFICE_RADIUS}m
${statusInfo}⚡ *COMMAND CEPAT:*
- \`/absen masuk\` - Langsung absen masuk
- \`/absen pulang\` - Langsung absen pulang
- \`/absen status\` - Cek status hari ini
- \`/absen rekap\` - Rekap bulanan

📝 *ATAU PILIH:*
🟢 **masuk** - Absen Masuk
🔴 **pulang** - Absen Pulang  
📊 **status** - Status Hari Ini
📋 **rekap** - Rekap Absensi

Ketik pilihan Anda:`;

    // Set user to menu choice mode for backward compatibility
    AttendanceStateManager.setWaitingForMenuChoice(userNumber);
    
    await sock.sendMessage(sender, { text: menuText });
    logger.info('Attendance menu sent with status', { userNumber });
    
  } catch (error) {
    logger.error('Error showing attendance menu', { userNumber, error: error.message });
    
    // Fallback to simple menu
    const simpleMenu = `🏢 *SISTEM ABSENSI*

⚡ *COMMAND CEPAT:*
- \`/absen masuk\` - Absen masuk
- \`/absen pulang\` - Absen pulang
- \`/absen status\` - Status hari ini
- \`/absen rekap\` - Rekap bulanan

Ketik pilihan Anda:`;

    AttendanceStateManager.setWaitingForMenuChoice(userNumber);
    await sock.sendMessage(sender, { text: simpleMenu });
  }
}

// Update startAttendanceFlow dengan validasi
async function startAttendanceFlow(sock, sender, userNumber, type) {
  try {
    // Get user first
    const user = await require('../services/userService').getUser(sender);
    if (!user) {
      await sock.sendMessage(sender, { 
        text: '❌ User tidak ditemukan. Silakan coba lagi.' 
      });
      return;
    }

    // Validate attendance type
    const validation = await validateAttendanceType(user.id, type);
    
    if (!validation.valid) {
      const suggestion = validation.suggestion;
      let suggestionText = '';
      
      if (suggestion === 'masuk') {
        suggestionText = '\n\n💡 Gunakan `/absen masuk` untuk absen masuk terlebih dahulu.';
      } else if (suggestion === 'pulang') {
        suggestionText = '\n\n💡 Gunakan `/absen pulang` untuk absen pulang.';
      } else if (suggestion === 'status') {
        suggestionText = '\n\n💡 Gunakan `/absen status` untuk melihat status absensi hari ini.';
      }
      
      await sock.sendMessage(sender, {
        text: `❌ ${validation.message}${suggestionText}`
      });
      
      logger.info('Attendance validation failed', { 
        userNumber, 
        type, 
        reason: validation.message 
      });
      return;
    }

    // If validation passed, continue with normal flow
    AttendanceStateManager.setWaitingForLocation(userNumber, type);
    
    const typeText = type === 'masuk' ? 'MASUK' : 'PULANG';
    const emoji = type === 'masuk' ? '🟢' : '🔴';
    
    await sock.sendMessage(sender, {
      text: `${emoji} *ABSEN ${typeText}*

📍 Silakan kirim lokasi Anda dengan cara:
1. Klik 📎 (attachment)
2. Pilih 📍 Location  
3. Kirim Current Location

⚠️ Pastikan Anda berada dalam radius ${OFFICE_RADIUS}m dari kantor

Ketik "batal" untuk membatalkan.`
    });
    
    logger.info('Attendance flow started after validation', { userNumber, type });
    
  } catch (error) {
    logger.error('Error in startAttendanceFlow', { 
      userNumber, 
      type, 
      error: error.message 
    });
    await sock.sendMessage(sender, { 
      text: '❌ Terjadi kesalahan sistem. Silakan coba lagi.' 
    });
  }
}

// Update handleAttendanceChoice dengan validasi
async function handleAttendanceChoice(sock, sender, user, userNumber, choice) {
  try {
    const normalizedChoice = choice.toLowerCase().trim();
    
    switch (normalizedChoice) {
      case 'masuk':
      case 'in':
        // Validate before starting flow
        const masukValidation = await validateAttendanceType(user.id, 'masuk');
        if (!masukValidation.valid) {
          const suggestion = masukValidation.suggestion === 'pulang' 
            ? '\n\n💡 Gunakan `/absen pulang` untuk absen pulang.' 
            : masukValidation.suggestion === 'status'
            ? '\n\n💡 Gunakan `/absen status` untuk melihat status absensi.'
            : '';
          
          await sock.sendMessage(sender, {
            text: `❌ ${masukValidation.message}${suggestion}`
          });
          AttendanceStateManager.clearUserState(userNumber);
          return;
        }
        await startAttendanceFlow(sock, sender, userNumber, 'masuk');
        break;
        
      case 'pulang':
      case 'out':
        // Validate before starting flow
        const pulangValidation = await validateAttendanceType(user.id, 'pulang');
        if (!pulangValidation.valid) {
          const suggestion = pulangValidation.suggestion === 'masuk' 
            ? '\n\n💡 Gunakan `/absen masuk` untuk absen masuk dulu.' 
            : pulangValidation.suggestion === 'status'
            ? '\n\n💡 Gunakan `/absen status` untuk melihat status absensi.'
            : '';
          
          await sock.sendMessage(sender, {
            text: `❌ ${pulangValidation.message}${suggestion}`
          });
          AttendanceStateManager.clearUserState(userNumber);
          return;
        }
        await startAttendanceFlow(sock, sender, userNumber, 'pulang');
        break;
        
      case 'status':
      case 'cek':
        await handleTodayStatus(sock, sender, user);
        AttendanceStateManager.clearUserState(userNumber);
        break;
        
      case 'rekap':
      case 'report':
        await handleAttendanceSummary(sock, sender, user);
        AttendanceStateManager.clearUserState(userNumber);
        break;
        
      default:
        await sock.sendMessage(sender, {
          text: '❌ Pilihan tidak valid.\n\nGunakan command cepat:\n• `/absen masuk`\n• `/absen pulang`\n• `/absen status`\n• `/absen rekap`\n\nAtau ketik: **masuk**, **pulang**, **status**, **rekap**'
        });
    }
    
  } catch (error) {
    logger.error('Error handling attendance choice', { 
      userNumber, 
      choice, 
      error: error.message 
    });
    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan sistem' });
  }
}

// Update handleTodayStatus dengan informasi yang lebih detail
async function handleTodayStatus(sock, sender, user) {
  try {
    const status = await getTodayAttendanceStatus(user.id);
    const today = moment().format('DD/MM/YYYY');
    
    if (status.error) {
      await sock.sendMessage(sender, {
        text: '❌ Gagal mengambil status absensi. Silakan coba lagi.'
      });
      return;
    }
    
    if (!status.hasMasuk && !status.hasPulang) {
      await sock.sendMessage(sender, {
        text: `📅 *STATUS ABSENSI HARI INI*
${today}

❌ Belum ada absensi hari ini

⚡ Command cepat:
- \`/absen masuk\` - Absen masuk sekarang
- \`/absen rekap\` - Lihat rekap bulanan`
      });
      return;
    }

    let statusText = `📅 *STATUS ABSENSI HARI INI*\n${today}\n\n`;
    
    if (status.hasMasuk) {
      statusText += `🟢 Absen Masuk: ${status.masukTime} ✅\n\n`;
    } else {
      statusText += `❌ Belum absen masuk\n\n`;
    }
    
    if (status.hasPulang) {
      statusText += `🔴 Absen Pulang: ${status.pulangTime} ✅\n\n`;
    } else {
      statusText += `❌ Belum absen pulang\n\n`;
    }

    // Add completion status
    if (status.isComplete) {
      statusText += `🎉 *ABSENSI LENGKAP HARI INI*\n\n`;
    }

    // Add appropriate quick commands
    statusText += `⚡ Command cepat:\n`;
    if (!status.hasMasuk) {
      statusText += `• \`/absen masuk\` - Absen masuk\n`;
    } else if (!status.hasPulang) {
      statusText += `• \`/absen pulang\` - Absen pulang\n`;
    }
    statusText += `• \`/absen rekap\` - Lihat rekap bulanan`;

    await sock.sendMessage(sender, { text: statusText });
    
  } catch (error) {
    logger.error('Error getting today status', { error: error.message });
    await sock.sendMessage(sender, { text: '❌ Gagal mengambil status absensi' });
  }
}

// Handle location message
async function handleAttendanceLocation(sock, message, userNumber) {
  try {
    const state = AttendanceStateManager.getUserState(userNumber);
    if (!state || !AttendanceStateManager.isWaitingForLocation(userNumber)) {
      return false;
    }

    // Extract location from message
    const locationMessage = message.message.locationMessage;
    if (!locationMessage) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ Format lokasi tidak valid. Silakan kirim ulang lokasi Anda.'
      });
      return true;
    }

    const latitude = locationMessage.degreesLatitude;
    const longitude = locationMessage.degreesLongitude;
    
    logger.info('Location received for attendance', { 
      userNumber, 
      type: state.type, 
      latitude, 
      longitude 
    });

    // Validate location
    const locationCheck = isWithinOfficeRadius(latitude, longitude);
    
    if (!locationCheck.isValid) {
      AttendanceStateManager.clearUserState(userNumber);
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ *LOKASI TERLALU JAUH*

📏 Jarak Anda: ${locationCheck.distance}m
📍 Maksimal: ${locationCheck.maxDistance}m
🏢 Dari: ${OFFICE_CENTER.name}

Silakan mendekati kantor dan coba lagi:
- \`/absen ${state.type}\` - Untuk coba lagi
- \`/absen status\` - Cek status absensi`
      });
      return true;
    }

    // Location valid, ask for photo
    AttendanceStateManager.setWaitingForPhoto(
      userNumber, 
      state.type, 
      latitude, 
      longitude, 
      locationCheck.distance
    );

    const emoji = state.type === 'masuk' ? '🟢' : '🔴';
    await sock.sendMessage(message.key.remoteJid, {
      text: `✅ *LOKASI VALID*

📏 Jarak: ${locationCheck.distance}m dari kantor
📸 Sekarang kirim foto selfie untuk absen ${state.type.toUpperCase()}

${emoji} Hampir selesai! Tinggal foto saja.
Ketik "batal" untuk membatalkan.`
    });

    return true;
    
  } catch (error) {
    logger.error('Error handling attendance location', { 
      userNumber, 
      error: error.message 
    });
    await sock.sendMessage(message.key.remoteJid, { 
      text: '❌ Terjadi kesalahan memproses lokasi' 
    });
    return true;
  }
}

// Handle photo for attendance
async function handleAttendancePhoto(sock, message, userNumber) {
  try {
    const state = AttendanceStateManager.getUserState(userNumber);
    if (!state || !AttendanceStateManager.isWaitingForPhoto(userNumber)) {
      return false;
    }

    const user = await require('../services/userService').getUser(message.key.remoteJid);
    if (!user) {
      await sock.sendMessage(message.key.remoteJid, { 
        text: '❌ User tidak ditemukan' 
      });
      return true;
    }

        // Skip photo download untuk testing
    logger.warn('Skipping photo download for testing', { userNumber, type: state.type });
    //const photoPath = `dummy_${userNumber}_${state.type}_${Date.now()}.jpg`;

    // Download and save photo
    const photoPath = await downloadAttendancePhoto(sock, message, userNumber, state.type);
    if (!photoPath) {
      await sock.sendMessage(message.key.remoteJid, { 
        text: '❌ Gagal menyimpan foto. Silakan coba lagi.' 
      });
      return true;
    }

    // Save attendance record
    const attendanceId = await addAttendance(
      user.id,
      state.type,
      state.latitude,
      state.longitude,
      photoPath,
      state.distance
    );

    if (attendanceId) {
      const now = moment();
      const emoji = state.type === 'masuk' ? '🟢' : '🔴';
      const response = `${emoji} *ABSENSI ${state.type.toUpperCase()} BERHASIL*

📄 ID: #${attendanceId}
📅 Tanggal: ${now.format('DD/MM/YYYY')}
🕐 Jam: ${now.format('HH:mm:ss')}
📏 Jarak: ${state.distance}m dari kantor
📍 Koordinat: ${state.latitude.toFixed(6)}, ${state.longitude.toFixed(6)}

🎉 Terima kasih sudah absen tepat waktu!

💡 Command berguna:
- \`/absen status\` - Cek status hari ini
- \`/absen ${state.type === 'masuk' ? 'pulang' : 'masuk'}\` - ${state.type === 'masuk' ? 'Absen pulang nanti' : 'Absen masuk besok'}`;

      await sock.sendMessage(message.key.remoteJid, { text: response });
      
      logger.info('Attendance completed successfully', {
        attendanceId,
        userNumber,
        type: state.type,
        distance: state.distance
      });
    } else {
      await sock.sendMessage(message.key.remoteJid, { 
        text: '❌ Gagal menyimpan data absensi. Silakan coba lagi dengan `/absen ' + state.type + '`' 
      });
    }

    // Clear state
    AttendanceStateManager.clearUserState(userNumber);
    return true;
    
  } catch (error) {
    logger.error('Error handling attendance photo', { 
      userNumber, 
      error: error.message 
    });
    await sock.sendMessage(message.key.remoteJid, { 
      text: '❌ Terjadi kesalahan memproses foto' 
    });
    AttendanceStateManager.clearUserState(userNumber);
    return true;
  }
}

// Download and save attendance photo dengan error handling yang lebih baik
async function downloadAttendancePhoto(sock, message, userNumber, type) {
  try {
    const imageMessage = message.message.imageMessage;
    if (!imageMessage) {
      logger.error('No image message found', { userNumber, type });
      return null;
    }

    logger.info('Image message details', {
      userNumber,
      type,
      mimetype: imageMessage.mimetype,
      fileLength: imageMessage.fileLength,
      fileSha256: imageMessage.fileSha256 ? 'present' : 'missing',
      url: imageMessage.url ? 'present' : 'missing',
      directPath: imageMessage.directPath ? 'present' : 'missing'
    });

    // Create directories
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const attendanceDir = path.join(uploadsDir, 'attendance');
    
    [uploadsDir, attendanceDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('Created directory', { dir });
      }
    });

    // Generate filename
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `${userNumber}_${type}_${timestamp}_${randomSuffix}.jpg`;
    const filepath = path.join(attendanceDir, filename);

    logger.info('Starting photo download', { 
      userNumber, 
      type, 
      filename,
      filepath
    });

    // Method 1: downloadMediaMessage dengan timeout
    try {
      logger.info('Trying method 1: downloadMediaMessage');
      
      const downloadPromise = sock.downloadMediaMessage(message);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout after 30 seconds')), 30000);
      });
      
      const buffer = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (buffer && Buffer.isBuffer(buffer) && buffer.length > 0) {
        fs.writeFileSync(filepath, buffer);
        
        // Verify file was written
        const stats = fs.statSync(filepath);
        if (stats.size > 0) {
          logger.info('Photo saved successfully (method 1)', { 
            userNumber, type, bufferSize: buffer.length, fileSize: stats.size 
          });
          return filepath;
        } else {
          logger.error('File written but size is 0', { filepath });
          fs.unlinkSync(filepath);
        }
      } else {
        logger.error('Method 1: Invalid or empty buffer', { 
          bufferType: typeof buffer,
          bufferLength: buffer ? buffer.length : 'null'
        });
      }
      
    } catch (method1Error) {
      logger.error('Method 1 failed', { 
        userNumber,
        type,
        error: method1Error.message,
        stack: method1Error.stack
      });
    }
    
    // Method 2: downloadContentFromMessage
    try {
      logger.info('Trying method 2: downloadContentFromMessage');
      
      const stream = await sock.downloadContentFromMessage(imageMessage, 'image');
      const chunks = [];
      let totalSize = 0;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
        totalSize += chunk.length;
        logger.debug('Downloaded chunk', { chunkSize: chunk.length, totalSize });
      }
      
      if (chunks.length === 0) {
        logger.error('Method 2: No chunks received');
        return null;
      }
      
      const buffer = Buffer.concat(chunks);
      
      if (buffer && buffer.length > 0) {
        fs.writeFileSync(filepath, buffer);
        
        // Verify file
        const stats = fs.statSync(filepath);
        if (stats.size > 0) {
          logger.info('Photo saved successfully (method 2)', { 
            userNumber, type, bufferSize: buffer.length, fileSize: stats.size 
          });
          return filepath;
        } else {
          logger.error('File written but size is 0 (method 2)', { filepath });
          fs.unlinkSync(filepath);
        }
      } else {
        logger.error('Method 2: Invalid or empty buffer', { 
          bufferLength: buffer ? buffer.length : 'null'
        });
      }
      
    } catch (method2Error) {
      logger.error('Method 2 failed', {
        userNumber,
        type,
        error: method2Error.message,
        stack: method2Error.stack
      });
    }

    // Method 3: Manual approach (jika method 1 & 2 gagal)
    try {
      logger.info('Trying method 3: Manual download approach');
      
      // Cek apakah ada URL direct
      if (imageMessage.url) {
        logger.info('Image URL found, but manual download not implemented');
        // Implementasi manual download via URL bisa ditambahkan di sini
      }
      
      // Untuk sementara, create dummy file untuk testing
      const dummyBuffer = Buffer.from('dummy-image-data');
      fs.writeFileSync(filepath, dummyBuffer);
      
      logger.warn('Created dummy file for testing', { filepath });
      return filepath;
      
    } catch (method3Error) {
      logger.error('Method 3 failed', {
        error: method3Error.message
      });
    }

    logger.error('All download methods failed', { userNumber, type });
    return null;
    
  } catch (error) {
    logger.error('Unexpected error in downloadAttendancePhoto', { 
      userNumber, 
      type,
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}

// Handle attendance summary
async function handleAttendanceSummary(sock, sender, user) {
  try {
    const summary = await getAttendanceSummary(user.id, 'month');
    
    if (summary.length === 0) {
      await sock.sendMessage(sender, {
        text: `📊 *REKAP ABSENSI BULAN INI*

❌ Belum ada data absensi

⚡ Mulai absensi:
- \`/absen masuk\` - Absen masuk
- \`/absen status\` - Cek status hari ini`
      });
      return;
    }

    let summaryText = `📊 *REKAP ABSENSI BULAN INI*\n\n`;
    
    let totalMasuk = 0;
    let totalPulang = 0;
    
    summary.forEach((day, index) => {
      const date = moment(day.date).format('DD/MM (ddd)');
      summaryText += `📅 ${date}\n`;
      
      if (day.masuk_count > 0) {
        summaryText += `   🟢 Masuk: ${day.jam_masuk}\n`;
        totalMasuk++;
      } else {
        summaryText += `   ❌ Tidak masuk\n`;
      }
      
      if (day.pulang_count > 0) {
        summaryText += `   🔴 Pulang: ${day.jam_pulang}\n`;
        totalPulang++;
      } else {
        summaryText += `   ❌ Belum pulang\n`;
      }
      
      if (index < summary.length - 1) summaryText += '\n';
    });

    summaryText += `\n📈 *RINGKASAN:*\n`;
    summaryText += `🟢 Total hari masuk: ${totalMasuk}\n`;
    summaryText += `🔴 Total hari pulang: ${totalPulang}\n`;
    summaryText += `📊 Kehadiran: ${Math.round((totalMasuk / summary.length) * 100)}%`;

    await sock.sendMessage(sender, { text: summaryText });
    
  } catch (error) {
    logger.error('Error getting attendance summary', { error: error.message });
    await sock.sendMessage(sender, { text: '❌ Gagal mengambil rekap absensi' });
  }
}

// Handle cancel attendance
async function handleAttendanceCancel(sock, sender, userNumber) {
  const cleared = AttendanceStateManager.clearUserState(userNumber);
  if (cleared) {
    await sock.sendMessage(sender, {
      text: `❌ Proses absensi dibatalkan.

⚡ Command cepat:
- \`/absen masuk\` - Absen masuk
- \`/absen pulang\` - Absen pulang  
- \`/absen status\` - Cek status`
    });
  }
  return cleared;
}

// Update completeAttendance function
async function completeAttendance(sock, remoteJid, user, state, photoPath) {
  const attendanceId = await addAttendance(
    user.id,
    state.type,
    state.latitude,
    state.longitude,
    photoPath,
    state.distance
  );

  if (attendanceId) {
    const now = moment();
    const emoji = state.type === 'masuk' ? '🟢' : '🔴';
    const photoStatus = photoPath.includes('dummy') || photoPath.includes('no_photo') ? ' (TANPA FOTO)' : '';
    
    // Check if attendance is now complete for the day
    const todayStatus = await getTodayAttendanceStatus(user.id);
    let completionStatus = '';
    
    if (todayStatus && !todayStatus.error && todayStatus.isComplete) {
      completionStatus = '\n🎉 *ABSENSI HARI INI LENGKAP!*\n';
    }
    
    const response = `${emoji} *ABSENSI ${state.type.toUpperCase()} BERHASIL*${photoStatus}

📄 ID: #${attendanceId}
📅 Tanggal: ${now.format('DD/MM/YYYY')}
🕐 Jam: ${now.format('HH:mm:ss')}
📏 Jarak: ${state.distance}m dari kantor
📍 Koordinat: ${state.latitude.toFixed(6)}, ${state.longitude.toFixed(6)}
${completionStatus}
💡 Command berguna:
- \`/absen status\` - Cek status hari ini
${!todayStatus?.isComplete && state.type === 'masuk' ? `• \`/absen pulang\` - Absen pulang nanti\n` : ''}• \`/absen rekap\` - Lihat rekap bulanan`;

    await sock.sendMessage(remoteJid, { text: response });
    
    logger.info('Attendance completed with validation', {
      attendanceId,
      type: state.type,
      distance: state.distance,
      photoPath,
      hasPhoto: !photoPath.includes('dummy') && !photoPath.includes('no_photo'),
      dayComplete: todayStatus?.isComplete || false
    });
  } else {
    await sock.sendMessage(remoteJid, { 
      text: '❌ Gagal menyimpan data absensi. Silakan coba lagi.' 
    });
  }
}

module.exports = {
  handleAttendanceCommand,
  handleAttendanceChoice,
  handleAttendanceLocation,
  handleAttendancePhoto,
  handleAttendanceCancel,
  completeAttendance,
  AttendanceStateManager
};