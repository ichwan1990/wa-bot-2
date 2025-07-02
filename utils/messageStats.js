const { logger } = require('../config');

// Message counters for monitoring
const messageStats = {
  total: 0,
  processed: 0,
  ignored: {
    groups: 0,
    broadcasts: 0,
    unauthorized: 0,
    nonPrivate: 0
  },
  commands: 0,
  transactions: 0,
  quickMenuUsage: 0,
  chartsGenerated: 0,
  ocrProcessed: 0  // Add OCR counter
};

// Log stats every hour
setInterval(() => {
  logger.info('Hourly message statistics', messageStats);
}, 60 * 60 * 1000);

// Get stats text
function getStatsText() {
  return `📊 **BOT STATISTICS**

📨 Total Messages: ${messageStats.total}
✅ Processed: ${messageStats.processed}
🚫 Ignored: ${messageStats.ignored.groups + messageStats.ignored.broadcasts + messageStats.ignored.unauthorized + messageStats.ignored.nonPrivate}

💬 Commands: ${messageStats.commands}
💰 Transactions: ${messageStats.transactions}
📊 Charts Generated: ${messageStats.chartsGenerated}
🔍 OCR Processed: ${messageStats.ocrProcessed}
⚡ Quick Menu Usage: ${messageStats.quickMenuUsage}

🕐 Last Reset: Server restart`;
}

module.exports = {
  messageStats,
  getStatsText
};