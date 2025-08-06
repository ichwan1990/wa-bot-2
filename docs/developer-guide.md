# 🛠️ Developer Guide: Cash/Bank Balance Separation

## 📋 Technical Implementation Overview

This document explains the technical implementation of the cash/bank balance separation feature in the WhatsApp Financial Bot.

---

## 🏗️ ARCHITECTURE CHANGES

### 📊 **Database Schema Updates**

#### 1. **Transactions Table Enhancement**
```sql
-- Added column to existing transactions table
ALTER TABLE transactions ADD COLUMN payment_method TEXT DEFAULT 'cash';
```

#### 2. **New User Balances Table**
```sql
CREATE TABLE IF NOT EXISTS user_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    cash_balance REAL DEFAULT 0,
    bank_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
```

### 🔧 **Core Functions Added**

#### **Database Layer** (`database/index.js`)
- `updateUserBalance(userId, amount, paymentMethod)` - Updates specific balance
- `getUserBalance(userId)` - Retrieves cash/bank/total balances
- `initializeUserBalance(userId)` - Creates initial balance record

#### **Transaction Service** (`services/transactionService.js`)
- `detectPaymentMethod(message)` - Auto-detects payment method from keywords
- `getUserBalance(userId)` - Wrapper for balance retrieval
- Enhanced `addTransaction()` with balance updates

---

## 💡 PAYMENT METHOD DETECTION

### 🤖 **Algorithm Logic**
```javascript
const detectPaymentMethod = (message) => {
    const bankKeywords = [
        'transfer', 'tf', 'qris', 'qr',
        'ovo', 'gopay', 'dana', 'shopeepay',
        'bca', 'mandiri', 'bni', 'bri',
        'debit', 'kartu kredit', 'cc',
        'online', 'digital', 'mobile banking'
    ];
    
    const cashKeywords = [
        'tunai', 'cash', 'uang cash',
        'dompet', 'kantong'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    if (bankKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'bank';
    } else if (cashKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'cash';
    }
    
    return 'cash'; // Default to cash
};
```

### 🎯 **Keyword Categories**

#### **Bank/Digital Keywords:**
- **Payment Apps**: `ovo`, `gopay`, `dana`, `shopeepay`
- **Banks**: `bca`, `mandiri`, `bni`, `bri`
- **Methods**: `transfer`, `tf`, `qris`, `qr`, `debit`, `cc`
- **General**: `online`, `digital`, `mobile banking`

#### **Cash Keywords:**
- **Direct**: `tunai`, `cash`, `uang cash`
- **Container**: `dompet`, `kantong`

#### **Default Behavior:**
- If no specific keywords found → **CASH**
- Keywords can appear anywhere in the message
- Case-insensitive matching

---

## 📱 MESSAGE SYSTEM INTEGRATION

### 🎨 **Template Updates** (`utils/messages.js`)

#### **Balance Display Template:**
```javascript
formatBalanceInfo: (cashBalance, bankBalance, totalBalance) => {
    const cash = formatCurrency(cashBalance);
    const bank = formatCurrency(bankBalance);
    const total = formatCurrency(totalBalance);
    
    return `💎 SALDO KEUANGAN ANDA\n\n💵 Tunai: ${cash}\n🏦 Rekening: ${bank}\n📊 Total: ${total}`;
}
```

#### **Transaction Success Template:**
```javascript
transactionSuccess: (transaction, balanceInfo) => {
    const paymentIcon = transaction.payment_method === 'bank' ? '🏦' : '💵';
    const paymentText = transaction.payment_method === 'bank' ? 'Rekening' : 'Tunai';
    
    return `✅ Transaksi Berhasil Ditambahkan\n\n` +
           `🆔 ID: #${transaction.id}\n` +
           `💰 ${formatCurrency(transaction.amount)}\n` +
           `🏷️ ${transaction.category || 'Lainnya'}\n` +
           `📝 ${transaction.description}\n` +
           `💳 ${paymentIcon} ${paymentText}\n\n` +
           `${balanceInfo}`;
}
```

---

## 🔄 HANDLER UPDATES

### 📋 **Message Handler** (`handlers/messageHandler.js`)

#### **Balance Command:**
```javascript
case '/saldo':
    const balance = await transactionService.getUserBalance(sender);
    const balanceInfo = MESSAGES.formatBalanceInfo(
        balance.cash, 
        balance.bank, 
        balance.total
    );
    const statusInfo = MESSAGES.getFinancialStatusInfo(balance.total >= 0);
    await sock.sendMessage(sender, { text: balanceInfo + '\n\n' + statusInfo });
    break;
```

#### **Transaction Processing:**
```javascript
const processTransaction = async (sender, message) => {
    const transaction = parseTransaction(message);
    if (transaction) {
        const paymentMethod = detectPaymentMethod(message);
        const result = await addTransaction(sender, transaction.amount, transaction.description, paymentMethod);
        
        if (result.success) {
            const balance = await getUserBalance(sender);
            const balanceInfo = MESSAGES.formatBalanceInfo(balance.cash, balance.bank, balance.total);
            const successMsg = MESSAGES.transactionSuccess(result.transaction, balanceInfo);
            await sock.sendMessage(sender, { text: successMsg });
        }
    }
};
```

---

## 🗂️ FILE STRUCTURE

### 📁 **Modified Files:**
```
database/
├── index.js                 # ✅ Schema + balance functions
services/
├── transactionService.js    # ✅ Payment detection + balance logic
utils/
├── messages.js              # ✅ Enhanced templates
handlers/
├── messageHandler.js        # ✅ Updated command handling
├── adminHandler.js          # ✅ Balance display integration
docs/
├── fitur-saldo-terpisah.md # ✅ User documentation
└── developer-guide.md       # ✅ This technical guide
```

---

## ⚡ API REFERENCE

### 🔧 **Core Functions**

#### **Balance Management:**
```javascript
// Get user balance breakdown
const balance = await getUserBalance(userId);
// Returns: { cash: number, bank: number, total: number }

// Update specific balance
await updateUserBalance(userId, amount, 'cash');    // For cash transactions
await updateUserBalance(userId, amount, 'bank');    // For bank transactions
```

#### **Payment Detection:**
```javascript
// Detect payment method from message
const method = detectPaymentMethod("bayar makan qris 25000");
// Returns: 'bank' or 'cash'
```

#### **Transaction with Balance Update:**
```javascript
// Add transaction with automatic balance update
const result = await addTransaction(userId, amount, description, paymentMethod);
// Automatically updates the correct balance (cash/bank)
```

---

## 🧪 TESTING SCENARIOS

### ✅ **Test Cases:**

#### **1. Payment Method Detection:**
```javascript
// Should return 'bank'
detectPaymentMethod("bayar makan qris 25000");
detectPaymentMethod("transfer ke teman 100000");
detectPaymentMethod("beli laptop pakai gopay");

// Should return 'cash'  
detectPaymentMethod("bayar makan tunai 25000");
detectPaymentMethod("beli ayam dari dompet");

// Should return 'cash' (default)
detectPaymentMethod("bayar makan 25000");
```

#### **2. Balance Updates:**
```javascript
// Test cash transaction
await addTransaction(userId, -25000, "makan tunai", "cash");
// Should decrease cash_balance by 25000

// Test bank transaction  
await addTransaction(userId, -30000, "makan qris", "bank");
// Should decrease bank_balance by 30000
```

#### **3. Balance Display:**
```javascript
const balance = await getUserBalance(userId);
console.log(balance);
// Expected: { cash: 975000, bank: 2970000, total: 3945000 }
```

---

## 🔧 MIGRATION NOTES

### 📊 **Database Migration:**
- ✅ Automatic schema updates on startup
- ✅ Backward compatibility maintained
- ✅ Existing transactions default to 'cash'
- ✅ New balance table created automatically

### 🔄 **Code Migration:**
- ✅ All existing handlers updated
- ✅ Message templates enhanced
- ✅ No breaking changes to existing features
- ✅ Graceful fallbacks for edge cases

---

## 🐛 DEBUGGING

### 🔍 **Common Issues:**

#### **Balance Not Updating:**
- Check if `updateUserBalance()` is called after transaction
- Verify payment method detection logic
- Ensure database connection is active

#### **Incorrect Payment Method:**
- Review keyword matching in `detectPaymentMethod()`
- Check for typos in bank/cash keywords
- Verify case-insensitive matching

#### **Display Issues:**
- Confirm message templates are properly formatted
- Check currency formatting function
- Verify balance calculation logic

---

## 📚 FUTURE ENHANCEMENTS

### 🚀 **Planned Features:**
- 📊 **Detailed Analytics**: Separate charts for cash vs bank spending
- 🔄 **Transfer Between Balances**: Move money from cash to bank
- 💳 **Payment Method History**: Track preferred payment methods
- 📱 **Smart Suggestions**: Recommend optimal payment method
- 🔔 **Balance Alerts**: Notify when cash or bank balance is low

---

## 📞 SUPPORT

For technical questions or issues:
- 📧 Contact: Developer Team
- 📁 Repository: Internal Git Repository
- 📋 Issue Tracker: Internal System

---

**🎯 This implementation provides a robust foundation for advanced financial tracking with clear separation between physical and digital money management.**

*Last Updated: ${new Date().toLocaleString('id-ID')}*
