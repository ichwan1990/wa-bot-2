const moment = require('moment');
const { logger, fileLogger } = require('../config');
const { getDB } = require('../database');

// Parse transaction from message
function parseTransaction(text) {
  text = text.toLowerCase().trim();
  
  // Extract amount (support for juta, ribu, ratus, puluh, currency symbols, and "k" for ribu)
  let amount = 0;
  let match = null;

  // Remove currency symbols for easier parsing
  text = text.replace(/rp\.?|idr|rupiah/gi, '').replace(/\s+/g, ' ');

  // Support for "1,5 juta", "1.5 juta", "1 juta 500 ribu", etc.
  if ((match = text.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta)/))) {
    // e.g. "1,5 juta"
    amount = parseFloat(match[1].replace(',', '.')) * 1000000;
    // Check for additional "ribu" after "juta"
    if ((match = text.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu)/))) {
      amount += parseFloat(match[1].replace(',', '.')) * 1000;
    }
  } else if ((match = text.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu)/))) {
    // e.g. "500 ribu"
    amount = parseFloat(match[1].replace(',', '.')) * 1000;
  } else if ((match = text.match(/(\d+(?:[.,]\d+)?)\s*(rts|ratus)/))) {
    // e.g. "3 ratus"
    amount = parseFloat(match[1].replace(',', '.')) * 100;
  } else if ((match = text.match(/(\d+(?:[.,]\d+)?)\s*(plh|puluh)/))) {
    // e.g. "5 puluh"
    amount = parseFloat(match[1].replace(',', '.')) * 10;
  } else if ((match = text.match(/(\d+(?:[.,]\d+)?)[ ]?k\b/))) {
    // e.g. "5k" or "5 k" (means 5000)
    amount = parseFloat(match[1].replace(',', '.')) * 1000;
  } else if ((match = text.match(/(\d+(?:[.,]\d+)?)k\b/))) {
    // e.g. "17,5k" or "17.5k" (means 17500)
    amount = parseFloat(match[1].replace(',', '.')) * 1000;
  } else if ((match = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)/))) {
    // e.g. "1.500.000" or "1500000"
    amount = parseInt(match[1].replace(/[.,]/g, ''));
  }

  // If still 0, try to find any number in the text
  if (amount === 0) {
    match = text.match(/(\d+(?:[.,]\d+)?)/);
    if (match) {
      amount = parseFloat(match[1].replace(',', '.'));
    }
  }

  // If still 0, return null (invalid)
  if (!amount || isNaN(amount) || amount === 0) return null;
  
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
  
  // Optimized category detection using keyword-category mapping
  const incomeCategories = [
    { keywords: ['gaji', 'salary', 'JM'], category: 'Gaji' },
    { keywords: ['bonus', 'thr'], category: 'Bonus' },
    { keywords: ['freelance', 'project'], category: 'Freelance' },
    { keywords: ['komisi', 'fee'], category: 'Komisi' }
  ];
  const expenseCategories = [
    { keywords: ['makan', 'minum', 'restoran', 'sarapan'], category: 'Makan' },
    { keywords: ['bensin', 'transport', 'ojek', 'grab', 'pertamax', 'pertalite'], category: 'Transport' },
    { keywords: ['listrik', 'tagihan', 'wifi', 'pulsa'], category: 'Tagihan' },
    { keywords: ['belanja', 'beli', 'shopping'], category: 'Belanja' },
    { keywords: ['hutang', 'cicilan', 'angsuran'], category: 'Hutang' },
    { keywords: ['hiburan', 'nonton', 'liburan', 'kopi', 'jajan'], category: 'Hiburan' },
    { keywords: ['kesehatan', 'obat', 'dokter'], category: 'Kesehatan' },
    { keywords: ['donasi', 'amal', 'sumbangan'], category: 'Donasi' },
    { keywords: ['asuransi', 'premi'], category: 'Asuransi' },
    { keywords: ['investasi', 'saham', 'reksa dana'], category: 'Investasi' },
    { keywords: ['perbaikan', 'service', 'repair'], category: 'Perbaikan' },
    { keywords: ['pajak', 'tax'], category: 'Pajak' },
    { keywords: ['kartu kredit', 'cc'], category: 'Kartu Kredit' },
    { keywords: ['sewa', 'rental'], category: 'Sewa' },
    { keywords: ['pendidikan', 'kursus', 'sekolah'], category: 'Pendidikan' },
    { keywords: ['perjalanan', 'travel', 'liburan'], category: 'Perjalanan' },
    { keywords: ['kecantikan', 'perawatan', 'spa'], category: 'Kecantikan' },
    { keywords: ['perabot', 'furniture', 'home decor'], category: 'Perabot' },
    { keywords: ['elektronik', 'gadget', 'handphone'], category: 'Elektronik' },
    { keywords: ['kucing', 'anjing', 'hewan peliharaan'], category: 'Hewan Peliharaan' },
    { keywords: ['kegiatan sosial', 'event','arisan'], category: 'Kegiatan Sosial' },
    { keywords: ['lainnya', 'lain lain'], category: 'Lainnya' }
  ];

  if (type === 'income') {
    let found = false;
    for (const { keywords, category: cat } of incomeCategories) {
      if (keywords.some(k => text.includes(k))) {
        category = cat;
        found = true;
        break;
      }
    }
    if (!found) category = 'Pemasukan';
  } else {
    let found = false;
    for (const { keywords, category: cat } of expenseCategories) {
      if (keywords.some(k => text.includes(k))) {
        category = cat;
        found = true;
        break;
      }
    }
    if (!found) category = 'Pengeluaran';
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
    const db = getDB();
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

// Get transactions by category
function getTransactionsByCategory(userId, category = null, period = 'month') {
  return new Promise((resolve) => {
    const db = getDB();
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

// Get daily data for charts
function getDailyData(userId, period = 'month') {
  return new Promise((resolve) => {
    const db = getDB();
    let dateFilter = '';
    const today = moment().format('YYYY-MM-DD');
    
    if (period === 'week') {
      const weekStart = moment().startOf('week').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${weekStart}'`;
    } else if (period === 'month') {
      const monthStart = moment().startOf('month').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${monthStart}'`;
    } else if (period === 'year') {
      const yearStart = moment().startOf('year').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${yearStart}'`;
    }
    
    const query = `
      SELECT 
        date,
        type,
        SUM(amount) as total
      FROM transactions 
      WHERE user_id = ${userId} ${dateFilter}
      GROUP BY date, type 
      ORDER BY date ASC
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        logger.error('Error getting daily data', { userId, period, error: err.message });
        resolve([]);
      } else {
        logger.debug('Daily data retrieved', { userId, period, rows: rows?.length || 0 });
        resolve(rows || []);
      }
    });
  });
}

// Get category summary
function getCategorySummary(userId, period = 'month') {
  return new Promise((resolve) => {
    const db = getDB();
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

// Get monthly comparison data
function getMonthlyComparisonData(userId) {
  return new Promise(async (resolve) => {
    const db = getDB();
    const monthlyData = [];
    
    for (let i = 2; i >= 0; i--) {
      const startDate = moment().subtract(i, 'months').startOf('month').format('YYYY-MM-DD');
      const endDate = moment().subtract(i, 'months').endOf('month').format('YYYY-MM-DD');
      
      const query = `
        SELECT 
          type,
          SUM(amount) as total
        FROM transactions 
        WHERE user_id = ${userId} AND date >= '${startDate}' AND date <= '${endDate}'
        GROUP BY type
      `;
      
      const result = await new Promise((resolve) => {
        db.all(query, (err, rows) => {
          if (err) {
            logger.error('Error getting monthly data', { error: err.message });
            resolve([]);
          } else {
            resolve(rows || []);
          }
        });
      });
      
      const income = result.find(r => r.type === 'income')?.total || 0;
      const expense = result.find(r => r.type === 'expense')?.total || 0;
      
      monthlyData.push({
        month: moment().subtract(i, 'months').format('MMM YYYY'),
        income,
        expense,
        net: income - expense
      });
    }
    
    resolve(monthlyData);
  });
}

// Delete transaction
function deleteTransaction(id, userId) {
  return new Promise((resolve) => {
    const db = getDB();
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

module.exports = {
  parseTransaction,
  addTransaction,
  getTransactions,
  getTransactionsByCategory,
  getDailyData,
  getCategorySummary,
  getMonthlyComparisonData,
  deleteTransaction
};