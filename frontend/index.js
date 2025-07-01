// api-server.js - Express API Server untuk Financial Bot
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Database connection (menggunakan database yang sama dengan bot)
const dbPath = process.env.DB_PATH || './financial.db';
let db;

function initDatabase() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Database connection error:', err.message);
        } else {
            console.log('✅ Database connected successfully');
        }
    });
}

// Helper function untuk format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Helper function untuk parse transaction dari bot
function parseTransactionText(text) {
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
    
    // Determine type
    let type = 'expense';
    const incomeKeywords = [
        'terima', 'dapat', 'dapet', 'gaji', 'salary', 'bonus', 'thr',
        'masuk', 'income', 'pendapatan', 'pemasukan', 'honor', 'fee'
    ];
    
    for (const keyword of incomeKeywords) {
        if (text.includes(keyword)) {
            type = 'income';
            break;
        }
    }
    
    // Determine category
    let category = 'Lainnya';
    if (type === 'income') {
        if (text.includes('gaji') || text.includes('salary')) category = 'Gaji';
        else if (text.includes('bonus') || text.includes('thr')) category = 'Bonus';
        else category = 'Pemasukan';
    } else {
        if (text.includes('makan') || text.includes('minum')) category = 'Makan';
        else if (text.includes('bensin') || text.includes('transport') || text.includes('ojek')) category = 'Transport';
        else if (text.includes('listrik') || text.includes('tagihan')) category = 'Tagihan';
        else if (text.includes('belanja') || text.includes('beli')) category = 'Belanja';
        else category = 'Pengeluaran';
    }
    
    return { type, amount, category, description: text };
}

// API Routes

// GET /api/dashboard - Dashboard summary
app.get('/api/dashboard', (req, res) => {
    const today = moment().format('YYYY-MM-DD');
    const monthStart = moment().startOf('month').format('YYYY-MM-DD');
    const yearStart = moment().startOf('year').format('YYYY-MM-DD');
    
    const queries = {
        today: `
            SELECT type, SUM(amount) as total, COUNT(*) as count
            FROM transactions 
            WHERE date = ? 
            GROUP BY type
        `,
        month: `
            SELECT type, SUM(amount) as total, COUNT(*) as count
            FROM transactions 
            WHERE date >= ? 
            GROUP BY type
        `,
        year: `
            SELECT type, SUM(amount) as total, COUNT(*) as count
            FROM transactions 
            WHERE date >= ? 
            GROUP BY type
        `
    };
    
    Promise.all([
        new Promise((resolve) => {
            db.all(queries.today, [today], (err, rows) => {
                resolve(err ? [] : rows);
            });
        }),
        new Promise((resolve) => {
            db.all(queries.month, [monthStart], (err, rows) => {
                resolve(err ? [] : rows);
            });
        }),
        new Promise((resolve) => {
            db.all(queries.year, [yearStart], (err, rows) => {
                resolve(err ? [] : rows);
            });
        })
    ]).then(([todayData, monthData, yearData]) => {
        const formatPeriodData = (data) => {
            const income = data.find(d => d.type === 'income')?.total || 0;
            const expense = data.find(d => d.type === 'expense')?.total || 0;
            const transactions = data.reduce((sum, d) => sum + d.count, 0);
            return { income, expense, balance: income - expense, transactions };
        };
        
        res.json({
            success: true,
            data: {
                today: formatPeriodData(todayData),
                month: formatPeriodData(monthData),
                year: formatPeriodData(yearData)
            }
        });
    });
});

// GET /api/transactions - Get transactions with filters
app.get('/api/transactions', (req, res) => {
    const { 
        period = 'month', 
        category, 
        type, 
        limit = 50, 
        offset = 0 
    } = req.query;
    
    let dateFilter = '';
    const today = moment().format('YYYY-MM-DD');
    
    if (period === 'day') {
        dateFilter = `AND date = '${today}'`;
    } else if (period === 'week') {
        const weekStart = moment().startOf('week').format('YYYY-MM-DD');
        dateFilter = `AND date >= '${weekStart}'`;
    } else if (period === 'month') {
        const monthStart = moment().startOf('month').format('YYYY-MM-DD');
        dateFilter = `AND date >= '${monthStart}'`;
    } else if (period === 'year') {
        const yearStart = moment().startOf('year').format('YYYY-MM-DD');
        dateFilter = `AND date >= '${yearStart}'`;
    }
    
    let categoryFilter = category ? `AND category = '${category}'` : '';
    let typeFilter = type ? `AND type = '${type}'` : '';
    
    const query = `
        SELECT t.*, u.name as user_name, u.phone
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE 1=1 ${dateFilter} ${categoryFilter} ${typeFilter}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
    `;
    
    db.all(query, [limit, offset], (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({
                success: true,
                data: rows || [],
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: rows?.length || 0
                }
            });
        }
    });
});

// POST /api/transactions - Add new transaction
app.post('/api/transactions', (req, res) => {
    const { type, amount, category, description, date, user_phone } = req.body;
    
    // Validation
    if (!type || !amount || !category) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: type, amount, category'
        });
    }
    
    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({
            success: false,
            error: 'Type must be income or expense'
        });
    }
    
    // Get or create user (default untuk web interface)
    const defaultPhone = user_phone || 'web@interface.local';
    
    db.get('SELECT * FROM users WHERE phone = ?', [defaultPhone], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        
        const insertTransaction = (userId) => {
            const query = `
                INSERT INTO transactions (user_id, type, amount, category, description, date)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const values = [
                userId,
                type,
                parseFloat(amount),
                category,
                description || `${type} via web interface`,
                date || moment().format('YYYY-MM-DD')
            ];
            
            db.run(query, values, function(err) {
                if (err) {
                    res.status(500).json({ success: false, error: err.message });
                } else {
                    res.json({
                        success: true,
                        data: {
                            id: this.lastID,
                            user_id: userId,
                            type,
                            amount: parseFloat(amount),
                            category,
                            description: description || `${type} via web interface`,
                            date: date || moment().format('YYYY-MM-DD')
                        }
                    });
                }
            });
        };
        
        if (user) {
            insertTransaction(user.id);
        } else {
            // Create new user for web interface
            db.run(
                'INSERT INTO users (phone, name) VALUES (?, ?)',
                [defaultPhone, 'Web Interface'],
                function(err) {
                    if (err) {
                        res.status(500).json({ success: false, error: err.message });
                    } else {
                        insertTransaction(this.lastID);
                    }
                }
            );
        }
    });
});

// DELETE /api/transactions/:id - Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM transactions WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ success: false, error: 'Transaction not found' });
        } else {
            res.json({ success: true, message: 'Transaction deleted successfully' });
        }
    });
});

// GET /api/categories - Get category summary
app.get('/api/categories', (req, res) => {
    const { period = 'month' } = req.query;
    
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
            AVG(amount) as average,
            MIN(amount) as minimum,
            MAX(amount) as maximum
        FROM transactions 
        WHERE 1=1 ${dateFilter}
        GROUP BY category, type 
        ORDER BY total DESC
    `;
    
    db.all(query, (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            res.json({
                success: true,
                data: rows || []
            });
        }
    });
});

// GET /api/charts/daily - Get daily data for charts
app.get('/api/charts/daily', (req, res) => {
    const { period = 'month' } = req.query;
    
    let dateFilter = '';
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
        WHERE 1=1 ${dateFilter}
        GROUP BY date, type 
        ORDER BY date ASC
    `;
    
    db.all(query, (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
        } else {
            // Process data untuk chart
            const dates = [...new Set(rows.map(r => r.date))].sort();
            const chartData = dates.map(date => {
                const dayData = rows.filter(r => r.date === date);
                const income = dayData.find(d => d.type === 'income')?.total || 0;
                const expense = dayData.find(d => d.type === 'expense')?.total || 0;
                
                return {
                    date,
                    income,
                    expense,
                    net: income - expense,
                    formatted_date: moment(date).format('DD/MM')
                };
            });
            
            res.json({
                success: true,
                data: chartData
            });
        }
    });
});

// POST /api/parse-transaction - Parse natural language transaction
app.post('/api/parse-transaction', (req, res) => {
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({
            success: false,
            error: 'Text is required'
        });
    }
    
    const parsed = parseTransactionText(text);
    
    if (parsed) {
        res.json({
            success: true,
            data: parsed
        });
    } else {
        res.json({
            success: false,
            error: 'Could not parse transaction from text'
        });
    }
});

// GET /api/stats - Bot statistics
app.get('/api/stats', (req, res) => {
    const queries = {
        totalTransactions: 'SELECT COUNT(*) as count FROM transactions',
        totalUsers: 'SELECT COUNT(*) as count FROM users',
        totalIncome: 'SELECT SUM(amount) as total FROM transactions WHERE type = "income"',
        totalExpense: 'SELECT SUM(amount) as total FROM transactions WHERE type = "expense"',
        dailyTransactions: `
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE date = ?
        `,
        monthlyTransactions: `
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE date >= ?
        `
    };
    
    const today = moment().format('YYYY-MM-DD');
    const monthStart = moment().startOf('month').format('YYYY-MM-DD');
    
    Promise.all([
        new Promise((resolve) => {
            db.get(queries.totalTransactions, (err, row) => {
                resolve(err ? { count: 0 } : row);
            });
        }),
        new Promise((resolve) => {
            db.get(queries.totalUsers, (err, row) => {
                resolve(err ? { count: 0 } : row);
            });
        }),
        new Promise((resolve) => {
            db.get(queries.totalIncome, (err, row) => {
                resolve(err ? { total: 0 } : row);
            });
        }),
        new Promise((resolve) => {
            db.get(queries.totalExpense, (err, row) => {
                resolve(err ? { total: 0 } : row);
            });
        }),
        new Promise((resolve) => {
            db.get(queries.dailyTransactions, [today], (err, row) => {
                resolve(err ? { count: 0 } : row);
            });
        }),
        new Promise((resolve) => {
            db.get(queries.monthlyTransactions, [monthStart], (err, row) => {
                resolve(err ? { count: 0 } : row);
            });
        })
    ]).then(([totalTx, totalUsers, totalIncome, totalExpense, dailyTx, monthlyTx]) => {
        res.json({
            success: true,
            data: {
                total_transactions: totalTx.count,
                total_users: totalUsers.count,
                total_income: totalIncome.total || 0,
                total_expense: totalExpense.total || 0,
                daily_transactions: dailyTx.count,
                monthly_transactions: monthlyTx.count,
                net_balance: (totalIncome.total || 0) - (totalExpense.total || 0),
                last_updated: moment().format('YYYY-MM-DD HH:mm:ss')
            }
        });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Initialize and start server
function startServer() {
    initDatabase();
    
    app.listen(PORT, () => {
        console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
        console.log(`📊 Dashboard: http://localhost:${PORT}`);
        console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
        console.log(`📱 Connected to database: ${dbPath}`);
        console.log(`⚡ CORS enabled for frontend integration\n`);
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down API server...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('✅ Database connection closed');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

// Start the server
startServer();

module.exports = app;