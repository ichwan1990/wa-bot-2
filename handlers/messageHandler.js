const fs = require('fs');
const path = require('path');
const { logger, adminNumbers } = require('../config');
const { isGroupChat, isBroadcast, isPrivateChat } = require('../utils/chatUtils');
const { messageStats, getStatsText } = require('../utils/messageStats');
const { formatCurrency } = require('../utils/formatter');
const { OCRStateManager } = require('../utils/ocrStateManager');
const { handleOCRCommand, handleOCRImage, handleOCRConfirmation } = require('./ocrHandler');
const { 
  handleAttendanceCommand,
  handleAttendanceChoice,
  handleAttendanceLocation,
  handleAttendancePhoto,
  handleAttendanceCancel,
  AttendanceStateManager
} = require('./attendanceHandler');
const { 
  isWhitelisted, 
  getUser, 
  addToWhitelist, 
  removeFromWhitelist,
  getWhitelist 
} = require('../services/userService');
const { 
  parseTransaction, 
  addTransaction,
  getTransactions,
  getTransactionsByCategory,
  getCategorySummary,
  deleteTransaction
} = require('../services/transactionService');
const {
  generateReport,
  generateCategoryReport,
  generateCategorySummaryReport,
  generateQuickMenu,
  getHelpText
} = require('../services/reportService');
const {
  generateQuickChart,
  generateTextChart
} = require('../services/chartService');

// Send image with proper media handling  
async function sendImageMessage(sock, jid, imagePath, caption) {
  try {
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Send image message
    await sock.sendMessage(jid, {
      image: imageBuffer,
      caption: caption
    });
    
    logger.info('Image sent successfully', { 
      to: jid.split('@')[0], 
      imagePath: path.basename(imagePath),
      size: imageBuffer.length 
    });
    
    return true;
  } catch (error) {
    logger.error('Error sending image', { 
      to: jid.split('@')[0], 
      imagePath, 
      error: error.message 
    });
    return false;
  }
}

// Handle quick number commands
async function handleQuickNumber(sock, sender, user, quickNumber) {
  switch (quickNumber) {
    case 1: // /saldo
      const dayTransactions = await getTransactions(user.id, 'day');
      const dayReport = generateReport(dayTransactions, 'HARI INI');
      await sock.sendMessage(sender, { text: dayReport });
      break;
      
    case 2: // /bulan
      const monthTransactions = await getTransactions(user.id, 'month');
      const monthReport = generateReport(monthTransactions, 'BULAN INI');
      await sock.sendMessage(sender, { text: monthReport });
      break;
      
    case 3: // /kategori
      const categorySummary = await getCategorySummary(user.id, 'month');
      const summaryReport = generateCategorySummaryReport(categorySummary, 'BULAN INI');
      await sock.sendMessage(sender, { text: summaryReport });
      break;
      
    case 4: // /chart - line chart
      await sock.sendMessage(sender, { text: '📊 Membuat grafik trend... Mohon tunggu sebentar' });
      
      // Try QuickChart API first
      let chartPath = await generateQuickChart(user.id, 'line', 'month');
      
      if (chartPath) {
        messageStats.chartsGenerated++;
        const monthTransactions = await getTransactions(user.id, 'month');
        const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        const caption = `📈 *Grafik Trend Keuangan Bulanan*\n\n💰 Total Pemasukan: ${formatCurrency(income)}\n💸 Total Pengeluaran: ${formatCurrency(expense)}\n📊 Net: ${formatCurrency(income - expense)}`;
        
        const sent = await sendImageMessage(sock, sender, chartPath, caption);
        if (!sent) {
          // Fallback to text chart
          const textChart = await generateTextChart(user.id, 'line', 'month');
          await sock.sendMessage(sender, { text: textChart });
        }
      } else {
        // Fallback to text chart
        const textChart = await generateTextChart(user.id, 'line', 'month');
        await sock.sendMessage(sender, { text: textChart });
      }
      break;
      
    case 5: // /pie - pie chart
      await sock.sendMessage(sender, { text: '🥧 Membuat pie chart... Mohon tunggu sebentar' });
      
      let pieChartPath = await generateQuickChart(user.id, 'pie', 'month');
      
      if (pieChartPath) {
        messageStats.chartsGenerated++;
        const categorySummary = await getCategorySummary(user.id, 'month');
        const expenseData = categorySummary.filter(s => s.type === 'expense');
        const total = expenseData.reduce((sum, s) => sum + s.total, 0);
        
        const caption = `🥧 *Breakdown Pengeluaran Bulanan*\n\n💸 Total: ${formatCurrency(total)}\n📊 Kategori: ${expenseData.length}`;
        
        const sent = await sendImageMessage(sock, sender, pieChartPath, caption);
        if (!sent) {
          const textChart = await generateTextChart(user.id, 'pie', 'month');
          await sock.sendMessage(sender, { text: textChart });
        }
      } else {
        const textChart = await generateTextChart(user.id, 'pie', 'month');
        await sock.sendMessage(sender, { text: textChart });
      }
      break;
      
    case 6: // /compare - bar chart
      await sock.sendMessage(sender, { text: '📊 Membuat grafik perbandingan... Mohon tunggu sebentar' });
      
      let barChartPath = await generateQuickChart(user.id, 'bar', 'month');
      
      if (barChartPath) {
        messageStats.chartsGenerated++;
        const currentMonth = await getTransactions(user.id, 'month');
        const currentIncome = currentMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const currentExpense = currentMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        const caption = `📊 *Perbandingan 3 Bulan Terakhir*\n\n📅 Bulan Ini:\n💰 Pemasukan: ${formatCurrency(currentIncome)}\n💸 Pengeluaran: ${formatCurrency(currentExpense)}`;
        
        const sent = await sendImageMessage(sock, sender, barChartPath, caption);
        if (!sent) {
          const textChart = await generateTextChart(user.id, 'bar', 'month');
          await sock.sendMessage(sender, { text: textChart });
        }
      } else {
        const textChart = await generateTextChart(user.id, 'bar', 'month');
        await sock.sendMessage(sender, { text: textChart });
      }
      break;
      
    case 7: // m [jumlah] - makan
      await sock.sendMessage(sender, { 
        text: '🍽️ *INPUT MAKAN*\n\nFormat: m [jumlah]\nContoh: m 25000 atau m 25rb\n\nKetik sekarang:' 
      });
      break;
      
    case 8: // t [jumlah] - transport
      await sock.sendMessage(sender, { 
        text: '🚗 *INPUT TRANSPORT*\n\nFormat: t [jumlah]\nContoh: t 15000 atau t 15rb\n\nKetik sekarang:' 
      });
      break;
      
    case 9: // g [jumlah] - gaji
      await sock.sendMessage(sender, { 
        text: '💰 *INPUT GAJI*\n\nFormat: g [jumlah]\nContoh: g 5jt atau g 5000000\n\nKetik sekarang:' 
      });
      break;
      
    case 0: // /hapus
      await sock.sendMessage(sender, { 
        text: '🗑️ *HAPUS TRANSAKSI*\n\nFormat: /hapus [ID]\nContoh: /hapus 123\n\nCek ID transaksi di laporan (/saldo atau /bulan)' 
      });
      break;
  }
  
  logger.debug('Quick command executed', { to: sender.split('@')[0], number: quickNumber });
}

// Handle shortcut commands
async function handleShortcutCommand(sock, sender, user, text) {
  const [shortcut, ...amountParts] = text.toLowerCase().split(' ');
  const amountText = amountParts.join(' ');
  
  let transactionText = '';
  switch (shortcut) {
    case 'm':
      transactionText = `bayar makan ${amountText}`;
      break;
    case 't':
      transactionText = `bayar transport ${amountText}`;
      break;
    case 'g':
      transactionText = `terima gaji ${amountText}`;
      break;
  }
  
  // Process as regular transaction
  const parsed = parseTransaction(transactionText);
  
  if (parsed) {
    messageStats.transactions++;
    const transactionId = await addTransaction(user.id, parsed);
    
    if (transactionId) {
      const sign = parsed.type === 'income' ? '+' : '-';
      
      const response = `✅ *Transaksi Cepat Ditambahkan*

📄 ID: #${transactionId}
💰 ${sign}${formatCurrency(parsed.amount)}
📂 ${parsed.category}
📝 ${parsed.description}

Ketik /saldo untuk cek saldo`;
      
      await sock.sendMessage(sender, { text: response });
      
      logger.info('Quick transaction processed', {
        transactionId,
        userId: user.id,
        shortcut,
        type: parsed.type,
        amount: parsed.amount,
        from: sender.split('@')[0]
      });
    } else {
      await sock.sendMessage(sender, { text: '❌ Gagal menambahkan transaksi' });
    }
  } else {
    await sock.sendMessage(sender, { 
      text: `❌ Format salah untuk ${shortcut.toUpperCase()}\n\nContoh yang benar:\n• ${shortcut} 25000\n• ${shortcut} 50rb\n• ${shortcut} 2jt` 
    });
  }
}

// Handle commands
async function handleCommand(sock, sender, user, command, args) {
  logger.info('Command received', { 
    from: sender.split('@')[0], 
    command, 
    args: args.join(' ') 
  });
  
  switch (command.toLowerCase()) {
    case "help":
      const helpText = getHelpText();
      await sock.sendMessage(sender, { text: helpText });
      logger.debug("Help sent", { to: sender.split("@")[0] });
      break;

    case "menu":
      const menuText = generateQuickMenu();
      await sock.sendMessage(sender, { text: menuText });
      messageStats.quickMenuUsage++;
      logger.debug("Quick menu sent", { to: sender.split("@")[0] });
      break;

    case "absen":
    case "attendance":
      const userNumber = sender.split("@")[0];
      await handleAttendanceCommand(sock, sender, userNumber, args); // Pass args
      break;

    case "ocr":
      await handleOCRCommand(
        sock,
        { key: { remoteJid: sender } },
        sender.split("@")[0]
      );
      break;

    case "chart":
      const period = args[0] || "month";
      await sock.sendMessage(sender, {
        text: "📊 Membuat grafik trend... Mohon tunggu sebentar",
      });

      let lineChartPath = await generateQuickChart(user.id, "line", period);

      if (lineChartPath) {
        messageStats.chartsGenerated++;
        const monthTransactions = await getTransactions(user.id, period);
        const income = monthTransactions
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);
        const expense = monthTransactions
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0);

        const caption = `📈 *Grafik Trend Keuangan*\nPeriode: ${period}\n\n💰 Pemasukan: ${formatCurrency(
          income
        )}\n💸 Pengeluaran: ${formatCurrency(expense)}`;

        const sent = await sendImageMessage(
          sock,
          sender,
          lineChartPath,
          caption
        );
        if (!sent) {
          const textChart = await generateTextChart(user.id, "line", period);
          await sock.sendMessage(sender, { text: textChart });
        }
      } else {
        const textChart = await generateTextChart(user.id, "line", period);
        await sock.sendMessage(sender, { text: textChart });
      }
      break;

    case "pie":
      await sock.sendMessage(sender, {
        text: "🥧 Membuat pie chart pengeluaran... Mohon tunggu sebentar",
      });

      let pieChartPath = await generateQuickChart(user.id, "pie", "month");

      if (pieChartPath) {
        messageStats.chartsGenerated++;
        const categorySummary = await getCategorySummary(user.id, "month");
        const expenseData = categorySummary.filter((s) => s.type === "expense");
        const total = expenseData.reduce((sum, s) => sum + s.total, 0);

        const caption = `🥧 *Breakdown Pengeluaran Bulanan*\n\n💸 Total: ${formatCurrency(
          total
        )}\n📊 Kategori: ${expenseData.length}`;

        const sent = await sendImageMessage(
          sock,
          sender,
          pieChartPath,
          caption
        );
        if (!sent) {
          const textChart = await generateTextChart(user.id, "pie", "month");
          await sock.sendMessage(sender, { text: textChart });
        }
      } else {
        const textChart = await generateTextChart(user.id, "pie", "month");
        await sock.sendMessage(sender, { text: textChart });
      }
      break;

    case "compare":
      await sock.sendMessage(sender, {
        text: "📊 Membuat grafik perbandingan... Mohon tunggu sebentar",
      });

      let barChartPath = await generateQuickChart(user.id, "bar", "month");

      if (barChartPath) {
        messageStats.chartsGenerated++;
        const currentMonth = await getTransactions(user.id, "month");
        const currentIncome = currentMonth
          .filter((t) => t.type === "income")
          .reduce((sum, t) => sum + t.amount, 0);
        const currentExpense = currentMonth
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + t.amount, 0);

        const caption = `📊 *Perbandingan 3 Bulan Terakhir*\n\n📅 Bulan Ini:\n💰 Pemasukan: ${formatCurrency(
          currentIncome
        )}\n💸 Pengeluaran: ${formatCurrency(currentExpense)}`;

        const sent = await sendImageMessage(
          sock,
          sender,
          barChartPath,
          caption
        );
        if (!sent) {
          const textChart = await generateTextChart(user.id, "bar", "month");
          await sock.sendMessage(sender, { text: textChart });
        }
      } else {
        const textChart = await generateTextChart(user.id, "bar", "month");
        await sock.sendMessage(sender, { text: textChart });
      }
      break;

    case "saldo":
    case "hari":
      const dayTransactions = await getTransactions(user.id, "day");
      const dayReport = generateReport(dayTransactions, "HARI INI");
      await sock.sendMessage(sender, { text: dayReport });
      logger.debug("Daily report sent", {
        to: sender.split("@")[0],
        transactionCount: dayTransactions.length,
      });
      break;

    case "bulan":
      const monthTransactions = await getTransactions(user.id, "month");
      const monthReport = generateReport(monthTransactions, "BULAN INI");
      await sock.sendMessage(sender, { text: monthReport });
      logger.debug("Monthly report sent", {
        to: sender.split("@")[0],
        transactionCount: monthTransactions.length,
      });
      break;

    case "kategori":
      if (args.length === 0) {
        // Show category summary
        const categorySummary = await getCategorySummary(user.id, "month");
        const summaryReport = generateCategorySummaryReport(
          categorySummary,
          "BULAN INI"
        );
        await sock.sendMessage(sender, { text: summaryReport });
        logger.debug("Category summary sent", { to: sender.split("@")[0] });
      } else {
        // Show specific category report
        const category = args.join(" ");
        const period = "month"; // default to month
        const categoryTransactions = await getTransactionsByCategory(
          user.id,
          category,
          period
        );
        const categoryReport = generateCategoryReport(
          categoryTransactions,
          category,
          "BULAN INI"
        );
        await sock.sendMessage(sender, { text: categoryReport });
        logger.debug("Category report sent", {
          to: sender.split("@")[0],
          category,
          transactionCount: categoryTransactions.length,
        });
      }
      break;

    case "topkategori":
      const topCategorySummary = await getCategorySummary(user.id, "month");
      const topCategoryReport = generateCategorySummaryReport(
        topCategorySummary,
        "BULAN INI"
      );
      await sock.sendMessage(sender, { text: topCategoryReport });
      logger.debug("Top category report sent", { to: sender.split("@")[0] });
      break;

    case "hapus":
      if (args[0] && !isNaN(args[0])) {
        const deleted = await deleteTransaction(args[0], user.id);
        if (deleted) {
          await sock.sendMessage(sender, {
            text: `✅ Transaksi #${args[0]} dihapus`,
          });
          logger.info("Transaction deleted via command", {
            transactionId: args[0],
            userId: user.id,
            requestedBy: sender.split("@")[0],
          });
        } else {
          await sock.sendMessage(sender, {
            text: "❌ Transaksi tidak ditemukan",
          });
          logger.warn("Delete transaction failed - not found", {
            transactionId: args[0],
            userId: user.id,
          });
        }
      } else {
        await sock.sendMessage(sender, { text: "❌ Format: /hapus [ID]" });
      }
      break;

    case "stats":
      let statsText = getStatsText();
      statsText += `\n🔍 OCR Processed: ${messageStats.ocrProcessed || 0}`;
      statsText += `\n👥 Active OCR Sessions: ${OCRStateManager.getActiveStatesCount()}`;
      statsText += `\n🏢 Active Attendance Sessions: ${AttendanceStateManager.getActiveStatesCount()}`;
      await sock.sendMessage(sender, { text: statsText });
      messageStats.commands++;
      break;

    case "admin":
      // Admin commands
      if (!adminNumbers.includes(sender.split("@")[0])) {
        logger.warn("Unauthorized admin access attempt", {
          from: sender.split("@")[0],
        });
        await sock.sendMessage(sender, { text: "❌ Akses ditolak" });
        return;
      }

      if (args[0] === "add" && args[1]) {
        const phone = args[1] + "@s.whatsapp.net";
        try {
          await addToWhitelist(phone);
          await sock.sendMessage(sender, {
            text: `✅ ${args[1]} ditambah ke whitelist`,
          });
          logger.info("User added to whitelist via admin command", {
            phone: args[1],
            addedBy: sender.split("@")[0],
          });
        } catch (err) {
          await sock.sendMessage(sender, {
            text: "❌ Gagal menambah ke whitelist",
          });
        }
      } else if (args[0] === "remove" && args[1]) {
        const phone = args[1] + "@s.whatsapp.net";
        try {
          const removed = await removeFromWhitelist(phone);
          if (removed) {
            await sock.sendMessage(sender, {
              text: `✅ ${args[1]} dihapus dari whitelist`,
            });
            logger.info("User removed from whitelist via admin command", {
              phone: args[1],
              removedBy: sender.split("@")[0],
            });
          } else {
            await sock.sendMessage(sender, {
              text: "❌ Nomor tidak ditemukan di whitelist",
            });
          }
        } catch (err) {
          await sock.sendMessage(sender, {
            text: "❌ Gagal menghapus dari whitelist",
          });
        }
      } else if (args[0] === "list") {
        try {
          const rows = await getWhitelist();
          const phoneList = rows
            .map((row) => row.phone.replace("@s.whatsapp.net", ""))
            .join("\n");
          const listText = `📋 *Whitelist (${rows.length}):*\n\n${
            phoneList || "Kosong"
          }`;
          await sock.sendMessage(sender, { text: listText });
        } catch (err) {
          await sock.sendMessage(sender, {
            text: "❌ Gagal mengambil whitelist",
          });
        }
      } else if (args[0] === "stats") {
        const statsText = getStatsText();
        await sock.sendMessage(sender, { text: statsText });
      } else {
        await sock.sendMessage(sender, {
          text: "❌ Format: /admin [add|remove|list|stats] [nomor]",
        });
      }
      break;

    default:
      await sock.sendMessage(sender, {
        text: "❌ Command tidak dikenal. Ketik /help atau /menu",
      });
      logger.debug("Unknown command", { command, from: sender.split("@")[0] });
  }
}

// Handle text messages with OCR and Attendance state management
async function handleTextMessage(sock, sender, user, text) {
  const userNumber = sender.split('@')[0];
  
  try {
    // Handle OCR confirmation if user is waiting
    if (OCRStateManager.isWaitingForConfirmation(userNumber)) {
      await handleOCRConfirmation(sock, { key: { remoteJid: sender } }, userNumber, text);
      return;
    }
    
    // Handle attendance cancellation
    if ((text.toLowerCase() === 'batal' || text.toLowerCase() === 'cancel')) {
      // Check OCR mode first
      if (OCRStateManager.isWaitingForImage(userNumber)) {
        OCRStateManager.clearUserState(userNumber);
        await sock.sendMessage(sender, {
          text: '❌ Mode OCR dibatalkan.'
        });
        return;
      }
      
      // Check attendance mode
      if (AttendanceStateManager.isWaitingForLocation(userNumber) || 
          AttendanceStateManager.isWaitingForPhoto(userNumber)) {
        await handleAttendanceCancel(sock, sender, userNumber);
        return;
      }
    }
    
    // Handle attendance menu choices (1-4) when user just started attendance
    if (/^[1-4]$/.test(text.trim()) && 
        !OCRStateManager.isWaitingForConfirmation(userNumber) &&
        !OCRStateManager.isWaitingForImage(userNumber) &&
        !AttendanceStateManager.isWaitingForLocation(userNumber) &&
        !AttendanceStateManager.isWaitingForPhoto(userNumber)) {
      // This could be attendance menu choice, but we need to check if they just used /absen
      // For now, let it fall through to quick numbers
    }
    
    // Handle numbered quick commands (0-9) - but not when in attendance/OCR mode
    if (/^[0-9]$/.test(text.trim()) && 
        !OCRStateManager.isWaitingForConfirmation(userNumber) &&
        !OCRStateManager.isWaitingForImage(userNumber) &&
        !AttendanceStateManager.isWaitingForLocation(userNumber) &&
        !AttendanceStateManager.isWaitingForPhoto(userNumber)) {
      messageStats.commands++;
      const quickNumber = parseInt(text.trim());
      await handleQuickNumber(sock, sender, user, quickNumber);
      return;
    }
    
    // Handle shortcut commands (m, t, g) - but not when in special modes
    if (/^[mtg]\s+/.test(text.toLowerCase()) &&
        !OCRStateManager.isWaitingForConfirmation(userNumber) &&
        !OCRStateManager.isWaitingForImage(userNumber) &&
        !AttendanceStateManager.isWaitingForLocation(userNumber) &&
        !AttendanceStateManager.isWaitingForPhoto(userNumber)) {
      await handleShortcutCommand(sock, sender, user, text);
      return;
    }
    
    if (text.startsWith('/')) {
      // Handle commands
      messageStats.commands++;
      const [command, ...args] = text.slice(1).split(' ');
      await handleCommand(sock, sender, user, command, args);
    } else {
      // Don't process natural language when in special modes
      if (OCRStateManager.isWaitingForImage(userNumber) ||
          AttendanceStateManager.isWaitingForLocation(userNumber) ||
          AttendanceStateManager.isWaitingForPhoto(userNumber)) {
        // User is in special mode, provide guidance
        if (OCRStateManager.isWaitingForImage(userNumber)) {
          await sock.sendMessage(sender, { 
            text: '🔍 Menunggu foto struk untuk di-scan.\nKirim foto atau ketik "batal" untuk membatalkan.' 
          });
        } else if (AttendanceStateManager.isWaitingForLocation(userNumber)) {
          await sock.sendMessage(sender, { 
            text: '📍 Menunggu lokasi untuk absensi.\nKirim lokasi atau ketik "batal" untuk membatalkan.' 
          });
        } else if (AttendanceStateManager.isWaitingForPhoto(userNumber)) {
          await sock.sendMessage(sender, { 
            text: '📸 Menunggu foto selfie untuk absensi.\nKirim foto atau ketik "batal" untuk membatalkan.' 
          });
        }
        return;
      }
      
      // Parse natural language transaction
      const parsed = parseTransaction(text);
      
      if (parsed) {
        const transactionId = await addTransaction(user.id, parsed);
        
        if (transactionId) {
          messageStats.transactions++;
          const sign = parsed.type === 'income' ? '+' : '-';
          
          const response = `✅ *Transaksi Ditambahkan*

📄 ID: #${transactionId}
💰 ${sign}${formatCurrency(parsed.amount)}
📂 ${parsed.category}
📝 ${parsed.description}

Ketik /saldo untuk cek saldo atau /chart untuk lihat grafik`;
          
          await sock.sendMessage(sender, { text: response });
          
          logger.info('Transaction processed successfully', {
            transactionId,
            userId: user.id,
            type: parsed.type,
            amount: parsed.amount,
            category: parsed.category,
            from: sender.split('@')[0]
          });
        } else {
          await sock.sendMessage(sender, { text: '❌ Gagal menambahkan transaksi' });
        }
      } else {
        await sock.sendMessage(sender, { 
          text: '❓ Tidak dapat memahami pesan\n\nContoh:\n• bayar makan 25000\n• terima gaji 5jt\n• m 25000 (makan cepat)\n• t 15000 (transport cepat)\n• /ocr (untuk scan foto)\n• /absen (untuk absensi)\n\nKetik /menu untuk pilihan cepat atau /chart untuk grafik' 
        });
        
        logger.debug('Message parsing failed', { 
          from: sender.split('@')[0], 
          text: text.substring(0, 100) 
        });
      }
    }
  } catch (error) {
    logger.error('Error handling text message', { 
      from: sender.split('@')[0], 
      error: error.message,
      stack: error.stack
    });
    
    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan sistem' });
  }
}

// Main message handler
async function handleMessage(sock, m) {
  const message = m.messages[0];
  if (!message?.message || message.key.fromMe) return;
  
  const sender = message.key.remoteJid;
  const userNumber = sender.split('@')[0];
  
  // Increment total message counter
  messageStats.total++;
  
  // Ignore group messages completely
  if (isGroupChat(sender)) {
    messageStats.ignored.groups++;
    logger.debug('Group message ignored', { 
      groupId: sender.split('@')[0],
      totalGroupsIgnored: messageStats.ignored.groups
    });
    return;
  }
  
  // Ignore broadcast messages  
  if (isBroadcast(sender)) {
    messageStats.ignored.broadcasts++;
    logger.debug('Broadcast message ignored', {
      totalBroadcastsIgnored: messageStats.ignored.broadcasts
    });
    return;
  }
  
  // Only process private chats
  if (!isPrivateChat(sender)) {
    messageStats.ignored.nonPrivate++;
    logger.debug('Non-private chat ignored', { 
      chatType: sender.split('@')[1],
      from: sender.split('@')[0],
      totalNonPrivateIgnored: messageStats.ignored.nonPrivate
    });
    return;
  }
  
  // Check whitelist - silently ignore if not whitelisted
  if (!await isWhitelisted(sender)) {
    messageStats.ignored.unauthorized++;
    logger.warn('Message from non-whitelisted number silently ignored', { 
      from: sender.split('@')[0],
      totalUnauthorizedIgnored: messageStats.ignored.unauthorized
    });
    
    // Silently ignore - no response sent
    return;
  }
  
  // Increment processed counter
  messageStats.processed++;
  
  const user = await getUser(sender);
  if (!user) {
    logger.error('Failed to get/create user', { sender });
    return; // Don't send error message, just ignore
  }
  
  try {
    // Handle different message types
    if (message.message.conversation || message.message.extendedTextMessage) {
      const text = message.message.conversation || message.message.extendedTextMessage.text;
      
      logger.info('Private text message received', { 
        from: userNumber, 
        textLength: text.length,
        textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
      });
      
      await handleTextMessage(sock, sender, user, text);
      
    } else if (message.message.imageMessage) {
      // Handle image message
      if (OCRStateManager.isWaitingForImage(userNumber)) {
        // User is in OCR mode, process the image
        await handleOCRImage(sock, message, userNumber);
      } else if (AttendanceStateManager.isWaitingForPhoto(userNumber)) {
        // User is in attendance mode, process the photo
        await handleAttendancePhoto(sock, message, userNumber);
      } else {
        // User sent image without OCR or attendance mode
        await sock.sendMessage(sender, {
          text: '📸 **Foto diterima!**\n\n' +
                '🔍 Untuk memproses dengan OCR, ketik **/ocr** terlebih dahulu\n' +
                '🏢 Untuk absensi, ketik **/absen** terlebih dahulu\n\n' +
                '💡 Atau gunakan /menu untuk fitur lainnya.'
        });
      }
      
    } else if (message.message.locationMessage) {
      // Handle location message
      if (AttendanceStateManager.isWaitingForLocation(userNumber)) {
        await handleAttendanceLocation(sock, message, userNumber);
      } else {
        await sock.sendMessage(sender, {
          text: '📍 **Lokasi diterima!**\n\n' +
                '🏢 Untuk absensi, ketik **/absen** terlebih dahulu\n\n' +
                '💡 Atau gunakan /menu untuk fitur lainnya.'
        });
      }
      
    } else {
      // Other message types
      logger.debug('Unsupported message type', { 
        userNumber,
        messageType: Object.keys(message.message)[0]
      });
    }
    
  } catch (error) {
    logger.error('Error handling message', { 
      from: sender.split('@')[0], 
      error: error.message,
      stack: error.stack
    });
    
    // Only send error message to whitelisted users
    await sock.sendMessage(sender, { text: '❌ Terjadi kesalahan sistem' });
  }
}

module.exports = {
  handleMessage
};