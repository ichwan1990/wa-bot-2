require('dotenv').config();
const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const fs = require('fs');
const pino = require('pino');

// Setup Pino logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

// Create logs directory
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// File transport for production logs
const fileLogger = pino(pino.destination({
  dest: './logs/app.log',
  sync: false
}));

// Global variables
let sock;
let db;
const adminNumbers = process.env.ADMIN_NUMBERS ? process.env.ADMIN_NUMBERS.split(',') : [];

// Message counters for monitoring
const messageStats = {
  total: 0,
  processed: 0,
  ignored: {
    groups: 0,
    broadcasts: 0,
    unauthorized: 0,
    nonPrivate: 0
  },
  commands: 0,
  transactions: 0
};

// Log stats every hour
setInterval(() => {
  logger.info('Hourly message statistics', messageStats);
}, 60 * 60 * 1000);

// Initialize database
function initDB() {
  const dbPath = process.env.DB_PATH || './financial.db';
  
  logger.info('Initializing database', { path: dbPath });
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error('Database connection error', { error: err.message });
    } else {
      logger.info('Database connected successfully');
    }
  });
  
  // Create tables
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) logger.error('Error creating users table', { error: err.message });
      else logger.debug('Users table ready');
    });

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount REAL,
      category TEXT,
      description TEXT,
      date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) logger.error('Error creating transactions table', { error: err.message });
      else logger.debug('Transactions table ready');
    });

    // Whitelist table
    db.run(`CREATE TABLE IF NOT EXISTS whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) logger.error('Error creating whitelist table', { error: err.message });
      else logger.debug('Whitelist table ready');
    });

    // Add admin numbers to whitelist
    adminNumbers.forEach(phone => {
      const fullPhone = phone + '@s.whatsapp.net';
      db.run('INSERT OR IGNORE INTO whitelist (phone) VALUES (?)', [fullPhone], (err) => {
        if (err) {
          logger.error('Error adding admin to whitelist', { phone, error: err.message });
        } else {
          logger.debug('Admin added to whitelist', { phone });
        }
      });
    });
  });

  logger.info('Database initialization completed');
}

// Helper functions for chat types
function isGroupChat(jid) {
  return jid.endsWith('@g.us');
}

function isBroadcast(jid) {
  return jid === 'status@broadcast';
}

function isPrivateChat(jid) {
  return jid.endsWith('@s.whatsapp.net');
}

// Check if user is whitelisted
function isWhitelisted(phone) {
  return new Promise((resolve) => {
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

// Parse transaction from message
function parseTransaction(text) {
  text = text.toLowerCase().trim();
  
  // Extract amount
  let amount = 0;
  if (text.includes('jt') || text.includes('juta')) {
    const match = text.match(/(\d+(?:[,\.]\d+)?)\s*(?:jt|juta)/);
    if (match) amount = parseFloat(match[1].replace(',', '.')) * 1000000;
  } else if (text.includes('rb') || text.includes('ribu')) {
    const match = text.match(/(\d+(?:[,\.]\d+)?)\s*(?:rb|ribu)/);
    if (match) amount = parseInt(match[1]) * 1000;
  } else {
    const match = text.match(/(\d+(?:[,\.]\d+)*)/);
    if (match) amount = parseInt(match[1].replace(/[,\.]/g, ''));
  }
  
  if (amount === 0) return null;
  
  // Determine type - PEMASUKAN keywords first!
  let type = 'expense'; // default
  
  // Check for INCOME keywords first (more specific)
  const incomeKeywords = [
    'terima', 'dapat', 'dapet', 'gaji', 'salary', 'bonus', 'thr',
    'masuk', 'income', 'pendapatan', 'pemasukan', 'honor', 'fee',
    'freelance', 'komisi', 'untung', 'profit', 'dividen'
  ];
  
  const expenseKeywords = [
    'bayar', 'beli', 'buat', 'untuk', 'hutang', 'cicilan', 'angsuran',
    'keluar', 'spend', 'belanja', 'shopping', 'transfer', 'kirim'
  ];
  
  // Check income first (priority)
  for (const keyword of incomeKeywords) {
    if (text.includes(keyword)) {
      type = 'income';
      break;
    }
  }
  
  // Only check expense if not income
  if (type !== 'income') {
    for (const keyword of expenseKeywords) {
      if (text.includes(keyword)) {
        type = 'expense';
        break;
      }
    }
  }
  
  // Determine category based on type and keywords
  let category = 'Lainnya';
  
  if (type === 'income') {
    // Income categories
    if (text.includes('gaji') || text.includes('salary')) category = 'Gaji';
    else if (text.includes('bonus') || text.includes('thr')) category = 'Bonus';
    else if (text.includes('freelance') || text.includes('project')) category = 'Freelance';
    else if (text.includes('komisi') || text.includes('fee')) category = 'Komisi';
    else category = 'Pemasukan';
  } else {
    // Expense categories
    if (text.includes('makan') || text.includes('minum') || text.includes('restoran')) category = 'Makan';
    else if (text.includes('bensin') || text.includes('transport') || text.includes('ojek') || text.includes('grab')) category = 'Transport';
    else if (text.includes('listrik') || text.includes('tagihan') || text.includes('wifi') || text.includes('pulsa')) category = 'Tagihan';
    else if (text.includes('belanja') || text.includes('beli') || text.includes('shopping')) category = 'Belanja';
    else category = 'Pengeluaran';
  }
  
  return {
    type,
    amount,
    category,
    description: text
  };
}

// Add transaction
function addTransaction(userId, data) {
  return new Promise((resolve) => {
    const query = 'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [userId, data.type, data.amount, data.category, data.description, moment().format('YYYY-MM-DD')];
    
    db.run(query, values, function(err) {
      if (err) {
        logger.error('Error adding transaction', { 
          userId, 
          type: data.type, 
          amount: data.amount,
          error: err.message 
        });
        resolve(null);
      } else {
        const transactionId = this.lastID;
        logger.info('Transaction added', { 
          transactionId, 
          userId, 
          type: data.type, 
          amount: data.amount,
          category: data.category
        });
        
        // Log to file for audit
        fileLogger.info('transaction_created', {
          id: transactionId,
          userId,
          type: data.type,
          amount: data.amount,
          category: data.category,
          description: data.description
        });
        
        resolve(transactionId);
      }
    });
  });
}

// Get transactions (updated)
function getTransactions(userId, period = 'day') {
  return getTransactionsByCategory(userId, null, period);
}

// Generate report (updated)
function generateReport(transactions, period) {
  const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;
  
  let report = `📊 *LAPORAN ${period.toUpperCase()}*\n\n`;
  report += `💰 Pemasukan: ${formatCurrency(income)}\n`;
  report += `💸 Pengeluaran: ${formatCurrency(expense)}\n`;
  report += `📈 Saldo: ${formatCurrency(balance)}\n\n`;
  
  if (transactions.length > 0) {
    report += `📝 *Transaksi (${transactions.length}):*\n`;
    transactions.slice(0, 5).forEach((t, i) => {
      const sign = t.type === 'income' ? '+' : '-';
      const date = moment(t.date).format('DD/MM');
      report += `${i+1}. [${date}] #${t.id} ${sign}${formatCurrency(t.amount)}\n`;
      report += `   📂 ${t.category} - ${t.description.substring(0, 25)}${t.description.length > 25 ? '...' : ''}\n`;
    });
    
    if (transactions.length > 5) {
      report += `\n...dan ${transactions.length - 5} transaksi lainnya`;
    }
  }
  
  return report;
}
function getTransactionsByCategory(userId, category = null, period = 'month') {
  return new Promise((resolve) => {
    let dateFilter = '';
    let categoryFilter = '';
    const today = moment().format('YYYY-MM-DD');
    
    if (period === 'day') {
      dateFilter = `AND date = '${today}'`;
    } else if (period === 'month') {
      const monthStart = moment().startOf('month').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${monthStart}'`;
    } else if (period === 'year') {
      const yearStart = moment().startOf('year').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${yearStart}'`;
    }
    
    if (category) {
      categoryFilter = `AND category = '${category}'`;
    }
    
    const query = `SELECT * FROM transactions WHERE user_id = ${userId} ${dateFilter} ${categoryFilter} ORDER BY created_at DESC`;
    
    db.all(query, (err, rows) => {
      if (err) {
        logger.error('Error getting transactions by category', { userId, category, period, error: err.message });
        resolve([]);
      } else {
        logger.debug('Transactions by category retrieved', { userId, category, period, count: rows?.length || 0 });
        resolve(rows || []);
      }
    });
  });
}

// Get category summary
function getCategorySummary(userId, period = 'month') {
  return new Promise((resolve) => {
    let dateFilter = '';
    const today = moment().format('YYYY-MM-DD');
    
    if (period === 'day') {
      dateFilter = `AND date = '${today}'`;
    } else if (period === 'month') {
      const monthStart = moment().startOf('month').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${monthStart}'`;
    } else if (period === 'year') {
      const yearStart = moment().startOf('year').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${yearStart}'`;
    }
    
    const query = `
      SELECT 
        category,
        type,
        COUNT(*) as count,
        SUM(amount) as total,
        AVG(amount) as average
      FROM transactions 
      WHERE user_id = ${userId} ${dateFilter}
      GROUP BY category, type 
      ORDER BY total DESC
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        logger.error('Error getting category summary', { userId, period, error: err.message });
        resolve([]);
      } else {
        logger.debug('Category summary retrieved', { userId, period, categories: rows?.length || 0 });
        resolve(rows || []);
      }
    });
  });
}

// Delete transaction
function deleteTransaction(id, userId) {
  return new Promise((resolve) => {
    db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        logger.error('Error deleting transaction', { transactionId: id, userId, error: err.message });
        resolve(false);
      } else {
        const deleted = this.changes > 0;
        if (deleted) {
          logger.info('Transaction deleted', { transactionId: id, userId });
          fileLogger.info('transaction_deleted', { id, userId });
        } else {
          logger.warn('Transaction not found for deletion', { transactionId: id, userId });
        }
        resolve(deleted);
      }
    });
  });
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Generate category report
function generateCategoryReport(categoryData, category, period) {
  if (categoryData.length === 0) {
    return `📂 *LAPORAN KATEGORI: ${category}*
📅 Periode: ${period.toUpperCase()}

📝 Tidak ada transaksi untuk kategori ini dalam periode ${period}.`;
  }

  const totalAmount = categoryData.reduce((sum, t) => sum + t.amount, 0);
  const avgAmount = totalAmount / categoryData.length;
  const maxAmount = Math.max(...categoryData.map(t => t.amount));
  const minAmount = Math.min(...categoryData.map(t => t.amount));
  
  const type = categoryData[0].type;
  const typeIcon = type === 'income' ? '💰' : '💸';
  const typeText = type === 'income' ? 'PEMASUKAN' : 'PENGELUARAN';

  let report = `📂 *LAPORAN KATEGORI: ${category}*
📅 Periode: ${period.toUpperCase()}
${typeIcon} Jenis: ${typeText}

📊 *Ringkasan:*
• Total Transaksi: ${categoryData.length}
• Total Amount: ${formatCurrency(totalAmount)}
• Rata-rata: ${formatCurrency(avgAmount)}
• Tertinggi: ${formatCurrency(maxAmount)}
• Terendah: ${formatCurrency(minAmount)}

📝 *Transaksi Terakhir (${Math.min(categoryData.length, 5)}):*`;

  categoryData.slice(0, 5).forEach((t, i) => {
    const date = moment(t.date).format('DD/MM');
    const sign = t.type === 'income' ? '+' : '-';
    report += `\n${i + 1}. [${date}] ${sign}${formatCurrency(t.amount)}`;
    report += `\n   📝 ${t.description.substring(0, 40)}${t.description.length > 40 ? '...' : ''}`;
  });

  if (categoryData.length > 5) {
    report += `\n\n...dan ${categoryData.length - 5} transaksi lainnya`;
  }

  return report;
}

// Generate category summary report
function generateCategorySummaryReport(summaryData, period) {
  if (summaryData.length === 0) {
    return `📊 *RINGKASAN KATEGORI ${period.toUpperCase()}*

📝 Tidak ada transaksi dalam periode ini.`;
  }

  // Separate income and expense
  const incomeData = summaryData.filter(s => s.type === 'income');
  const expenseData = summaryData.filter(s => s.type === 'expense');
  
  const totalIncome = incomeData.reduce((sum, s) => sum + s.total, 0);
  const totalExpense = expenseData.reduce((sum, s) => sum + s.total, 0);

  let report = `📊 *RINGKASAN KATEGORI ${period.toUpperCase()}*

💰 Total Pemasukan: ${formatCurrency(totalIncome)}
💸 Total Pengeluaran: ${formatCurrency(totalExpense)}
📈 Net: ${formatCurrency(totalIncome - totalExpense)}`;

  if (expenseData.length > 0) {
    report += `\n\n💸 *TOP PENGELUARAN:*`;
    expenseData.slice(0, 5).forEach((s, i) => {
      const percentage = totalExpense > 0 ? Math.round((s.total / totalExpense) * 100) : 0;
      report += `\n${i + 1}. ${s.category}: ${formatCurrency(s.total)} (${percentage}%)`;
      report += `\n   📊 ${s.count}x transaksi • Avg: ${formatCurrency(s.average)}`;
    });
  }

  if (incomeData.length > 0) {
    report += `\n\n💰 *SUMBER PEMASUKAN:*`;
    incomeData.slice(0, 3).forEach((s, i) => {
      const percentage = totalIncome > 0 ? Math.round((s.total / totalIncome) * 100) : 0;
      report += `\n${i + 1}. ${s.category}: ${formatCurrency(s.total)} (${percentage}%)`;
      report += `\n   📊 ${s.count}x transaksi • Avg: ${formatCurrency(s.average)}`;
    });
  }

  return report;
}

// Handle messages
async function handleMessage(m) {
  const message = m.messages[0];
  if (!message?.message || message.key.fromMe) return;
  
  const sender = message.key.remoteJid;
  const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
  
  // Increment total message counter
  messageStats.total++;
  
  // Ignore group messages completely
  if (isGroupChat(sender)) {
    messageStats.ignored.groups++;
    logger.debug('Group message ignored', { 
      groupId: sender.split('@')[0],
      messageLength: text.length,
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
  
  // Log incoming message (only from private chats)
  logger.info('Private message received', { 
    from: sender.split('@')[0], 
    textLength: text.length,
    textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
  });
  
  // Check whitelist - silently ignore if not whitelisted
  if (!await isWhitelisted(sender)) {
    messageStats.ignored.unauthorized++;
    logger.warn('Message from non-whitelisted number silently ignored', { 
      from: sender.split('@')[0],
      messageType: text.startsWith('/') ? 'command' : 'text',
      textPreview: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
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
    if (text.startsWith('/')) {
      // Handle commands
      messageStats.commands++;
      const [command, ...args] = text.slice(1).split(' ');
      
      logger.info('Command received', { 
        from: sender.split('@')[0], 
        command, 
        args: args.join(' ') 
      });
      
      switch (command.toLowerCase()) {
        case 'help':
          const helpText = `🤖 *FINANCIAL BOT*

📝 *Input Transaksi:*

💸 *PENGELUARAN:*
bayar makan 25000
beli bensin 50rb
belanja bulanan 500000
bayar tagihan listrik 150rb

💰 *PEMASUKAN:*
terima gaji 5jt
dapat bonus 1000000
freelance project 2,5jt
terima honor 500rb

📊 *Commands Laporan:*
/saldo - Cek saldo hari ini
/hari - Laporan harian
/bulan - Laporan bulanan
/kategori - Ringkasan semua kategori
/kategori [nama] - Laporan kategori spesifik
/topkategori - Top kategori pengeluaran

🔧 *Commands Lainnya:*
/hapus [ID] - Hapus transaksi
/help - Bantuan ini

💡 *Contoh Kategori:*
/kategori Makan
/kategori Transport
/kategori Gaji

💡 *Tips:* 
- Gunakan kata "terima", "dapat", "gaji", "bonus" untuk PEMASUKAN
- Gunakan kata "bayar", "beli", "belanja" untuk PENGELUARAN`;
          
          await sock.sendMessage(sender, { text: helpText });
          logger.debug('Help sent', { to: sender.split('@')[0] });
          break;
          
        case 'saldo':
        case 'hari':
          const dayTransactions = await getTransactions(user.id, 'day');
          const dayReport = generateReport(dayTransactions, 'HARI INI');
          await sock.sendMessage(sender, { text: dayReport });
          logger.debug('Daily report sent', { to: sender.split('@')[0], transactionCount: dayTransactions.length });
          break;
          
        case 'bulan':
          const monthTransactions = await getTransactions(user.id, 'month');
          const monthReport = generateReport(monthTransactions, 'BULAN INI');
          await sock.sendMessage(sender, { text: monthReport });
          logger.debug('Monthly report sent', { to: sender.split('@')[0], transactionCount: monthTransactions.length });
          break;

        case 'kategori':
          if (args.length === 0) {
            // Show category summary
            const categorySummary = await getCategorySummary(user.id, 'month');
            const summaryReport = generateCategorySummaryReport(categorySummary, 'BULAN INI');
            await sock.sendMessage(sender, { text: summaryReport });
            logger.debug('Category summary sent', { to: sender.split('@')[0] });
          } else {
            // Show specific category report
            const category = args.join(' ');
            const period = 'month'; // default to month
            const categoryTransactions = await getTransactionsByCategory(user.id, category, period);
            const categoryReport = generateCategoryReport(categoryTransactions, category, 'BULAN INI');
            await sock.sendMessage(sender, { text: categoryReport });
            logger.debug('Category report sent', { to: sender.split('@')[0], category, transactionCount: categoryTransactions.length });
          }
          break;

        case 'topkategori':
          const topCategorySummary = await getCategorySummary(user.id, 'month');
          const topCategoryReport = generateCategorySummaryReport(topCategorySummary, 'BULAN INI');
          await sock.sendMessage(sender, { text: topCategoryReport });
          logger.debug('Top category report sent', { to: sender.split('@')[0] });
          break;
          
        case 'hapus':
          if (args[0] && !isNaN(args[0])) {
            const deleted = await deleteTransaction(args[0], user.id);
            if (deleted) {
              await sock.sendMessage(sender, { text: `✅ Transaksi #${args[0]} dihapus` });
              logger.info('Transaction deleted via command', { 
                transactionId: args[0], 
                userId: user.id, 
                requestedBy: sender.split('@')[0] 
              });
            } else {
              await sock.sendMessage(sender, { text: '❌ Transaksi tidak ditemukan' });
              logger.warn('Delete transaction failed - not found', { 
                transactionId: args[0], 
                userId: user.id 
              });
            }
          } else {
            await sock.sendMessage(sender, { text: '❌ Format: /hapus [ID]' });
          }
          break;
          
        case 'admin':
          // Admin commands
          if (!adminNumbers.includes(sender.split('@')[0])) {
            logger.warn('Unauthorized admin access attempt', { from: sender.split('@')[0] });
            await sock.sendMessage(sender, { text: '❌ Akses ditolak' });
            return;
          }
          
          if (args[0] === 'add' && args[1]) {
            const phone = args[1] + '@s.whatsapp.net';
            db.run('INSERT OR IGNORE INTO whitelist (phone) VALUES (?)', [phone], (err) => {
              if (err) {
                logger.error('Error adding to whitelist', { phone: args[1], error: err.message });
              } else {
                logger.info('User added to whitelist', { 
                  phone: args[1], 
                  addedBy: sender.split('@')[0] 
                });
              }
            });
            await sock.sendMessage(sender, { text: `✅ ${args[1]} ditambah ke whitelist` });
          } else if (args[0] === 'remove' && args[1]) {
            const phone = args[1] + '@s.whatsapp.net';
            db.run('DELETE FROM whitelist WHERE phone = ?', [phone], function(err) {
              if (err) {
                logger.error('Error removing from whitelist', { phone: args[1], error: err.message });
              } else if (this.changes > 0) {
                logger.info('User removed from whitelist', { 
                  phone: args[1], 
                  removedBy: sender.split('@')[0] 
                });
              }
            });
            await sock.sendMessage(sender, { text: `✅ ${args[1]} dihapus dari whitelist` });
          } else if (args[0] === 'list') {
            db.all('SELECT phone FROM whitelist ORDER BY created_at DESC', (err, rows) => {
              if (err) {
                logger.error('Error getting whitelist', { error: err.message });
                return;
              }
              
              const phoneList = rows.map(row => row.phone.replace('@s.whatsapp.net', '')).join('\n');
              const listText = `📋 *Whitelist (${rows.length}):*\n\n${phoneList || 'Kosong'}`;
              sock.sendMessage(sender, { text: listText });
            });
          } else {
            await sock.sendMessage(sender, { text: '❌ Format: /admin [add|remove|list] [nomor]' });
          }
          break;
          
        default:
          await sock.sendMessage(sender, { text: '❌ Command tidak dikenal. Ketik /help' });
          logger.debug('Unknown command', { command, from: sender.split('@')[0] });
      }
    } else {
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

Ketik /saldo untuk cek saldo`;
          
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
          text: '❓ Tidak dapat memahami pesan\n\nContoh:\n• bayar makan 25000\n• terima gaji 5jt\n\nKetik /help untuk bantuan' 
        });
        
        logger.debug('Message parsing failed', { 
          from: sender.split('@')[0], 
          text: text.substring(0, 100) 
        });
      }
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

// Connect to WhatsApp
async function connectToWhatsApp() {
  try {
    if (!fs.existsSync('./sessions')) {
      fs.mkdirSync('./sessions');
    }
    
    logger.info('Setting up WhatsApp connection');
    
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    
    sock = makeWASocket({
      auth: state,
      browser: ['Financial Bot', 'Chrome', '1.0.0'],
      logger: logger.child({ module: 'baileys' })
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 SCAN QR CODE untuk connect WhatsApp:');
        console.log('   1. Buka WhatsApp di HP');
        console.log('   2. Pilih Menu > WhatsApp Web');
        console.log('   3. Scan QR code di bawah:\n');
        qrcode.generate(qr, { small: true });
        logger.info('QR code generated for WhatsApp connection');
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        const reason = lastDisconnect?.error?.output?.statusCode;
        
        logger.warn('WhatsApp connection closed', { 
          shouldReconnect, 
          reason,
          statusCode: reason 
        });
        
        if (shouldReconnect) {
          logger.info('Attempting to reconnect in 5 seconds');
          console.log('🔄 Koneksi terputus, mencoba reconnect...');
          setTimeout(connectToWhatsApp, 5000);
        } else {
          logger.error('Bot logged out from WhatsApp');
          console.log('❌ Bot logout, silakan restart dan scan QR lagi');
        }
      } else if (connection === 'open') {
        logger.info('WhatsApp connection established successfully');
        console.log('\n🎉 WhatsApp berhasil terhubung!');
        console.log('🤖 Bot siap menerima pesan');
        console.log('👥 Admin numbers:', adminNumbers.join(', '));
        console.log('💬 Kirim "bayar makan 25000" untuk test\n');
        
        // Log to file
        fileLogger.info('whatsapp_connected', { 
          adminNumbers: adminNumbers.length,
          timestamp: new Date().toISOString()
        });
      } else if (connection === 'connecting') {
        logger.info('Connecting to WhatsApp...');
        console.log('🔄 Menghubungkan ke WhatsApp...');
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', handleMessage);
    
  } catch (error) {
    logger.error('WhatsApp connection error', { 
      error: error.message,
      stack: error.stack
    });
    console.error('❌ Connection error:', error.message);
    
    logger.info('Retrying connection in 10 seconds');
    setTimeout(connectToWhatsApp, 10000);
  }
}

// Start the bot
console.log('🚀 Starting Simple Financial Bot...');
logger.info('Financial Bot starting up', { 
  nodeVersion: process.version,
  platform: process.platform,
  adminCount: adminNumbers.length
});

// Initialize database
initDB();

// Connect to WhatsApp
connectToWhatsApp();

// Handle shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  console.log('\n🛑 Shutting down...');
  
  if (db) {
    db.close((err) => {
      if (err) {
        logger.error('Error closing database', { error: err.message });
      } else {
        logger.info('Database connection closed');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', { 
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { 
    reason: reason?.message || reason,
    promise: promise.toString()
  });
});