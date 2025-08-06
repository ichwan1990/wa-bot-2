/**
 * Centralized message templates for WhatsApp Bot
 * All message outputs are organized here for consistency and maintainability
 */

// ================================
// SUCCESS MESSAGES
// ================================
const success = {
  transactionAdded: (transactionId, sign, amount, category, description, paymentMethod, balance) => 
    `✅ *Transaksi Berhasil Ditambahkan*

🆔 ID: #${transactionId}
💰 ${sign}${amount}
🏷️ ${category}
📝 ${description}
💳 ${paymentMethod === 'cash' ? '💵 Tunai' : '🏦 Rekening'}

💎 **SALDO TERKINI:**
💵 Tunai: Rp ${balance.cash.toLocaleString('id-ID')}
🏦 Rekening: Rp ${balance.bank.toLocaleString('id-ID')}
💰 Total: Rp ${balance.total.toLocaleString('id-ID')}

📊 Ketik */chart* untuk lihat grafik
📋 Ketik */rekap* untuk rekap bulanan`,

  quickTransactionAdded: (transactionId, sign, amount, category, description, paymentMethod, balance) => 
    `⚡ *Quick Transaction Berhasil*

🆔 ID: #${transactionId}
💰 ${sign}${amount}
🏷️ ${category}
📝 ${description}
💳 ${paymentMethod === 'cash' ? '💵 Tunai' : '🏦 Rekening'}

💎 **SALDO TERKINI:**
💵 Tunai: Rp ${balance.cash.toLocaleString('id-ID')}
🏦 Rekening: Rp ${balance.bank.toLocaleString('id-ID')}
💰 Total: Rp ${balance.total.toLocaleString('id-ID')}

🚀 Transaksi tercatat otomatis!`,

  transactionDeleted: (deletedTransaction) => 
    `🗑️ *Transaksi Berhasil Dihapus*

� **Nominal:** ${deletedTransaction.amount}
🏷️ **Kategori:** ${deletedTransaction.category}
📝 **Deskripsi:** ${deletedTransaction.description}
� **Metode:** ${deletedTransaction.paymentMethod}
�📅 **Tanggal:** ${deletedTransaction.date}

✅ Saldo telah dikembalikan ke posisi sebelumnya
📊 Ketik */saldo* untuk melihat saldo terkini`,

  whitelistUpdated: (action, phone) => 
    `✅ *Whitelist ${action === 'add' ? 'Ditambah' : 'Dihapus'}*

📱 **Nomor:** ${phone}
📅 **Status:** ${action === 'add' ? 'Aktif' : 'Nonaktif'}

${action === 'add' ? '🎉 User dapat menggunakan bot' : '⚠️ User tidak dapat menggunakan bot'}`,

  adminStatsGenerated: (stats) => 
    `📊 *Statistik Admin Dashboard*

👥 **Total User:** ${stats.totalUsers}
📈 **User Aktif:** ${stats.activeUsers}
💼 **Role Finance:** ${stats.financeUsers}
🏢 **Role Attendance:** ${stats.attendanceUsers}
💰 **Role Cashier:** ${stats.cashierUsers}
🔧 **Role Admin:** ${stats.adminUsers}

📅 **Update:** ${new Date().toLocaleString('id-ID')}`,

  balanceDisplay: (balance) => 
    `💎 *SALDO KEUANGAN ANDA*

💵 **Tunai:** Rp ${balance.cash.toLocaleString('id-ID')}
🏦 **Rekening:** Rp ${balance.bank.toLocaleString('id-ID')}
📊 **Total:** Rp ${balance.total.toLocaleString('id-ID')}

${balance.total >= 0 ? '✅ Keuangan dalam kondisi baik' : '⚠️ Perhatikan pengeluaran Anda'}

💡 **Tips:** 
   • Gunakan "tunai" untuk transaksi cash
   • Gunakan "transfer/qris" untuk transaksi bank
   • Ketik */rekap* untuk detail transaksi`
};

// ================================
// ERROR MESSAGES  
// ================================
const error = {
  systemError: `⚠️ *Kesalahan Sistem*

🔧 Terjadi gangguan teknis
💬 Tim kami sedang menangani masalah ini
🔄 Silakan coba lagi dalam beberapa saat`,
  
  transactionFailed: `❌ *Transaksi Gagal*

💳 Tidak dapat menyimpan transaksi
🔄 Silakan coba lagi
💡 Periksa format input Anda`,
  
  transactionNotFound: `🔍 *Transaksi Tidak Ditemukan*

❌ ID transaksi tidak ada dalam sistem Anda
📋 Ketik */rekap* untuk melihat semua transaksi
💡 Pastikan ID yang dimasukkan benar

**Format yang benar:**
• /hapus [ID]
• Contoh: /hapus 123`,
  
  accessDenied: `🚫 *Akses Ditolak*

⛔ Anda tidak memiliki izin untuk fitur ini
🔑 Hubungi administrator untuk upgrade akses`,
  
  invalidFormat: {
    delete: `📝 *Format Salah - Hapus Transaksi*

❌ Format yang Anda masukkan tidak benar

**Format yang benar:**
• /hapus [ID]
• Contoh: /hapus 123

💡 **Cara mudah:**
1. Ketik */rekap* untuk lihat semua transaksi
2. Catat ID transaksi yang ingin dihapus
3. Ketik */hapus [ID]*

⚠️ **Perhatian:** Hapus transaksi akan mengembalikan saldo ke posisi sebelumnya`,
    
    admin: `📝 *Format Salah - Admin Command*

**Cara yang benar:**
• /admin add [nomor]
• /admin remove [nomor]
• /admin list
• /admin stats

📞 Contoh: /admin add 628123456789`,
    
    shortcut: (shortcut) => 
      `📝 *Format Salah - ${shortcut.toUpperCase()}*

❌ Format input tidak benar

✅ **Contoh yang benar:**
   • ${shortcut} 25000
   • ${shortcut} 50rb  
   • ${shortcut} 2jt

💡 Tips: Tulis nominal tanpa spasi`,
    
    roleAssign: `📝 *Format Salah - Role Assign*

**Cara yang benar:**
• /role assign [phone] [role_name]
• Contoh: /role assign 628123456789 finance

📋 Role tersedia: finance, attendance, cashier, admin`,
    
    roleRemove: `📝 *Format Salah - Role Remove*

**Cara yang benar:**
• /role remove [phone] [role_name]
• Contoh: /role remove 628123456789 finance

📋 Role tersedia: finance, attendance, cashier, admin`
  },
  
  whitelistAddFailed: `❌ *Gagal Menambah User*

🚫 Tidak dapat menambahkan nomor ke whitelist
🔄 Periksa nomor dan coba lagi
💬 Hubungi administrator jika masalah berlanjut`,
  
  whitelistRemoveFailed: `❌ *Gagal Menghapus User*

🚫 Tidak dapat menghapus nomor dari whitelist
🔍 Pastikan nomor terdaftar dalam sistem
💬 Hubungi administrator jika masalah berlanjut`,
  
  whitelistNotFound: `🔍 *Nomor Tidak Ditemukan*

❌ Nomor tersebut tidak ada dalam whitelist
📋 Gunakan \`/admin list\` untuk melihat daftar user`,
  
  whitelistGetFailed: `❌ *Gagal Mengambil Data*

🗄️ Tidak dapat mengambil daftar whitelist
🔄 Silakan coba lagi
🔧 Periksa koneksi database`,
  
  parseMessageFailed: `❓ *Pesan Tidak Dipahami*

❌ Format pesan tidak dikenali sistem

✅ **Contoh format yang benar:**
   • bayar makan 25000
   • terima gaji 5jt
   • m 25000 (makan cepat)
   • t 15000 (transport cepat)

🚀 **Navigasi cepat:**
   • */menu* - Menu pilihan
   • */chart* - Grafik keuangan
   • */help* - Panduan lengkap`
};

// ================================
// INFO MESSAGES
// ================================
const info = {
  welcome: `🎉 *Selamat Datang di Financial Bot!*

💰 **Fitur Utama:**
   • Catat pemasukan & pengeluaran
   • Analisis keuangan otomatis
   • Grafik & laporan real-time

🚀 **Mulai dengan:**
   • */menu* - Menu navigasi cepat
   • */help* - Panduan lengkap
   • Atau langsung ketik: "bayar makan 25000"`,

  help: `📖 *Panduan Lengkap Financial Bot*

💰 **TRANSAKSI:**
   • \`bayar [kategori] [jumlah]\` - Catat pengeluaran
   • \`terima [kategori] [jumlah]\` - Catat pemasukan
   • \`/hapus [ID]\` - Hapus transaksi

💳 **METODE PEMBAYARAN:**
   • 💵 **Tunai:** "bayar makan tunai 25000"
   • 🏦 **Rekening:** "bayar makan transfer 25000"
   • Default: tunai (jika tidak disebutkan)
   
🏦 **Keyword Rekening:** transfer, qris, ovo, gopay, dana, bca, mandiri, dll
💵 **Keyword Tunai:** tunai, cash, dompet

⚡ **SHORTCUT CEPAT:**
   • \`m [jumlah]\` - Makan (pengeluaran)
   • \`t [jumlah]\` - Transport
   • \`b [jumlah]\` - Belanja
   • \`u [jumlah]\` - Utility
   • \`g [jumlah]\` - Gaji (pemasukan)

📊 **ANALISIS:**
   • \`/chart\` - Grafik keuangan
   • \`/rekap\` - Rekap bulanan
   • \`/saldo\` - Saldo terkini (tunai + rekening)

🎯 **NAVIGASI:**
   • \`/menu\` - Menu pilihan cepat
   • \`/start\` - Mulai dari awal

💡 **Contoh:**
   • "bayar makan qris 35000" → potong dari rekening
   • "terima gaji tunai 5jt" → tambah ke tunai`,

  menu: `🏠 *MENU UTAMA*

💰 **TRANSAKSI CEPAT**
📈 \`1\` - Catat Pemasukan
📉 \`2\` - Catat Pengeluaran
📊 \`3\` - Lihat Saldo

📋 **LAPORAN**
📈 \`4\` - Grafik Keuangan
📋 \`5\` - Rekap Bulanan
🗑️ \`6\` - Hapus Transaksi

ℹ️ **BANTUAN**
❓ \`7\` - Panduan Lengkap
🏠 \`8\` - Kembali ke Menu

💡 **Tips:** Ketik angka pilihan atau gunakan command langsung`,

  chartMenu: `📊 *MENU GRAFIK KEUANGAN*

📈 **PILIH JENIS GRAFIK:**

\`1\` 📊 **Line Chart** - Trend bulanan
\`2\` 🥧 **Pie Chart** - Kategori pengeluaran  
\`3\` 📊 **Bar Chart** - Perbandingan 3 bulan
\`4\` 📈 **Trend Analysis** - Analisis detail

\`0\` 🏠 **Kembali ke Menu Utama**

💡 Ketik angka pilihan Anda`,

  noTransactions: `📋 *Belum Ada Transaksi*

❌ Belum ada transaksi tercatat bulan ini

🚀 **Mulai mencatat dengan:**
   • "bayar makan 25000"
   • "terima gaji 5000000"
   • Atau ketik */menu* untuk pilihan cepat`,

  processingChart: `📊 *Sedang Memproses Grafik...*

⏳ Menganalisis data transaksi
📈 Membuat visualisasi
🎨 Menyiapkan grafik

💫 Mohon tunggu sebentar...`
};

// ================================
// CHART CAPTIONS
// ================================
const chartCaptions = {
  lineChart: (income, expense, net) => 
    `📈 *Analisis Keuangan Bulanan*

💰 **Total Pemasukan:** ${income}
💸 **Total Pengeluaran:** ${expense}
📊 **Net Balance:** ${net}

${net.includes('-') ? '⚠️ Pengeluaran lebih besar dari pemasukan' : '✅ Keuangan dalam kondisi positif'}`,

  lineChartPeriod: (period, income, expense) => 
    `📈 *Trend Keuangan - ${period}*

💰 **Pemasukan:** ${income}
💸 **Pengeluaran:** ${expense}

📊 Lihat grafik untuk analisis detail trend keuangan Anda`,

  pieChart: (total, categories) => 
    `🥧 *Analisis Pengeluaran Bulanan*

💸 **Total Pengeluaran:** ${total}
📊 **Jumlah Kategori:** ${categories}

📈 Grafik menunjukkan proporsi pengeluaran per kategori`,

  barChart: (currentIncome, currentExpense) => 
    `📊 *Perbandingan 3 Bulan Terakhir*

📅 **Bulan Ini:**
💰 Pemasukan: ${currentIncome}
💸 Pengeluaran: ${currentExpense}

📈 Lihat grafik untuk trend perbandingan bulanan`
};

// ================================
// ROLE-BASED MESSAGES
// ================================
const roleMessages = {
  noRole: (userNumber) => 
    `🔐 *Akses Belum Terdaftar*

❌ Anda belum memiliki role dalam sistem

🧑‍💼 **Langkah selanjutnya:**
   • Hubungi administrator
   • Minta akses ke sistem
   
📱 **Nomor Anda:** ${userNumber}`,

  commandNotAvailable: (command, roleEmoji, roleDisplayName) => 
    `🚫 *Command Tidak Tersedia*

❌ Command */${command}* tidak dapat digunakan
👤 **Role Anda:** ${roleEmoji} ${roleDisplayName}

💡 Ketik */help* untuk melihat command yang tersedia`,

  shortcutNotAvailable: (shortcut, roleEmoji, roleDisplayName) => 
    `🚫 *Shortcut Tidak Tersedia*

❌ Shortcut *"${shortcut}"* tidak dapat digunakan  
👤 **Role Anda:** ${roleEmoji} ${roleDisplayName}

💡 Ketik */help* untuk melihat fitur yang tersedia`,

  quickNumberNotAvailable: (quickNumber, roleEmoji, roleDisplayName) => 
    `🚫 *Quick Command Tidak Tersedia*

❌ Quick command *${quickNumber}* tidak dapat digunakan
👤 **Role Anda:** ${roleEmoji} ${roleDisplayName}

💡 Ketik */menu* untuk melihat opsi yang tersedia`,

  welcome: (roleEmoji, roleDisplayName, roleDescription) => 
    `🎉 *Selamat Datang!*

👤 Role: ${roleEmoji} *${roleDisplayName}*
📝 ${roleDescription}

🚀 **Mulai menggunakan:**
   • Ketik */help* untuk panduan lengkap
   • Ketik */menu* untuk pilihan cepat`,

  imageReceivedWithRole: (roleEmoji, roleDisplayName) => 
    `📸 *Foto Berhasil Diterima*

👤 Role Anda: ${roleEmoji} ${roleDisplayName}
💡 Ketik */menu* untuk melihat fitur yang tersedia`,

  locationReceivedWithRole: (roleEmoji, roleDisplayName) => 
    `📍 *Lokasi Berhasil Diterima*

👤 Role Anda: ${roleEmoji} ${roleDisplayName}  
💡 Ketik */menu* untuk melihat fitur yang tersedia`,

  unregisteredUser: (userNumber) => 
    `👋 *Selamat Datang di Financial Bot!*

⚠️ **Status:** Belum terdaftar dalam sistem
🔐 **Akses:** Perlu approve dari administrator

📞 **Hubungi Admin untuk:**
   • Registrasi akun
   • Mendapatkan akses
   • Informasi fitur

📱 **Nomor Anda:** ${userNumber}`
};

// ================================
// ADMIN MESSAGES
// ================================
const adminMessages = {
  roleNotFound: (roleName) => 
    `🔍 *Role Tidak Ditemukan*

❌ Role "${roleName}" tidak tersedia dalam sistem

📋 **Role yang tersedia:**
   • finance (Keuangan)
   • attendance (Absensi) 
   • cashier (Kasir)
   • admin (Administrator)`,

  userNotFound: (phone) => 
    `👤 *User Tidak Ditemukan*

❌ User dengan nomor ${phone} tidak terdaftar

⚠️ **Persyaratan:**
   • User harus mengirim pesan ke bot terlebih dahulu
   • Pastikan nomor yang dimasukkan benar`,

  roleAssigned: (roleEmoji, roleDisplayName, phone) => 
    `✅ *Role Berhasil Diberikan*

👤 **User:** ${phone}
🎭 **Role:** ${roleEmoji} ${roleDisplayName}
📅 **Status:** Aktif

🎉 User sekarang dapat menggunakan semua fitur sesuai role`,

  roleAssignFailed: (message) => 
    `❌ *Gagal Memberikan Role*

⚠️ **Alasan:** ${message}

💡 Silakan periksa kembali data yang dimasukkan`,

  roleRemoved: (roleEmoji, roleDisplayName, phone) => 
    `✅ *Role Berhasil Dihapus*

👤 **User:** ${phone}  
🎭 **Role:** ${roleEmoji} ${roleDisplayName}
📅 **Status:** Dicabut

⚠️ User tidak dapat lagi menggunakan fitur role ini`,

  roleRemoveFailed: (message) => 
    `❌ *Gagal Menghapus Role*

⚠️ **Alasan:** ${message}

💡 Silakan periksa kembali data yang dimasukkan`,

  roleUnknown: (roleDisplayName) => 
    `❓ *Role Tidak Dikenali*

❌ Role "${roleDisplayName}" tidak valid dalam sistem

🧑‍💼 Hubungi administrator untuk bantuan lebih lanjut`,

  roleNotification: (roleEmoji, roleDisplayName, roleDescription) => 
    `🎉 *Selamat! Anda Mendapat Akses Baru*

🎭 **Role:** ${roleEmoji} ${roleDisplayName}
📝 **Deskripsi:** ${roleDescription}

🚀 **Mulai gunakan fitur:**
   • Ketik */help* untuk panduan
   • Ketik */menu* untuk pilihan cepat`,

  roleRemovedNotification: (roleEmoji, roleDisplayName) => 
    `📢 *Akses Role Dicabut*

🎭 **Role:** ${roleEmoji} ${roleDisplayName}
⚠️ **Status:** Tidak aktif lagi

❓ Jika ini kesalahan, hubungi administrator`,

  invalidSubCommand: (availableCommands) => 
    `❌ *Sub-command Tidak Valid*

💡 **Command yang tersedia:**
${availableCommands}

📝 Ketik command dengan format yang benar`,

  formatError: {
    roleAssign: `📝 *Format Salah - Role Assign*

**Cara yang benar:**
• /role assign [phone] [role_name]
• Contoh: /role assign 628123456789 finance`,
    roleRemove: `📝 *Format Salah - Role Remove*

**Cara yang benar:**
• /role remove [phone] [role_name]
• Contoh: /role remove 628123456789 finance`
  },

  help: `👑 *PANDUAN ADMINISTRATOR*

🔧 *ROLE MANAGEMENT:*
- /role - Lihat semua role
- /role assign [phone] [role] - Berikan role
- /role remove [phone] [role] - Hapus role  
- /role stats - Statistik role

👥 *USER MANAGEMENT:*
- /users - Lihat semua user
- /users [role] - User dengan role tertentu

📊 *STATISTICS:*
- /stats - Statistik sistem umum

💡 *ROLE YANG TERSEDIA:*
- finance - Keuangan (transaksi, laporan)
- attendance - Absensi (lokasi, foto)
- cashier - Kasir (penjualan, stok)
- admin - Administrator (semua akses)

Contoh: /role assign 628123456789 finance`,

  roleStatsGenerated: (stats) => {
    let statsText = '📊 *STATISTIK ROLE*\n\n';
    
    stats.forEach(stat => {
      statsText += `${stat.emoji} *${stat.display_name}*\n`;
      statsText += `   👥 Users: ${stat.user_count}\n`;
      statsText += `   📈 Recent: ${stat.recent_assignments} (30 hari)\n\n`;
    });
    
    return statsText;
  },

  roleStatsError: '❌ *Gagal Mengambil Statistik*\n\n🔧 Terjadi kesalahan saat mengambil data statistik role\n🔄 Silakan coba lagi'
};

// ================================
// ATTENDANCE MESSAGES
// ================================
const attendanceMessages = {
  menu: (officeLocation, officeRadius, statusInfo) => 
    `🏢 *SISTEM ABSENSI*

🏪 Kantor: ${officeLocation}
📏 Radius Valid: ${officeRadius}m
${statusInfo}

⚡ *COMMAND CEPAT:*
- \`/absen masuk\` - Langsung absen masuk
- \`/absen pulang\` - Langsung absen pulang
- \`/absen status\` - Cek status hari ini
- \`/absen rekap\` - Rekap bulanan

📝 *ATAU PILIH:*
🟢 **masuk** - Absen Masuk
🔴 **pulang** - Absen Pulang  
📊 **status** - Status Hari Ini
📋 **rekap** - Rekap Absensi

Ketik pilihan Anda:`,

  simpleMenu: `🏢 *SISTEM ABSENSI*

⚡ *COMMAND CEPAT:*
- \`/absen masuk\` - Absen masuk
- \`/absen pulang\` - Absen pulang
- \`/absen status\` - Status hari ini
- \`/absen rekap\` - Rekap bulanan

Ketik pilihan Anda:`,

  attendanceFlow: (typeText, emoji) => 
    `${emoji} *ABSEN ${typeText}*

📍 Silakan kirim lokasi Anda dengan cara:
1. Klik 📎 (attachment)
2. Pilih 📍 Location
3. Kirim lokasi terkini

⏰ Waktu akan dicatat otomatis saat lokasi diterima.`,

  validationFailed: (message, suggestion) => 
    `❌ ${message}${suggestion ? '\n\n💡 ' + suggestion : ''}`,

  systemError: '❌ Terjadi kesalahan sistem'
};

// ================================
// OCR MESSAGES
// ================================
const ocrMessages = {
  sessionExpired: '❌ Sesi OCR sudah berakhir. Ketik /ocr untuk memulai lagi.',

  invalidChoice: `❓ Pilihan tidak valid.

Ketik:
✅ **"ya"** untuk simpan
📝 **"edit"** untuk edit
❌ **"batal"** untuk batalkan`,

  sessionCancelled: '❌ Terjadi kesalahan. Sesi OCR dibatalkan.'
};

// ================================
// UTILITY FUNCTIONS
// ================================
const formatters = {
  /**
   * Format transaction success message
   */
  transactionSuccess: (transactionId, type, amount, category, description, paymentMethod, balance) => {
    const sign = type === 'income' ? '+' : '-';
    return success.transactionAdded(transactionId, sign, amount, category, description, paymentMethod, balance);
  },

  /**
   * Format quick transaction success message
   */
  quickTransactionSuccess: (transactionId, type, amount, category, description, paymentMethod, balance) => {
    const sign = type === 'income' ? '+' : '-';
    return success.quickTransactionAdded(transactionId, sign, amount, category, description, paymentMethod, balance);
  },

  /**
   * Format validation failed message with suggestion
   */
  validationWithSuggestion: (message, suggestion) => {
    let suggestionText = '';
    if (suggestion === 'pulang') {
      suggestionText = '\n\n💡 Gunakan `/absen pulang` untuk absen pulang.';
    } else if (suggestion === 'masuk') {
      suggestionText = '\n\n💡 Gunakan `/absen masuk` untuk absen masuk dulu.';
    } else if (suggestion === 'status') {
      suggestionText = '\n\n💡 Gunakan `/absen status` untuk melihat status absensi.';
    }
    return attendanceMessages.validationFailed(message, suggestionText);
  }
};

module.exports = {
  success,
  error,
  info,
  chartCaptions,
  roleMessages,
  adminMessages,
  attendanceMessages,
  ocrMessages,
  formatters,
  // Aliases untuk kemudahan akses
  MESSAGES: {
    formatBalanceInfo: (cash, bank, total) => {
      const balance = { cash, bank, total };
      return success.balanceDisplay(balance);
    },
    formatErrorDelete: error.invalidFormat.delete,
    transactionDeleted: success.transactionDeleted,
    transactionNotFound: error.transactionNotFound
  }
};
