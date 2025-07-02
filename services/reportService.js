const moment = require("moment");
const { formatCurrency } = require("../utils/formatter");

// Generate report (updated)
function generateReport(transactions, period) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;

  let report = `📊 *LAPORAN ${period.toUpperCase()}*\n\n`;
  report += `💰 Pemasukan: ${formatCurrency(income)}\n`;
  report += `💸 Pengeluaran: ${formatCurrency(expense)}\n`;
  report += `📈 Saldo: ${formatCurrency(balance)}\n\n`;

  if (transactions.length > 0) {
    report += `📝 *Transaksi (${transactions.length}):*\n`;
    transactions.slice(0, 5).forEach((t, i) => {
      const sign = t.type === "income" ? "+" : "-";
      const date = moment(t.date).format("DD/MM");
      report += `${i + 1}. [${date}] #${t.id} ${sign}${formatCurrency(
        t.amount
      )}\n`;
      report += `   📂 ${t.category} - ${t.description.substring(0, 25)}${
        t.description.length > 25 ? "..." : ""
      }\n`;
    });

    if (transactions.length > 5) {
      report += `\n...dan ${transactions.length - 5} transaksi lainnya`;
    }
  }

  return report;
}

// Generate category report
function generateCategoryReport(categoryData, category, period) {
  if (categoryData.length === 0) {
    return `📂 *LAPORAN KATEGORI: ${category}*
📅 Periode: ${period.toUpperCase()}

📝 Tidak ada transaksi untuk kategori ini dalam periode ${period}.`;
  }

  const totalAmount = categoryData.reduce((sum, t) => sum + t.amount, 0);
  const avgAmount = totalAmount / categoryData.length;
  const maxAmount = Math.max(...categoryData.map((t) => t.amount));
  const minAmount = Math.min(...categoryData.map((t) => t.amount));

  const type = categoryData[0].type;
  const typeIcon = type === "income" ? "💰" : "💸";
  const typeText = type === "income" ? "PEMASUKAN" : "PENGELUARAN";

  let report = `📂 *LAPORAN KATEGORI: ${category}*
📅 Periode: ${period.toUpperCase()}
${typeIcon} Jenis: ${typeText}

📊 *Ringkasan:*
• Total Transaksi: ${categoryData.length}
• Total Amount: ${formatCurrency(totalAmount)}
• Rata-rata: ${formatCurrency(avgAmount)}
• Tertinggi: ${formatCurrency(maxAmount)}
• Terendah: ${formatCurrency(minAmount)}

📝 *Transaksi Terakhir (${Math.min(categoryData.length, 5)}):*`;

  categoryData.slice(0, 5).forEach((t, i) => {
    const date = moment(t.date).format("DD/MM");
    const sign = t.type === "income" ? "+" : "-";
    report += `\n${i + 1}. [${date}] ${sign}${formatCurrency(t.amount)}`;
    report += `\n   📝 ${t.description.substring(0, 40)}${
      t.description.length > 40 ? "..." : ""
    }`;
  });

  if (categoryData.length > 5) {
    report += `\n\n...dan ${categoryData.length - 5} transaksi lainnya`;
  }

  return report;
}

// Generate category summary report
function generateCategorySummaryReport(summaryData, period) {
  if (summaryData.length === 0) {
    return `📊 *RINGKASAN KATEGORI ${period.toUpperCase()}*

📝 Tidak ada transaksi dalam periode ini.`;
  }

  // Separate income and expense
  const incomeData = summaryData.filter((s) => s.type === "income");
  const expenseData = summaryData.filter((s) => s.type === "expense");

  const totalIncome = incomeData.reduce((sum, s) => sum + s.total, 0);
  const totalExpense = expenseData.reduce((sum, s) => sum + s.total, 0);

  let report = `📊 *RINGKASAN KATEGORI ${period.toUpperCase()}*

💰 Total Pemasukan: ${formatCurrency(totalIncome)}
💸 Total Pengeluaran: ${formatCurrency(totalExpense)}
📈 Net: ${formatCurrency(totalIncome - totalExpense)}`;

  if (expenseData.length > 0) {
    report += `\n\n💸 *TOP PENGELUARAN:*`;
    expenseData.slice(0, 5).forEach((s, i) => {
      const percentage =
        totalExpense > 0 ? Math.round((s.total / totalExpense) * 100) : 0;
      report += `\n${i + 1}. ${s.category}: ${formatCurrency(
        s.total
      )} (${percentage}%)`;
      report += `\n   📊 ${s.count}x transaksi • Avg: ${formatCurrency(
        s.average
      )}`;
    });
  }

  if (incomeData.length > 0) {
    report += `\n\n💰 *SUMBER PEMASUKAN:*`;
    incomeData.slice(0, 3).forEach((s, i) => {
      const percentage =
        totalIncome > 0 ? Math.round((s.total / totalIncome) * 100) : 0;
      report += `\n${i + 1}. ${s.category}: ${formatCurrency(
        s.total
      )} (${percentage}%)`;
      report += `\n   📊 ${s.count}x transaksi • Avg: ${formatCurrency(
        s.average
      )}`;
    });
  }

  return report;
}

function generateQuickMenu() {
  return `🚀 *MENU CEPAT FINANSIAL*

💰 *KEUANGAN:*
1️⃣ Saldo Hari Ini (/saldo)
2️⃣ Laporan Bulan (/bulan)  
3️⃣ Kategori Pengeluaran (/kategori)

📊 *GRAFIK:*
4️⃣ Grafik Trend (/chart)
5️⃣ Pie Chart (/pie)
6️⃣ Perbandingan 3 Bulan (/compare)

⚡ *INPUT CEPAT:*
7️⃣ Makan (m [jumlah])
8️⃣ Transport (t [jumlah])
9️⃣ Gaji (g [jumlah])
0️⃣ Hapus Transaksi (/hapus)

🏢 *ABSENSI CEPAT:*
- /absen masuk - Langsung absen masuk
- /absen pulang - Langsung absen pulang
- /absen status - Cek status hari ini

🔍 *LAINNYA:*
/ocr - Scan foto struk
/help - Panduan lengkap

Ketik angka atau command langsung!`;
}

function getHelpText() {
  return `📖 *PANDUAN BOT FINANSIAL*

💰 *TRANSAKSI:*
- Bayar makan 25000
- Terima gaji 5jt
- m 25rb (makan cepat)
- t 15000 (transport cepat)
- g 5jt (gaji cepat)

📊 *LAPORAN:*
- /saldo - Saldo hari ini
- /bulan - Laporan bulan ini
- /kategori - Summary kategori
- /chart - Grafik trend
- /pie - Pie chart pengeluaran
- /compare - Perbandingan 3 bulan

🏢 *ABSENSI CEPAT:*
- /absen masuk - Langsung absen masuk
- /absen pulang - Langsung absen pulang
- /absen status - Cek status hari ini
- /absen rekap - Rekap bulanan
- /absen - Menu lengkap

📍 Radius valid: 300m dari kantor
📸 Perlu foto selfie untuk konfirmasi

🔍 *UTILITAS:*
- /ocr - Scan struk belanja
- /hapus [ID] - Hapus transaksi
- /menu - Menu pilihan cepat
- /stats - Statistik penggunaan

Contoh lengkap: "bayar makan siang 25000" atau "m 25rb"`;
}

module.exports = {
  generateReport,
  generateCategoryReport,
  generateCategorySummaryReport,
  generateQuickMenu,
  getHelpText,
};
