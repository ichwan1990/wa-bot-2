// server.js - Express backend server for Financial Bot Frontend
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '../financial.db';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files (your HTML frontend)

// Initialize database connection
let db;

function initDatabase() {
    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Database connection error:', err.message);
        } else {
            console.log('Connected to SQLite database');
        }
    });
}

// Utility function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// API Routes

// Get transactions with filtering
app.get('/api/transactions', (req, res) => {
    const { period = 'month', category = '', userId = 1 } = req.query;
    
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
    
    let categoryFilter = '';
    if (category) {
        categoryFilter = `AND category = ?`;
    }
    
    const query = `
        SELECT * FROM transactions 
        WHERE user_id = ? ${dateFilter} ${categoryFilter}
        ORDER BY created_at DESC
    `;
    
    const params = category ? [userId, category] : [userId];
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching transactions:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows || []);
        }
    });
});

// Get summary statistics
app.get('/api/summary', (req, res) => {
    const { period = 'month', userId = 1 } = req.query;
    
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
            type,
            SUM(amount) as total,
            COUNT(*) as count
        FROM transactions 
        WHERE user_id = ? ${dateFilter}
        GROUP BY type
    `;
    
    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching summary:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            const summary = {
                income: 0,
                expense: 0,
                incomeCount: 0,
                expenseCount: 0
            };
            
            rows.forEach(row => {
                if (row.type === 'income') {
                    summary.income = row.total;
                    summary.incomeCount = row.count;
                } else if (row.type === 'expense') {
                    summary.expense = row.total;
                    summary.expenseCount = row.count;
                }
            });
            
            summary.balance = summary.income - summary.expense;
            summary.totalTransactions = summary.incomeCount + summary.expenseCount;
            
            res.json(summary);
        }
    });
});

// Get category breakdown
app.get('/api/categories', (req, res) => {
    const { period = 'month', userId = 1 } = req.query;
    
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
        WHERE user_id = ? ${dateFilter}
        GROUP BY category, type 
        ORDER BY total DESC
    `;
    
    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching categories:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows || []);
        }
    });
});

// Get daily data for charts
app.get('/api/daily-data', (req, res) => {
    const { period = 'month', userId = 1 } = req.query;
    
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
        WHERE user_id = ? ${dateFilter}
        GROUP BY date, type 
        ORDER BY date ASC
    `;
    
    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching daily data:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows || []);
        }
    });
});

// Add new transaction
app.post('/api/transactions', (req, res) => {
    const { type, amount, category, description, userId = 1 } = req.body;
    
    // Validation
    if (!type || !amount || !category || !description) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: 'Invalid transaction type' });
    }
    
    const query = `
        INSERT INTO transactions (user_id, type, amount, category, description, date) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const values = [userId, type, amount, category, description, moment().format('YYYY-MM-DD')];
    
    db.run(query, values, function(err) {
        if (err) {
            console.error('Error adding transaction:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            const transactionId = this.lastID;
            
            // Return the created transaction
            db.get('SELECT * FROM transactions WHERE id = ?', [transactionId], (err, row) => {
                if (err) {
                    console.error('Error fetching created transaction:', err.message);
                    res.status(500).json({ error: 'Database error' });
                } else {
                    console.log(`Transaction created: ID ${transactionId}, ${type}, ${formatCurrency(amount)}`);
                    res.status(201).json(row);
                }
            });
        }
    });
});

// Update transaction
app.put('/api/transactions/:id', (req, res) => {
    const { id } = req.params;
    const { type, amount, category, description, userId = 1 } = req.body;
    
    // Validation
    if (!type || !amount || !category || !description) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    
    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: 'Invalid transaction type' });
    }
    
    const query = `
        UPDATE transactions 
        SET type = ?, amount = ?, category = ?, description = ?
        WHERE id = ? AND user_id = ?
    `;
    
    const values = [type, amount, category, description, id, userId];
    
    db.run(query, values, function(err) {
        if (err) {
            console.error('Error updating transaction:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Transaction not found' });
        } else {
            // Return the updated transaction
            db.get('SELECT * FROM transactions WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('Error fetching updated transaction:', err.message);
                    res.status(500).json({ error: 'Database error' });
                } else {
                    console.log(`Transaction updated: ID ${id}`);
                    res.json(row);
                }
            });
        }
    });
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
    const { id } = req.params;
    const { userId = 1 } = req.query;
    
    db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId], function(err) {
        if (err) {
            console.error('Error deleting transaction:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Transaction not found' });
        } else {
            console.log(`Transaction deleted: ID ${id}`);
            res.json({ message: 'Transaction deleted successfully' });
        }
    });
});

// Get all users (for admin purposes)
app.get('/api/users', (req, res) => {
    const query = 'SELECT id, phone, name, created_at FROM users ORDER BY created_at DESC';
    
    db.all(query, (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows || []);
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// Serve the frontend HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
initDatabase();

app.listen(PORT, () => {
    console.log(`🚀 Financial Bot Web Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    console.log(`🔌 API endpoints available at http://localhost:${PORT}/api/*`);
    console.log(`💾 Using database: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

module.exports = app;