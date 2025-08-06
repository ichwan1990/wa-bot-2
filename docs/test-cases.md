# 🧪 Test Cases & Examples: Cash/Bank Balance Feature

## 📋 COMPREHENSIVE TESTING GUIDE

This document contains test cases and examples to validate the cash/bank balance separation feature.

---

## 🎯 TESTING SCENARIOS

### 1️⃣ **PAYMENT METHOD DETECTION TESTS**

#### ✅ **Should Detect BANK/REKENING:**
```javascript
// Test cases that should return 'bank'
const bankTests = [
    "bayar makan qris 25000",
    "transfer ke teman 100000", 
    "beli laptop pakai gopay 500000",
    "bayar listrik ovo 150000",
    "belanja dana 75000",
    "bayar shopeepay 45000",
    "transfer bca 2000000",
    "bayar mandiri 350000",
    "debit bni 125000",
    "kartu kredit bri 890000",
    "mobile banking 650000",
    "bayar online 340000",
    "beli digital 230000",
    "qr code 125000",
    "tf sekarang 750000"
];

bankTests.forEach(test => {
    const result = detectPaymentMethod(test);
    console.log(`"${test}" → ${result}`); // Should all be 'bank'
});
```

#### ✅ **Should Detect CASH/TUNAI:**
```javascript
// Test cases that should return 'cash'
const cashTests = [
    "bayar makan tunai 25000",
    "beli ayam cash 35000", 
    "bayar uang cash 50000",
    "beli dari dompet 125000",
    "bayar kantong 75000",
    "makan tunai siang 45000",
    "belanja cash pagi 230000"
];

cashTests.forEach(test => {
    const result = detectPaymentMethod(test);
    console.log(`"${test}" → ${result}`); // Should all be 'cash'
});
```

#### ✅ **Should Default to CASH:**
```javascript
// Test cases with no specific keywords (should default to 'cash')
const defaultTests = [
    "bayar makan 25000",
    "beli laptop 8000000",
    "m 15000", // shortcut
    "transport 50000",
    "belanja bulanan 750000",
    "bayar tagihan 340000"
];

defaultTests.forEach(test => {
    const result = detectPaymentMethod(test);
    console.log(`"${test}" → ${result}`); // Should all be 'cash' (default)
});
```

---

### 2️⃣ **TRANSACTION PROCESSING TESTS**

#### 🏦 **Bank Transaction Test:**
```javascript
// Test bank transaction
const userId = "628123456789@s.whatsapp.net";
const message = "bayar makan qris 30000";

// Expected flow:
// 1. Parse transaction → amount: -30000, description: "bayar makan qris 30000"
// 2. Detect payment method → 'bank'
// 3. Update bank_balance → decrease by 30000
// 4. Get updated balance → show cash, bank, total
// 5. Send success message with balance info
```

#### 💵 **Cash Transaction Test:**
```javascript
// Test cash transaction  
const userId = "628123456789@s.whatsapp.net";
const message = "bayar makan tunai 25000";

// Expected flow:
// 1. Parse transaction → amount: -25000, description: "bayar makan tunai 25000" 
// 2. Detect payment method → 'cash'
// 3. Update cash_balance → decrease by 25000
// 4. Get updated balance → show cash, bank, total
// 5. Send success message with balance info
```

#### 💰 **Income Transaction Test:**
```javascript
// Test income (positive amount)
const tests = [
    "terima gaji transfer 5000000", // Should add to bank
    "terima gaji tunai 5000000",    // Should add to cash
    "bonus cash 500000",            // Should add to cash
    "terima qris 250000"            // Should add to bank
];
```

---

### 3️⃣ **BALANCE DISPLAY TESTS**

#### 📊 **Balance Format Test:**
```javascript
// Test balance display formatting
const testBalances = [
    { cash: 1250000, bank: 3750000, total: 5000000 },
    { cash: 0, bank: 2500000, total: 2500000 },
    { cash: 800000, bank: 0, total: 800000 },
    { cash: -50000, bank: 1000000, total: 950000 } // Negative cash
];

testBalances.forEach(balance => {
    const formatted = MESSAGES.formatBalanceInfo(balance.cash, balance.bank, balance.total);
    console.log(formatted);
});

// Expected output format:
// 💎 SALDO KEUANGAN ANDA
// 
// 💵 Tunai: Rp 1.250.000
// 🏦 Rekening: Rp 3.750.000  
// 📊 Total: Rp 5.000.000
```

---

### 4️⃣ **COMMAND TESTS**

#### `/saldo` **Command Test:**
```javascript
// Test /saldo command
// Input: "/saldo"
// Expected output:
/* 
💎 SALDO KEUANGAN ANDA

💵 Tunai: Rp 1.250.000
🏦 Rekening: Rp 3.750.000
📊 Total: Rp 5.000.000

✅ Keuangan dalam kondisi baik

💡 Tips: 
   • Gunakan "tunai" untuk transaksi cash
   • Gunakan "transfer/qris" untuk transaksi bank
   • Ketik /rekap untuk detail transaksi
*/
```

#### **Menu Option 3 Test:**
```javascript
// Test menu option "3"
// Should show same balance info as /saldo command
// Input: "3"
// Expected: Same format as /saldo above
```

---

### 5️⃣ **SHORTCUT COMMANDS TESTS**

#### 🍽️ **Makan Shortcut Tests:**
```javascript
const mealTests = [
    "m 15000",           // Default cash
    "m tunai 15000",     // Explicit cash  
    "m qris 20000",      // Bank via qris
    "m gopay 18000",     // Bank via gopay
    "m transfer 25000"   // Bank via transfer
];

// Expected behavior:
// - Parse amount correctly
// - Detect payment method based on keywords
// - Update correct balance (cash/bank)
// - Show transaction success with balance
```

#### 🚗 **Transport Shortcut Tests:**
```javascript
const transportTests = [
    "t 50000",           // Default cash
    "t tunai 50000",     // Explicit cash
    "t ovo 45000",       // Bank via ovo  
    "t tf 60000"         // Bank via transfer
];
```

---

### 6️⃣ **NATURAL LANGUAGE TESTS**

#### 🗣️ **Complex Sentence Tests:**
```javascript
const complexTests = [
    "hari ini bayar makan siang pakai qris sekitar 35000 rupiah",
    "kemarin beli laptop gaming transfer bca total 8500000",
    "bayar tagihan listrik bulan ini pakai ovo sebesar 250000",
    "belanja grocery minggu ini cash dari dompet 450000",
    "terima gaji bulanan transfer ke rekening mandiri 12000000"
];

// Test that:
// 1. Amount parsing works correctly
// 2. Payment method detection works in complex sentences  
// 3. Transaction categorization works
// 4. Balance updates correctly
```

---

### 7️⃣ **EDGE CASE TESTS**

#### ⚠️ **Edge Cases:**
```javascript
const edgeCases = [
    "transfer tunai 100000",        // Conflicting keywords → should prioritize 'bank' (transfer)
    "qris cash 50000",              // Conflicting keywords → should prioritize 'bank' (qris)
    "bayar 0",                      // Zero amount
    "bayar -50000",                 // Negative input (should be treated as expense)
    "terima -100000",               // Negative income (should be treated as expense)
    "BAYAR MAKAN QRIS 25000",       // All caps
    "bayar makan qris 25.000",      // Decimal formatting
    "bayar makan qris 25,000",      // Comma formatting
];

// Expected behavior:
// - Handle conflicting keywords gracefully (bank keywords take priority)
// - Validate amounts properly  
// - Handle case-insensitive input
// - Parse various number formats
```

---

### 8️⃣ **INTEGRATION TESTS**

#### 🔄 **Full Flow Test:**
```javascript
// Complete user interaction flow test
const fullFlowTest = async () => {
    const userId = "628123456789@s.whatsapp.net";
    
    // 1. Check initial balance
    let balance = await getUserBalance(userId);
    console.log("Initial:", balance);
    
    // 2. Add cash transaction
    await addTransaction(userId, -25000, "makan tunai", "cash");
    balance = await getUserBalance(userId);
    console.log("After cash expense:", balance);
    
    // 3. Add bank transaction  
    await addTransaction(userId, -30000, "makan qris", "bank");
    balance = await getUserBalance(userId);
    console.log("After bank expense:", balance);
    
    // 4. Add cash income
    await addTransaction(userId, 500000, "bonus cash", "cash");
    balance = await getUserBalance(userId);
    console.log("After cash income:", balance);
    
    // 5. Add bank income
    await addTransaction(userId, 2000000, "gaji transfer", "bank");  
    balance = await getUserBalance(userId);
    console.log("Final balance:", balance);
};
```

---

### 9️⃣ **PERFORMANCE TESTS**

#### ⚡ **Load Testing:**
```javascript
// Test multiple rapid transactions
const performanceTest = async () => {
    const userId = "628123456789@s.whatsapp.net";
    const transactions = [];
    
    // Generate 100 test transactions
    for (let i = 0; i < 100; i++) {
        const isBankTransaction = i % 2 === 0;
        const amount = Math.floor(Math.random() * 100000) + 10000;
        const paymentMethod = isBankTransaction ? 'bank' : 'cash';
        const description = `Test transaction ${i}`;
        
        transactions.push({ amount: -amount, description, paymentMethod });
    }
    
    // Measure execution time
    const startTime = Date.now();
    
    for (const transaction of transactions) {
        await addTransaction(userId, transaction.amount, transaction.description, transaction.paymentMethod);
    }
    
    const endTime = Date.now();
    console.log(`Processed 100 transactions in ${endTime - startTime}ms`);
    
    // Verify final balance
    const finalBalance = await getUserBalance(userId);
    console.log("Final balance after 100 transactions:", finalBalance);
};
```

---

## 🔍 VALIDATION CHECKLIST

### ✅ **Core Functionality:**
- [ ] Payment method detection works for all keywords
- [ ] Cash transactions update cash_balance correctly
- [ ] Bank transactions update bank_balance correctly  
- [ ] Balance display shows cash/bank/total correctly
- [ ] `/saldo` command works properly
- [ ] Menu option 3 works properly

### ✅ **Message Integration:**
- [ ] Transaction success messages show payment method
- [ ] Balance info appears in all relevant outputs
- [ ] Message formatting is consistent and beautiful
- [ ] Emojis display correctly across different devices

### ✅ **Edge Cases:**
- [ ] Conflicting keywords handled properly
- [ ] Zero and negative amounts handled correctly
- [ ] Case-insensitive keyword matching works
- [ ] Various number formats parsed correctly
- [ ] Database errors handled gracefully

### ✅ **Performance:**
- [ ] Fast response times for balance queries
- [ ] Efficient database operations
- [ ] No memory leaks during extended use
- [ ] Proper error handling and recovery

---

## 🚀 MANUAL TESTING STEPS

### 📱 **Step-by-Step Test:**

1. **Setup Test User:**
   ```
   Send any message to bot to initialize user
   ```

2. **Test Initial Balance:**
   ```
   Send: /saldo
   Expected: Show 0 for cash, bank, and total
   ```

3. **Test Cash Transaction:**
   ```
   Send: bayar makan tunai 25000
   Expected: Transaction success + balance shows cash: -25000
   ```

4. **Test Bank Transaction:**
   ```
   Send: bayar transport qris 15000  
   Expected: Transaction success + balance shows bank: -15000
   ```

5. **Test Balance Display:**
   ```
   Send: /saldo
   Expected: Cash: -25000, Bank: -15000, Total: -40000
   ```

6. **Test Income:**
   ```
   Send: terima gaji transfer 5000000
   Expected: Bank balance increases to 4985000
   ```

7. **Test Final Balance:**
   ```
   Send: 3 (menu option)
   Expected: Cash: -25000, Bank: 4985000, Total: 4960000
   ```

---

## 📊 EXPECTED RESULTS

### 🎯 **Success Criteria:**
- ✅ All payment methods detected correctly
- ✅ Balances update accurately for each transaction type
- ✅ Display format is consistent and user-friendly
- ✅ No errors or exceptions during normal usage
- ✅ Performance remains fast with multiple transactions
- ✅ User experience is intuitive and helpful

---

**🎉 Complete these tests to ensure the cash/bank balance feature is working perfectly!**

*Test Guide Created: ${new Date().toLocaleString('id-ID')}*
