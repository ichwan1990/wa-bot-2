const fs = require('fs');
const path = require('path');
const { logger, adminNumbers } = require('../config');
const { isGroupChat, isBroadcast, isPrivateChat } = require('../utils/chatUtils');
const { messageStats, getStatsText } = require('../utils/messageStats');
const { formatCurrency } = require('../utils/formatter');
const { 
  success, 
  error, 
  info, 
  chartCaptions, 
  formatters 
} = require('../utils/messages');
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
  deleteTransaction,
  getUserBalance
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
    case 1: // Catat Pemasukan
      await sock.sendMessage(sender, { text: info.menu });
      break;
      
    case 2: // Catat Pengeluaran  
      await sock.sendMessage(sender, { text: info.menu });
      break;
      
    case 3: // Lihat Saldo
      const balance = await getUserBalance(user.id);
      await sock.sendMessage(sender, { text: success.balanceDisplay(balance) });
      break;
      
    case 4: // Grafik Keuangan
      await sock.sendMessage(sender, { text: info.chartMenu });
      break;
      
    case 5: // Rekap Bulanan
      const monthTransactions = await getTransactions(user.id, 'month');
      const monthReport = generateReport(monthTransactions, 'BULAN INI');
      await sock.sendMessage(sender, { text: monthReport });
      break;
      
    case 6: // Hapus Transaksi
      await sock.sendMessage(sender, { text: MESSAGES.formatErrorDelete });
      break;
      
    case 7: // Panduan Lengkap
      await sock.sendMessage(sender, { text: info.help });
      break;
      
    case 8: // Kembali ke Menu
      await sock.sendMessage(sender, { text: info.menu });
      break;
      
    case 4: // /chart - line chart
      await sock.sendMessage(sender, { text: success.chartGenerating.line });
      
      // Try QuickChart API first
      let chartPath = await generateQuickChart(user.id, 'line', 'month');
      
      if (chartPath) {
        messageStats.chartsGenerated++;
        const monthTransactions = await getTransactions(user.id, 'month');
        const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        const caption = chartCaptions.lineChart(
          formatCurrency(income), 
          formatCurrency(expense), 
          formatCurrency(income - expense)
        );
        
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
      await sock.sendMessage(sender, { text: success.chartGenerating.pie });
      
      let pieChartPath = await generateQuickChart(user.id, 'pie', 'month');
      
      if (pieChartPath) {
        messageStats.chartsGenerated++;
        const categorySummary = await getCategorySummary(user.id, 'month');
        const expenseData = categorySummary.filter(s => s.type === 'expense');
        const total = expenseData.reduce((sum, s) => sum + s.total, 0);
        
        const caption = chartCaptions.pieChart(formatCurrency(total), expenseData.length);
        
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
      await sock.sendMessage(sender, { text: success.chartGenerating.bar });
      
      let barChartPath = await generateQuickChart(user.id, 'bar', 'month');
      
      if (barChartPath) {
        messageStats.chartsGenerated++;
        const currentMonth = await getTransactions(user.id, 'month');
        const currentIncome = currentMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const currentExpense = currentMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        const caption = chartCaptions.barChart(formatCurrency(currentIncome), formatCurrency(currentExpense));
        
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
      
    default:
      await sock.sendMessage(sender, { text: info.menu });
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
      // Get updated balance after transaction
      const balance = await getUserBalance(user.id);
      
      const response = formatters.quickTransactionSuccess(
        transactionId, 
        parsed.type, 
        formatCurrency(parsed.amount), 
        parsed.category, 
        parsed.description,
        parsed.paymentMethod,
        balance
      );
      
      await sock.sendMessage(sender, { text: response });
      
      logger.info('Quick transaction processed', {
        transactionId,
        userId: user.id,
        shortcut,
        type: parsed.type,
        amount: parsed.amount,
        paymentMethod: parsed.paymentMethod,
        newBalance: balance,
        from: sender.split('@')[0]
      });
    } else {
      await sock.sendMessage(sender, { text: error.transactionFailed });
    }
  } else {
    await sock.sendMessage(sender, { text: error.invalidFormat.shortcut(shortcut) });
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

    case "chart":
      const period = args[0] || "month";
      await sock.sendMessage(sender, { text: success.chartGenerating.line });

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

        const caption = chartCaptions.lineChartPeriod(
          period, 
          formatCurrency(income), 
          formatCurrency(expense)
        );

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
      await sock.sendMessage(sender, { text: success.chartGenerating.pie });

      let pieChartPath = await generateQuickChart(user.id, "pie", "month");

      if (pieChartPath) {
        messageStats.chartsGenerated++;
        const categorySummary = await getCategorySummary(user.id, "month");
        const expenseData = categorySummary.filter((s) => s.type === "expense");
        const total = expenseData.reduce((sum, s) => sum + s.total, 0);

        const caption = chartCaptions.pieChart(
          formatCurrency(total), 
          expenseData.length
        );

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
      await sock.sendMessage(sender, { text: success.chartGenerating.bar });

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

        const caption = chartCaptions.barChart(
          formatCurrency(currentIncome), 
          formatCurrency(currentExpense)
        );

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

    case "saldo":
      const currentBalance = await getUserBalance(user.id);
      await sock.sendMessage(sender, { text: success.balanceDisplay(currentBalance) });
      logger.debug("Balance display sent", { 
        to: sender.split("@")[0],
        cash: currentBalance.cash,
        bank: currentBalance.bank,
        total: currentBalance.total
      });
      break;

    case "hapus":
      if (args[0] && !isNaN(args[0])) {
        const result = await deleteTransaction(args[0], user.id);
        if (result.success) {
          // Get updated balance untuk ditampilkan
          const balance = await getUserBalance(user.id);
          const balanceInfo = MESSAGES.formatBalanceInfo(balance.cash, balance.bank, balance.total);
          
          const deleteMessage = success.transactionDeleted(result.transaction);
          const fullMessage = deleteMessage + '\n\n' + balanceInfo;
          
          await sock.sendMessage(sender, {
            text: fullMessage,
          });
          logger.info("Transaction deleted via command", {
            transactionId: args[0],
            userId: user.id,
            requestedBy: sender.split("@")[0],
          });
        } else {
          await sock.sendMessage(sender, {
            text: error.transactionNotFound,
          });
          logger.warn("Delete transaction failed - not found", {
            transactionId: args[0],
            userId: user.id,
            error: result.error,
          });
        }
      } else {
        await sock.sendMessage(sender, { text: error.invalidFormat.delete });
      }
      break;

    case "stats":
      let statsText = getStatsText();
      await sock.sendMessage(sender, { text: statsText });
      messageStats.commands++;
      break;

    case "admin":
      // Admin commands
      if (!adminNumbers.includes(sender.split("@")[0])) {
        logger.warn("Unauthorized admin access attempt", {
          from: sender.split("@")[0],
        });
        await sock.sendMessage(sender, { text: error.accessDenied });
        return;
      }

      if (args[0] === "add" && args[1]) {
        const phone = args[1] + "@s.whatsapp.net";
        try {
          await addToWhitelist(phone);
          await sock.sendMessage(sender, {
            text: success.whitelistAdded(args[1]),
          });
          logger.info("User added to whitelist via admin command", {
            phone: args[1],
            addedBy: sender.split("@")[0],
          });
        } catch (err) {
          await sock.sendMessage(sender, {
            text: error.whitelistAddFailed,
          });
        }
      } else if (args[0] === "remove" && args[1]) {
        const phone = args[1] + "@s.whatsapp.net";
        try {
          const removed = await removeFromWhitelist(phone);
          if (removed) {
            await sock.sendMessage(sender, {
              text: success.whitelistRemoved(args[1]),
            });
            logger.info("User removed from whitelist via admin command", {
              phone: args[1],
              removedBy: sender.split("@")[0],
            });
          } else {
            await sock.sendMessage(sender, {
              text: error.whitelistNotFound,
            });
          }
        } catch (err) {
          await sock.sendMessage(sender, {
            text: error.whitelistRemoveFailed,
          });
        }
      } else if (args[0] === "list") {
        try {
          const rows = await getWhitelist();
          const phoneList = rows
            .map((row) => row.phone.replace("@s.whatsapp.net", ""))
            .join("\n");
          const listText = info.whitelistInfo(rows.length, phoneList);
          await sock.sendMessage(sender, { text: listText });
        } catch (err) {
          await sock.sendMessage(sender, {
            text: error.whitelistGetFailed,
          });
        }
      } else if (args[0] === "stats") {
        const statsText = getStatsText();
        await sock.sendMessage(sender, { text: statsText });
      } else {
        await sock.sendMessage(sender, {
          text: error.invalidFormat.admin,
        });
      }
      break;

    default:
      await sock.sendMessage(sender, {
        //text: "❌ Command tidak dikenal. Ketik /help atau /menu",
      });
      logger.debug("Unknown command", { command, from: sender.split("@")[0] });
  }
}

// Handle text messages
async function handleTextMessage(sock, sender, user, text) {
  const userNumber = sender.split('@')[0];
  
  try {
    // Handle numbered quick commands (0-9)
    if (/^[0-9]$/.test(text.trim())) {
      messageStats.commands++;
      const quickNumber = parseInt(text.trim());
      await handleQuickNumber(sock, sender, user, quickNumber);
      return;
    }
    
    // Handle shortcut commands (m, t, g)
    if (/^[mtg]\s+/.test(text.toLowerCase())) {
      await handleShortcutCommand(sock, sender, user, text);
      return;
    }
    
    if (text.startsWith('/')) {
      // Handle commands
      messageStats.commands++;
      const [command, ...args] = text.slice(1).split(' ');
      await handleCommand(sock, sender, user, command, args);
    } else {
      // Parse natural language transaction
      const parsed = parseTransaction(text);
      
      if (parsed) {
        const transactionId = await addTransaction(user.id, parsed);
        
        if (transactionId) {
          messageStats.transactions++;
          
          // Get updated balance after transaction
          const balance = await getUserBalance(user.id);
          
          const response = formatters.transactionSuccess(
            transactionId, 
            parsed.type, 
            formatCurrency(parsed.amount), 
            parsed.category, 
            parsed.description,
            parsed.paymentMethod,
            balance
          );
          
          await sock.sendMessage(sender, { text: response });
          
          logger.info('Transaction processed successfully', {
            transactionId,
            userId: user.id,
            type: parsed.type,
            amount: parsed.amount,
            category: parsed.category,
            paymentMethod: parsed.paymentMethod,
            newBalance: balance,
            from: sender.split('@')[0]
          });
        } else {
          await sock.sendMessage(sender, { text: error.transactionFailed });
        }
      } else {
        await sock.sendMessage(sender, { text: error.parseMessageFailed });
        
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
    
    await sock.sendMessage(sender, { text: error.systemError });
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
      // Handle image message - just inform user about available features
      await sock.sendMessage(sender, {
        text: success.imageReceived
      });
      
    } else if (message.message.locationMessage) {
      // Handle location message - just inform user about available features
      await sock.sendMessage(sender, {
        text: success.locationReceived
      });
      
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
    await sock.sendMessage(sender, { text: error.systemError });
  }
}

module.exports = {
  handleMessage
};