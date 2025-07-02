const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { logger, fileLogger, createDirectories, adminNumbers } = require('./config');
const { initDB, closeDB } = require('./database');
const { handleMessage } = require('./handlers/messageHandler');
const { cleanupCharts } = require('./services/chartService');

// Global variables
let sock;

// Connect to WhatsApp
async function connectToWhatsApp() {
  try {
    logger.info('Setting up WhatsApp connection');
    
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    
    sock = makeWASocket({
      auth: state,
      browser: ['Financial Bot', 'Chrome', '1.0.0'],
      logger: logger.child({ module: 'baileys' })
    });
    
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('\n📱 SCAN QR CODE untuk connect WhatsApp:');
        console.log('   1. Buka WhatsApp di HP');
        console.log('   2. Pilih Menu > WhatsApp Web');
        console.log('   3. Scan QR code di bawah:\n');
        qrcode.generate(qr, { small: true });
        logger.info('QR code generated for WhatsApp connection');
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        const reason = lastDisconnect?.error?.output?.statusCode;
        
        logger.warn('WhatsApp connection closed', { 
          shouldReconnect, 
          reason,
          statusCode: reason 
        });
        
        if (shouldReconnect) {
          logger.info('Attempting to reconnect in 5 seconds');
          console.log('🔄 Koneksi terputus, mencoba reconnect...');
          setTimeout(connectToWhatsApp, 5000);
        } else {
          logger.error('Bot logged out from WhatsApp');
          console.log('❌ Bot logout, silakan restart dan scan QR lagi');
        }
      } else if (connection === 'open') {
        logger.info('WhatsApp connection established successfully');
        console.log('\n🎉 WhatsApp berhasil terhubung!');
        console.log('🤖 Bot siap menerima pesan');
        console.log('👥 Admin numbers:', adminNumbers.join(', '));
        console.log('📊 Fitur grafik aktif - QuickChart API + Text fallback');
        console.log('💬 Kirim "/menu" untuk akses cepat atau "/help" untuk bantuan lengkap\n');
        
        // Log to file
        fileLogger.info('whatsapp_connected', { 
          adminNumbers: adminNumbers.length,
          timestamp: new Date().toISOString(),
          features: ['quickchart_api', 'text_charts', 'quick_menu']
        });
      } else if (connection === 'connecting') {
        logger.info('Connecting to WhatsApp...');
        console.log('🔄 Menghubungkan ke WhatsApp...');
      }
    });
    
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', (m) => handleMessage(sock, m));
    
  } catch (error) {
    logger.error('WhatsApp connection error', { 
      error: error.message,
      stack: error.stack
    });
    console.error('❌ Connection error:', error.message);
    
    logger.info('Retrying connection in 10 seconds');
    setTimeout(connectToWhatsApp, 10000);
  }
}

// Start the bot
console.log('🚀 Starting Financial Bot with Windows-Compatible Charts...');
logger.info('Financial Bot starting up', { 
  nodeVersion: process.version,
  platform: process.platform,
  adminCount: adminNumbers.length,
  features: ['quickchart_api', 'text_fallback', 'windows_compatible']
});

// Create necessary directories
createDirectories();

// Initialize database
initDB();

// Connect to WhatsApp
connectToWhatsApp();

// Handle shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  console.log('\n🛑 Shutting down...');
  
  // Clean up chart files
  try {
    cleanupCharts();
    logger.info('Chart cleanup completed');
  } catch (error) {
    logger.error('Error during chart cleanup', { error: error.message });
  }
  
  closeDB((err) => {
    if (err) {
      logger.error('Error during shutdown', { error: err.message });
    }
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', { 
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { 
    reason: reason?.message || reason,
    promise: promise.toString()
  });
});