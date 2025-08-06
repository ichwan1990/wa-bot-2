# Sistem Manajemen Pesan WhatsApp Bot

## Overview
Sistem pesan telah direfaktor untuk meningkatkan konsistensi, maintainability, dan user experience. Semua template pesan sekarang tersentralisasi dalam module `utils/messages.js`.

## Struktur Module Messages

### 1. Success Messages (`success`)
Pesan-pesan untuk konfirmasi keberhasilan operasi:
- `transactionAdded()` - Konfirmasi transaksi berhasil ditambahkan
- `quickTransactionAdded()` - Konfirmasi transaksi cepat berhasil ditambahkan
- `transactionDeleted()` - Konfirmasi transaksi berhasil dihapus
- `whitelistAdded()` / `whitelistRemoved()` - Konfirmasi manajemen whitelist
- `chartGenerating` - Pesan loading saat membuat grafik
- `imageReceived` / `locationReceived` - Konfirmasi penerimaan media

### 2. Error Messages (`error`)
Pesan-pesan untuk berbagai jenis error:
- `systemError` - Error umum sistem
- `transactionFailed` - Gagal menambahkan transaksi
- `accessDenied` - Akses ditolak
- `invalidFormat` - Format command salah
- `parseMessageFailed` - Gagal memahami pesan natural language

### 3. Info/Help Messages (`info`)
Pesan-pesan informasi dan bantuan:
- `quickCommands` - Panduan penggunaan quick commands
- `whitelistInfo()` - Informasi whitelist

### 4. Chart Captions (`chartCaptions`)
Template caption untuk berbagai jenis grafik:
- `lineChart()` - Caption untuk line chart
- `lineChartPeriod()` - Caption untuk line chart dengan periode
- `pieChart()` - Caption untuk pie chart
- `barChart()` - Caption untuk bar chart comparison

### 5. Role-based Messages (`roleMessages`)
Pesan-pesan khusus sistem role:
- `noRole()` - User belum memiliki role
- `commandNotAvailable()` - Command tidak tersedia untuk role
- `welcome()` - Pesan selamat datang dengan role
- `unregisteredUser()` - User belum terdaftar

### 6. Admin Messages (`adminMessages`)
Pesan-pesan khusus admin:
- `roleNotFound()` - Role tidak ditemukan
- `userNotFound()` - User tidak ditemukan
- `roleAssigned()` / `roleRemoved()` - Konfirmasi manajemen role

### 7. Attendance Messages (`attendanceMessages`)
Pesan-pesan sistem absensi:
- `menu()` - Menu absensi
- `attendanceFlow()` - Flow absen masuk/pulang
- `validationFailed()` - Validasi gagal

### 8. OCR Messages (`ocrMessages`)
Pesan-pesan sistem OCR:
- `sessionExpired` - Sesi OCR berakhir
- `invalidChoice` - Pilihan tidak valid
- `sessionCancelled` - Sesi dibatalkan

### 9. Formatters (`formatters`)
Utility functions untuk formatting:
- `transactionSuccess()` - Format pesan transaksi berhasil
- `quickTransactionSuccess()` - Format pesan transaksi cepat berhasil
- `validationWithSuggestion()` - Format pesan validasi dengan saran

## Cara Penggunaan

### Import Module
```javascript
const { 
  success, 
  error, 
  info, 
  chartCaptions, 
  formatters 
} = require('../utils/messages');
```

### Contoh Penggunaan

#### 1. Pesan Success
```javascript
// Transaksi berhasil
await sock.sendMessage(sender, { 
  text: formatters.transactionSuccess(id, type, amount, category, description) 
});

// Whitelist berhasil ditambah
await sock.sendMessage(sender, { 
  text: success.whitelistAdded(phoneNumber) 
});
```

#### 2. Pesan Error
```javascript
// Error sistem
await sock.sendMessage(sender, { text: error.systemError });

// Format invalid
await sock.sendMessage(sender, { text: error.invalidFormat.delete });
```

#### 3. Chart Captions
```javascript
// Line chart dengan net calculation
const caption = chartCaptions.lineChart(
  formatCurrency(income), 
  formatCurrency(expense), 
  formatCurrency(income - expense)
);
```

#### 4. Role-based Messages
```javascript
// Command tidak tersedia untuk role
await sock.sendMessage(sender, { 
  text: roleMessages.commandNotAvailable(command, roleEmoji, roleDisplayName)
});
```

## Keuntungan Sistem Baru

### 1. Konsistensi
- Semua pesan menggunakan emoji dan format yang konsisten
- Template yang seragam untuk jenis pesan yang sama

### 2. Maintainability
- Perubahan pesan hanya perlu dilakukan di satu tempat
- Mudah menambah pesan baru
- Struktur yang jelas dan terorganisir

### 3. Reusability
- Template dapat digunakan kembali di berbagai handler
- Function yang dapat dikustomisasi dengan parameter

### 4. Internationalization Ready
- Struktur yang mendukung multi-bahasa di masa depan
- Pemisahan logic dan content

### 5. Type Safety
- Parameter yang jelas untuk setiap function
- Dokumentasi lengkap untuk setiap template

## Best Practices

### 1. Naming Convention
- Gunakan camelCase untuk property names
- Gunakan descriptive names yang menjelaskan fungsi pesan

### 2. Parameter Order
- Parameter wajib di awal
- Parameter opsional di akhir
- Gunakan destructuring untuk multiple parameters

### 3. Template Organization
- Grup pesan berdasarkan fungsi/modul
- Pisahkan static messages dan dynamic functions

### 4. Error Handling
- Selalu ada fallback message untuk error cases
- Consistent error message format

### 5. Testing
- Test semua template dengan berbagai input
- Verify emoji rendering dan formatting

## Migration Guide

### Dari Hardcoded Messages
```javascript
// SEBELUM
await sock.sendMessage(sender, { 
  text: '❌ Terjadi kesalahan sistem' 
});

// SESUDAH
await sock.sendMessage(sender, { 
  text: error.systemError 
});
```

### Dari Inline String Formatting
```javascript
// SEBELUM
const response = `✅ *Transaksi Ditambahkan*
📄 ID: #${transactionId}
💰 ${sign}${formatCurrency(amount)}
📂 ${category}
📝 ${description}`;

// SESUDAH
const response = formatters.transactionSuccess(
  transactionId, type, formatCurrency(amount), category, description
);
```

## Future Enhancements

1. **Multi-language Support**: Template untuk berbagai bahasa
2. **Dynamic Content**: Integration dengan database untuk custom messages
3. **Message Analytics**: Tracking penggunaan template
4. **A/B Testing**: Testing berbagai versi pesan
5. **Rich Media**: Support untuk gambar, audio, video dalam template
