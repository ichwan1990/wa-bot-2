const fs = require('fs').promises;
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { logger, fileLogger } = require('../config');
const ocrService = require('../services/ocrService');
const { parseTransaction, addTransaction } = require('../services/transactionService');
const { formatCurrency } = require('../utils/formatter');
const { messageStats } = require('../utils/messageStats');
const { OCRStateManager } = require('../utils/ocrStateManager');

// Handle /ocr command
async function handleOCRCommand(sock, msg, userNumber) {
  try {
    // Set user state to waiting for image
    OCRStateManager.setWaitingForImage(userNumber);
    
    const responseText = `📸 *MODE OCR AKTIF*

🔍 Silakan kirim foto struk atau screenshot transaksi yang ingin diproses.

💡 *Tips untuk hasil terbaik:*
- Pastikan foto jelas dan tidak blur
- Cahaya cukup terang
- Teks mudah dibaca
- Fokus pada area transaksi

⏰ Mode OCR akan otomatis batal dalam 5 menit jika tidak ada foto yang dikirim.

❌ Ketik "batal" untuk membatalkan mode OCR.`;

    await sock.sendMessage(msg.key.remoteJid, { text: responseText });
    
    messageStats.commands++;
    logger.info('OCR command initiated', { userNumber });
    
  } catch (error) {
    logger.error('Error handling OCR command', { userNumber, error: error.message });
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Terjadi kesalahan saat mengaktifkan mode OCR. Coba lagi.'
    });
  }
}

// Handle image in OCR mode
async function handleOCRImage(sock, msg, userNumber) {
  try {
    const imageMessage = msg.message.imageMessage;
    if (!imageMessage) return;

    logger.info('Processing OCR image', { userNumber });

    // Download image
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    if (!buffer) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Gagal mengunduh gambar. Coba kirim ulang atau ketik /ocr untuk memulai lagi.'
      });
      OCRStateManager.clearUserState(userNumber);
      return;
    }

    // Save image temporarily
    const tempDir = './temp';
    await fs.mkdir(tempDir, { recursive: true });
    const imagePath = path.join(tempDir, `ocr_${userNumber}_${Date.now()}.jpg`);
    await fs.writeFile(imagePath, buffer);

    // Send processing message
    await sock.sendMessage(msg.key.remoteJid, {
      text: '🔍 Sedang memproses gambar dengan OCR...\n⏳ Tunggu sebentar ya!'
    });

    // Process with OCR
    const ocrResult = await ocrService.processFinancialImage(imagePath);
    
    // Clean up temp file
    try {
      await fs.unlink(imagePath);
    } catch (error) {
      logger.warn('Error deleting temp OCR image', { error: error.message });
    }

    // Show OCR results and ask for confirmation
    await showOCRResultsAndConfirm(sock, msg, userNumber, ocrResult);
    
    // Update stats
    messageStats.processed++;
    messageStats.ocrProcessed = (messageStats.ocrProcessed || 0) + 1;

  } catch (error) {
    logger.error('Error processing OCR image', { 
      userNumber, 
      error: error.message,
      stack: error.stack
    });

    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Terjadi kesalahan saat memproses gambar.\n\n' +
            '💡 Coba lagi dengan foto yang lebih jelas atau ketik /ocr untuk memulai ulang.'
    });
    
    OCRStateManager.clearUserState(userNumber);
  }
}

// Show OCR results and ask for confirmation
async function showOCRResultsAndConfirm(sock, msg, userNumber, ocrResult) {
  let responseText = `✅ *HASIL OCR SELESAI*\n\n`;
  responseText += `🎯 **Akurasi:** ${ocrResult.confidence}%\n`;
  
  if (ocrResult.warning) {
    responseText += `⚠️ ${ocrResult.warning}\n`;
  }
  
  responseText += `\n📝 **Teks yang ditemukan:**\n`;
  responseText += `\`\`\`${ocrResult.text.substring(0, 300)}\`\`\``;
  
  if (ocrResult.text.length > 300) {
    responseText += '\n_(teks dipotong...)_';
  }

  // Show possible transactions
  if (ocrResult.possibleTransactions && ocrResult.possibleTransactions.length > 0) {
    responseText += `\n\n💰 **Transaksi yang terdeteksi:**\n`;
    
    for (let i = 0; i < Math.min(ocrResult.possibleTransactions.length, 3); i++) {
      const transaction = ocrResult.possibleTransactions[i];
      responseText += `${i + 1}. ${transaction.text}\n`;
      responseText += `   💵 Jumlah: ${transaction.amount}\n`;
      responseText += `   📊 Jenis: ${transaction.context === 'income' ? 'Pemasukan' : transaction.context === 'expense' ? 'Pengeluaran' : 'Tidak diketahui'}\n\n`;
    }
    
    // Set state to waiting confirmation with data
    OCRStateManager.setWaitingForConfirmation(userNumber, ocrResult, ocrResult.possibleTransactions);
    
    responseText += `🤔 **Pilih tindakan:**\n`;
    responseText += `✅ Ketik **"ya"** atau **"simpan"** untuk menyimpan transaksi\n`;
    responseText += `📝 Ketik **"edit"** untuk edit manual sebelum simpan\n`;
    responseText += `❌ Ketik **"tidak"** atau **"batal"** untuk membatalkan\n`;
    
  } else {
    responseText += `\n\n❌ **Tidak ada transaksi yang terdeteksi**\n`;
    responseText += `💡 Anda bisa ketik manual dalam format:\n`;
    responseText += `"bayar 50rb untuk makan" atau "terima gaji 5jt"\n\n`;
    
    responseText += `🤔 **Pilih tindakan:**\n`;
    responseText += `📝 Ketik **"edit"** untuk input manual berdasarkan OCR\n`;
    responseText += `❌ Ketik **"batal"** untuk mengakhiri\n`;
    
    // Set state to waiting confirmation without transactions
    OCRStateManager.setWaitingForConfirmation(userNumber, ocrResult, []);
  }

  await sock.sendMessage(msg.key.remoteJid, { text: responseText });
}

// Handle confirmation response
async function handleOCRConfirmation(sock, msg, userNumber, text) {
  try {
    const confirmationData = OCRStateManager.getConfirmationData(userNumber);
    if (!confirmationData) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Sesi OCR sudah berakhir. Ketik /ocr untuk memulai lagi.'
      });
      return;
    }

    const lowerText = text.toLowerCase().trim();

    if (lowerText === 'ya' || lowerText === 'simpan' || lowerText === 'yes') {
      await handleSaveTransactions(sock, msg, userNumber, confirmationData);
    } else if (lowerText === 'edit') {
      await handleEditMode(sock, msg, userNumber, confirmationData);
    } else if (lowerText === 'tidak' || lowerText === 'batal' || lowerText === 'no') {
      await handleCancelOCR(sock, msg, userNumber);
    } else {
      // Invalid response
      await sock.sendMessage(msg.key.remoteJid, {
        text: '❓ Pilihan tidak valid.\n\n' +
              'Ketik:\n' +
              '✅ **"ya"** untuk simpan\n' +
              '📝 **"edit"** untuk edit\n' +
              '❌ **"batal"** untuk batalkan'
      });
    }

  } catch (error) {
    logger.error('Error handling OCR confirmation', { userNumber, error: error.message });
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Terjadi kesalahan. Sesi OCR dibatalkan.'
    });
    OCRStateManager.clearUserState(userNumber);
  }
}

// Save detected transactions
async function handleSaveTransactions(sock, msg, userNumber, confirmationData) {
  const { possibleTransactions } = confirmationData;
  
  if (!possibleTransactions || possibleTransactions.length === 0) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Tidak ada transaksi yang dapat disimpan.\n' +
            '💡 Gunakan mode edit untuk input manual.'
    });
    OCRStateManager.clearUserState(userNumber);
    return;
  }

  let savedCount = 0;
  let results = '💾 **HASIL PENYIMPANAN:**\n\n';

  for (let i = 0; i < possibleTransactions.length; i++) {
    const transaction = possibleTransactions[i];
    
    // Try to parse transaction
    const parsedTransaction = parseTransaction(transaction.text);
    
    if (parsedTransaction) {
      const transactionId = await addTransaction(userNumber, parsedTransaction);
      
      if (transactionId) {
        savedCount++;
        results += `✅ **Transaksi ${i + 1}:** Tersimpan\n`;
        results += `   💰 ${formatCurrency(parsedTransaction.amount)}\n`;
        results += `   📊 ${parsedTransaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}\n`;
        results += `   🏷️ ${parsedTransaction.category}\n\n`;
      } else {
        results += `❌ **Transaksi ${i + 1}:** Gagal disimpan\n\n`;
      }
    } else {
      results += `⚠️ **Transaksi ${i + 1}:** Format tidak valid\n\n`;
    }
  }

  results += `📊 **Total tersimpan:** ${savedCount} dari ${possibleTransactions.length} transaksi`;
  
  await sock.sendMessage(msg.key.remoteJid, { text: results });
  
  OCRStateManager.clearUserState(userNumber);
  messageStats.transactions += savedCount;
  
  logger.info('OCR transactions saved', { 
    userNumber, 
    savedCount, 
    totalDetected: possibleTransactions.length 
  });
}

// Handle edit mode
async function handleEditMode(sock, msg, userNumber, confirmationData) {
  const { ocrData } = confirmationData;
  
  let editText = `📝 **MODE EDIT MANUAL**\n\n`;
  editText += `📋 **Teks OCR sebagai referensi:**\n`;
  editText += `\`\`\`${ocrData.cleanedText || ocrData.text.substring(0, 200)}\`\`\`\n\n`;
  
  editText += `💡 **Ketik transaksi dalam format:**\n`;
  editText += `• "bayar 50rb untuk makan"\n`;
  editText += `• "terima gaji 5jt"\n`;
  editText += `• "beli bensin 100ribu"\n\n`;
  
  editText += `⚡ **Atau gunakan menu cepat:** /menu\n`;
  editText += `❌ **Ketik "batal" untuk mengakhiri**`;

  await sock.sendMessage(msg.key.remoteJid, { text: editText });
  
  OCRStateManager.clearUserState(userNumber);
  logger.info('OCR switched to edit mode', { userNumber });
}

// Handle cancel OCR
async function handleCancelOCR(sock, msg, userNumber) {
  await sock.sendMessage(msg.key.remoteJid, {
    text: '❌ **OCR dibatalkan**\n\n' +
          '💡 Ketik /ocr kapan saja untuk memulai lagi\n' +
          '⚡ Atau gunakan /menu untuk fitur lainnya'
  });
  
  OCRStateManager.clearUserState(userNumber);
  logger.info('OCR cancelled by user', { userNumber });
}

module.exports = {
  handleOCRCommand,
  handleOCRImage,
  handleOCRConfirmation
};