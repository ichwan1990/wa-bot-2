const Tesseract = require('tesseract.js');
const { logger, fileLogger } = require('../config');
const fs = require('fs').promises;
const path = require('path');

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  // Initialize Tesseract worker
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      logger.info('Initializing OCR worker');
      this.worker = await Tesseract.createWorker('ind+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            logger.debug('OCR Progress', { progress: Math.round(m.progress * 100) });
          }
        }
      });
      
      // Set parameters for better financial text recognition
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789.,ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -/:()',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });
      
      this.isInitialized = true;
      logger.info('OCR worker initialized successfully');
    } catch (error) {
      logger.error('Error initializing OCR worker', { error: error.message });
      throw error;
    }
  }

  // Process image and extract text
  async extractTextFromImage(imagePath) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('Starting OCR extraction', { imagePath });
      
      const { data: { text, confidence } } = await this.worker.recognize(imagePath);
      
      logger.info('OCR extraction completed', { 
        confidence: Math.round(confidence),
        textLength: text.length,
        imagePath 
      });

      // Log to file for audit
      fileLogger.info('ocr_extraction', {
        imagePath,
        confidence,
        textLength: text.length,
        extractedText: text.substring(0, 100) // First 100 chars for logging
      });

      return {
        text: text.trim(),
        confidence: Math.round(confidence)
      };
    } catch (error) {
      logger.error('Error during OCR extraction', { 
        error: error.message,
        imagePath 
      });
      throw error;
    }
  }

  // Process transaction receipt/screenshot
  async processFinancialImage(imagePath) {
    try {
      const result = await this.extractTextFromImage(imagePath);
      
      if (result.confidence < 50) {
        logger.warn('Low OCR confidence', { confidence: result.confidence });
        return {
          ...result,
          warning: 'Kualitas gambar rendah, hasil mungkin tidak akurat'
        };
      }

      // Clean and process the text for better transaction parsing
      const cleanedText = this.cleanFinancialText(result.text);
      
      return {
        ...result,
        cleanedText,
        possibleTransactions: this.findPossibleTransactions(cleanedText)
      };
    } catch (error) {
      logger.error('Error processing financial image', { 
        error: error.message,
        imagePath 
      });
      throw error;
    }
  }

  // Clean text for better parsing
  cleanFinancialText(text) {
    return text
      .replace(/[^\w\s.,\-+:()/]/g, ' ') // Remove special chars except important ones
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase()
      .trim();
  }

  // Find possible transactions in extracted text
  findPossibleTransactions(text) {
    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Look for amounts (various formats)
      const amountPatterns = [
        /rp\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi,
        /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s?(?:ribu|rb|juta|jt|rupiah)/gi,
        /(\d+(?:[.,]\d+)*)\s*(?:k|rb|ribu|jt|juta)/gi
      ];

      for (const pattern of amountPatterns) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            transactions.push({
              text: line.trim(),
              amount: match[1],
              context: this.getTransactionContext(line)
            });
          }
        }
      }
    }

    return transactions;
  }

  // Get context clues for transaction type
  getTransactionContext(text) {
    const incomeKeywords = ['terima', 'transfer masuk', 'gaji', 'pendapatan', 'income'];
    const expenseKeywords = ['bayar', 'pembayaran', 'transfer keluar', 'belanja', 'pembelian'];
    
    const lowerText = text.toLowerCase();
    
    for (const keyword of incomeKeywords) {
      if (lowerText.includes(keyword)) {
        return 'income';
      }
    }
    
    for (const keyword of expenseKeywords) {
      if (lowerText.includes(keyword)) {
        return 'expense';
      }
    }
    
    return 'unknown';
  }

  // Cleanup
  async terminate() {
    try {
      if (this.worker && this.isInitialized) {
        await this.worker.terminate();
        this.isInitialized = false;
        logger.info('OCR worker terminated');
      }
    } catch (error) {
      logger.error('Error terminating OCR worker', { error: error.message });
    }
  }
}

// Singleton instance
const ocrService = new OCRService();

module.exports = ocrService;