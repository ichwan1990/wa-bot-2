# 💰 WhatsApp Financial Bot

> **Bot WhatsApp canggih untuk manajemen keuangan pribadi dengan tracking otomatis saldo tunai dan rekening**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-blue.svg)](https://sqlite.org/)
[![WhatsApp](https://img.shields.io/badge/Platform-WhatsApp-25D366.svg)](https://whatsapp.com/)

---

## 🌟 FITUR UTAMA

### 💎 **Manajemen Saldo Terpisah** ⭐ NEW!
- 💵 **Saldo Tunai**: Tracking uang cash/dompet
- 🏦 **Saldo Rekening**: Tracking uang digital/transfer  
- 📊 **Total Saldo**: Gabungan otomatis tunai + rekening
- 🤖 **Auto-Detection**: Deteksi metode pembayaran otomatis

### 📱 **Interaksi Natural**
- 🗣️ **Natural Language**: "bayar makan qris 25000"
- ⚡ **Quick Commands**: `m 15000`, `t 50000`, `/saldo`
- 📋 **Menu Interaktif**: Navigasi mudah dengan angka
- 🎯 **Smart Parsing**: Deteksi nominal dan kategori otomatis

### 📊 **Analytics & Reporting**
- 📈 **Chart Visualisasi**: Grafik pengeluaran harian/bulanan
- 📋 **Rekap Keuangan**: Laporan detail dengan kategori
- 🔍 **Search & Filter**: Cari transaksi berdasarkan kriteria
- 📊 **Dashboard Real-time**: Status keuangan live

### 🛡️ **Security & Management**
- 👑 **Admin Panel**: Manajemen user dan sistem
- 🔐 **Role-based Access**: Kontrol akses bertingkat
- 💾 **Backup Otomatis**: Perlindungan data berkala
- 📱 **Multi-device**: Sinkronisasi antar perangkat

---

## 🚀 QUICK START

### 📋 **Prerequisites**
```bash
Node.js 18+
npm atau yarn
WhatsApp account
```

### ⚡ **Installation**
```bash
# Clone repository
git clone <repository-url>
cd wa-bot-2

# Install dependencies
npm install

# Start the bot
npm start
```

### 📱 **First Usage**
1. **Scan QR Code** di terminal untuk login WhatsApp
2. **Kirim pesan** ke bot untuk inisialisasi
3. **Ketik `/help`** untuk panduan lengkap

---

## 💬 CARA PENGGUNAAN

### 🎯 **Command Dasar**

#### 💰 **Cek Saldo**
```
/saldo
3 (dari menu)
```

#### 📝 **Tambah Transaksi**
```
# Transaksi Tunai (potong dari dompet)
bayar makan tunai 25000
m 15000  (shortcut makan)
beli ayam cash 35000

# Transaksi Bank/Digital (potong dari rekening)  
bayar makan qris 30000
transport ovo 15000
transfer ke teman 100000
t gopay 20000  (shortcut transport)

# Income/Pemasukan
terima gaji transfer 5000000
bonus tunai 500000
```

#### 📊 **Lihat Laporan**
```
/rekap          # Rekap bulanan
/chart          # Grafik pengeluaran
/search makan   # Cari transaksi
```

#### 🆘 **Bantuan**
```
/help           # Panduan lengkap
/menu           # Menu interaktif
```

---

## 🤖 AUTO-DETECTION PAYMENT METHOD

### 🏦 **Keyword Bank/Rekening:**
- **Payment Apps**: `ovo`, `gopay`, `dana`, `shopeepay`
- **Banks**: `bca`, `mandiri`, `bni`, `bri`  
- **Methods**: `transfer`, `tf`, `qris`, `qr`, `debit`
- **General**: `online`, `digital`, `mobile banking`

### 💵 **Keyword Tunai/Cash:**
- **Direct**: `tunai`, `cash`, `uang cash`
- **Container**: `dompet`, `kantong`

### ⚙️ **Default Behavior:**
- Jika tidak ada keyword khusus → **TUNAI**
- Keyword bisa di mana saja dalam kalimat
- Case-insensitive (tidak peduli huruf besar/kecil)

---

## 📊 CONTOH OUTPUT

### 💰 **Balance Display:**
```
💎 SALDO KEUANGAN ANDA

💵 Tunai: Rp 1.250.000
🏦 Rekening: Rp 3.750.000  
📊 Total: Rp 5.000.000

✅ Keuangan dalam kondisi baik

💡 Tips: 
   • Gunakan "tunai" untuk transaksi cash
   • Gunakan "transfer/qris" untuk transaksi bank
   • Ketik /rekap untuk detail transaksi
```

### ✅ **Transaction Success:**
```
✅ Transaksi Berhasil Ditambahkan

🆔 ID: #123
💰 -35.000
🏷️ Makan
📝 bayar makan qris 35000
💳 🏦 Rekening

💎 SALDO TERKINI:
💵 Tunai: Rp 850.000
🏦 Rekening: Rp 2.965.000
💰 Total: Rp 3.815.000

📊 Ketik /chart untuk lihat grafik
📋 Ketik /rekap untuk rekap bulanan
```

---

## 🏗️ ARCHITECTURE

### 📁 **Project Structure**
```
wa-bot-2/
├── 📋 index.js                 # Main bot entry point
├── 📊 package.json             # Dependencies & scripts
├── 🗄️ financial.db             # SQLite database
├── ⚙️ config/                  # Configuration files
├── 🏪 database/                # Database schema & functions  
├── 🎮 handlers/                # Message & command handlers
├── 🔧 services/                # Business logic services
├── 💬 utils/                   # Utilities & message templates
├── 📁 public/                  # Static web assets
├── 📋 docs/                    # Documentation
├── 🗂️ logs/                    # Application logs
├── 💾 sessions/                # WhatsApp session data
└── 📊 temp/                    # Temporary files
```

### 🔧 **Core Components**

#### 🏪 **Database Layer** (`database/index.js`)
- SQLite database dengan schema transaksi dan saldo
- Functions untuk CRUD operations
- Auto-migration dan backup

#### 🎮 **Handler Layer** (`handlers/`)
- `messageHandler.js`: Routing pesan dan command utama
- `adminHandler.js`: Panel admin dan management
- `ai.js`: AI integration untuk natural language

#### 🔧 **Service Layer** (`services/`)
- `transactionService.js`: Logic transaksi dan saldo
- `chartService.js`: Generasi grafik dan visualisasi  
- `userService.js`: Manajemen user dan autentikasi
- `reportService.js`: Generate laporan dan rekap

#### 💬 **Utils Layer** (`utils/`)
- `messages.js`: Template pesan terpusat dan terstandarisasi
- Helper functions untuk formatting dan validasi

---

## 🛠️ CONFIGURATION

### ⚙️ **Environment Variables**
```env
# Database
DB_PATH=./financial.db

# Logging  
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Features
ENABLE_CHARTS=true
ENABLE_AI=true
ENABLE_BACKUP=true

# Admin
ADMIN_NUMBERS=628123456789,628987654321
```

### 📊 **Database Schema**
```sql
-- Transactions with payment method
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    description TEXT,
    payment_method TEXT DEFAULT 'cash', -- 'cash' or 'bank'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Separate balance tracking
CREATE TABLE user_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    cash_balance REAL DEFAULT 0,
    bank_balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 TESTING

### 🔍 **Test Cases**
```bash
# Run test scenarios
npm test

# Manual testing guide
cat docs/test-cases.md
```

### ✅ **Key Test Areas**
- 🤖 Payment method auto-detection
- 💰 Balance calculation accuracy  
- 📱 Message template formatting
- 🔄 Transaction flow integrity
- ⚡ Performance under load

---

## 📚 DOCUMENTATION

### 📖 **Available Docs**
- 📋 **[User Guide](docs/fitur-saldo-terpisah.md)**: Panduan penggunaan fitur baru
- 🛠️ **[Developer Guide](docs/developer-guide.md)**: Technical implementation details
- 🧪 **[Test Cases](docs/test-cases.md)**: Comprehensive testing scenarios
- 🏗️ **[Architecture](docs/microservices-architecture.md)**: System design overview
- 📱 **[Mobile App Proposal](docs/mobile-app-proposal.md)**: Future mobile integration

---

## 🔧 DEVELOPMENT

### 🚀 **Development Mode**
```bash
# Start with auto-reload
npm run dev

# Enable debug logging
DEBUG=bot:* npm start

# Database management
npm run db:backup
npm run db:restore
```

### 🏗️ **Adding Features**
1. **Create service** in `services/` for business logic
2. **Add handlers** in `handlers/` for user interaction  
3. **Update messages** in `utils/messages.js` for UI
4. **Extend database** in `database/index.js` if needed
5. **Add tests** in `docs/test-cases.md`

---

## 🔄 DEPLOYMENT

### 🏭 **Production Setup**
```bash
# Install PM2 for process management
npm install -g pm2

# Start in production mode
pm2 start index.js --name "financial-bot"

# Monitor processes
pm2 monit

# Setup auto-restart
pm2 startup
pm2 save
```

### 🔧 **Monitoring**
- 📊 **Logs**: `tail -f logs/app.log`
- 💾 **Database**: SQLite browser atau DB management tools
- 📱 **WhatsApp Status**: Check session files integrity
- ⚡ **Performance**: Monitor CPU dan memory usage

---

## 🐛 TROUBLESHOOTING

### ❌ **Common Issues**

#### 🔐 **WhatsApp Session Issues**
```bash
# Clear session dan re-authenticate
rm -rf sessions/*
npm start  # Scan QR code again
```

#### 🗄️ **Database Issues**
```bash
# Check database integrity
sqlite3 financial.db "PRAGMA integrity_check;"

# Backup current database
cp financial.db financial.backup.db

# Reset database (CAUTION: Data loss!)
rm financial.db
npm start  # Auto-create new database
```

#### 💥 **Bot Not Responding**
1. Check network connection
2. Verify WhatsApp account status
3. Review logs for errors: `tail -f logs/app.log`
4. Restart bot: `pm2 restart financial-bot`

---

## 🚀 ROADMAP

### 🔮 **Upcoming Features**
- 📊 **Advanced Analytics**: AI-powered spending insights
- 🔄 **Multi-currency**: Support mata uang berbeda  
- 📱 **Mobile App**: Native iOS/Android companion
- 🏦 **Bank Integration**: Sync dengan rekening bank real
- 👥 **Family Sharing**: Manajemen keuangan keluarga
- 💳 **Budget Planning**: Perencanaan anggaran otomatis

### 🎯 **Current Version: 2.0**
- ✅ Centralized message system
- ✅ Cash/Bank balance separation  
- ✅ Auto payment method detection
- ✅ Enhanced user experience
- ✅ Comprehensive documentation

---

## 📞 SUPPORT

### 🆘 **Need Help?**
- 📧 **Issues**: Create issue di repository
- 💬 **Discussion**: Join developer chat
- 📖 **Documentation**: Baca docs/ folder
- 🛠️ **Contributing**: Fork & submit PR

### 🤝 **Contributing**
1. Fork repository
2. Create feature branch
3. Make changes dengan test
4. Submit pull request
5. Wait for review

---

## 📄 LICENSE

MIT License - Feel free to use and modify

---

## 🙏 CREDITS

- **[Baileys](https://github.com/WhiskeySockets/Baileys)**: WhatsApp Web API
- **[SQLite](https://sqlite.org/)**: Embedded database
- **[Chart.js](https://chartjs.org/)**: Data visualization
- **Developer Team**: For continuous development

---

**🎉 Terima kasih telah menggunakan WhatsApp Financial Bot! Semoga membantu mengelola keuangan Anda dengan lebih baik.**

*Last Updated: ${new Date().toLocaleString('id-ID')}*

---

[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red.svg)](https://github.com)
[![Powered by Node.js](https://img.shields.io/badge/Powered%20by-Node.js-green.svg)](https://nodejs.org)
[![WhatsApp Bot](https://img.shields.io/badge/WhatsApp-Bot-25D366.svg)](https://whatsapp.com)
