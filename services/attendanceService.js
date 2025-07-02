const moment = require('moment');
const { logger, fileLogger } = require('../config');
const { getDB } = require('../database');

// Koordinat pusat kantor (contoh: Jakarta)
// const OFFICE_CENTER = {
//   latitude: -7.8522903888285,  // Ganti dengan koordinat kantor Anda
//   longitude: 111.4594185602312, //-7.8522903888285, 111.4594185602312
//   name: 'Alfamart Jingglong'
// };
const OFFICE_CENTER = {
  latitude: -7.877174871538191,  // Ganti dengan koordinat kantor Anda
  longitude: 111.47047801900142, //-7.877174871538191, 111.47047801900142
  name: 'RSU Muslimat Ponorogo'
};

const OFFICE_RADIUS = 300; // 300 meter

// Convert degrees to radians
function degToRad(deg) {
  return deg * (Math.PI / 180);
}

// Calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance); // Return distance in meters
}

// Check if location is within office radius
function isWithinOfficeRadius(latitude, longitude) {
  const distance = calculateDistance(
    OFFICE_CENTER.latitude,
    OFFICE_CENTER.longitude,
    latitude,
    longitude
  );
  
  return {
    isValid: distance <= OFFICE_RADIUS,
    distance: distance,
    maxDistance: OFFICE_RADIUS
  };
}

// Add attendance record
function addAttendance(userId, type, latitude, longitude, photoPath, distance) {
  return new Promise((resolve) => {
    const db = getDB();
    const now = moment();
    const query = `
      INSERT INTO attendance (user_id, type, latitude, longitude, photo_path, distance, date, time, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      userId,
      type,
      latitude,
      longitude,
      photoPath,
      distance,
      now.format('YYYY-MM-DD'),
      now.format('HH:mm:ss'),
      now.format('YYYY-MM-DD HH:mm:ss')
    ];
    
    db.run(query, values, function(err) {
      if (err) {
        logger.error('Error adding attendance', { 
          userId, 
          type, 
          error: err.message 
        });
        resolve(null);
      } else {
        const attendanceId = this.lastID;
        logger.info('Attendance recorded', { 
          attendanceId, 
          userId, 
          type,
          distance
        });
        
        fileLogger.info('attendance_recorded', {
          id: attendanceId,
          userId,
          type,
          latitude,
          longitude,
          distance,
          photoPath,
          timestamp: now.format('YYYY-MM-DD HH:mm:ss')
        });
        
        resolve(attendanceId);
      }
    });
  });
}

// Get today's attendance
function getTodayAttendance(userId) {
  return new Promise((resolve) => {
    const db = getDB();
    const today = moment().format('YYYY-MM-DD');
    const query = `
      SELECT * FROM attendance 
      WHERE user_id = ? AND date = ? 
      ORDER BY created_at DESC
    `;
    
    db.all(query, [userId, today], (err, rows) => {
      if (err) {
        logger.error('Error getting today attendance', { userId, error: err.message });
        resolve([]);
      } else {
        resolve(rows || []);
      }
    });
  });
}

// Get attendance summary for period
function getAttendanceSummary(userId, period = 'month') {
  return new Promise((resolve) => {
    const db = getDB();
    let dateFilter = '';
    const today = moment().format('YYYY-MM-DD');
    
    if (period === 'week') {
      const weekStart = moment().startOf('week').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${weekStart}'`;
    } else if (period === 'month') {
      const monthStart = moment().startOf('month').format('YYYY-MM-DD');
      dateFilter = `AND date >= '${monthStart}'`;
    }
    
    const query = `
      SELECT 
        date,
        COUNT(CASE WHEN type = 'masuk' THEN 1 END) as masuk_count,
        COUNT(CASE WHEN type = 'pulang' THEN 1 END) as pulang_count,
        MIN(CASE WHEN type = 'masuk' THEN time END) as jam_masuk,
        MAX(CASE WHEN type = 'pulang' THEN time END) as jam_pulang
      FROM attendance 
      WHERE user_id = ? ${dateFilter}
      GROUP BY date 
      ORDER BY date DESC
      LIMIT 10
    `;
    
    db.all(query, [userId], (err, rows) => {
      if (err) {
        logger.error('Error getting attendance summary', { userId, period, error: err.message });
        resolve([]);
      } else {
        resolve(rows || []);
      }
    });
  });
}

// Check today's attendance status for validation
function getTodayAttendanceStatus(userId) {
  return new Promise((resolve) => {
    const db = getDB();
    const today = moment().format('YYYY-MM-DD');
    const query = `
      SELECT type, time, created_at 
      FROM attendance 
      WHERE user_id = ? AND date = ? 
      ORDER BY created_at ASC
    `;
    
    db.all(query, [userId, today], (err, rows) => {
      if (err) {
        logger.error('Error getting today attendance status', { userId, error: err.message });
        resolve({ error: true });
      } else {
        const masuk = rows.find(r => r.type === 'masuk');
        const pulang = rows.find(r => r.type === 'pulang');
        
        resolve({
          error: false,
          hasMasuk: !!masuk,
          hasPulang: !!pulang,
          masukTime: masuk ? masuk.time : null,
          pulangTime: pulang ? pulang.time : null,
          isComplete: !!masuk && !!pulang
        });
      }
    });
  });
}

// Validate if user can do specific attendance type
async function validateAttendanceType(userId, type) {
  const status = await getTodayAttendanceStatus(userId);
  
  if (status.error) {
    return {
      valid: false,
      message: 'Gagal mengecek status absensi hari ini'
    };
  }
  
  if (type === 'masuk') {
    if (status.hasMasuk) {
      return {
        valid: false,
        message: `Anda sudah absen masuk hari ini pada ${status.masukTime}`,
        suggestion: status.hasPulang ? 'status' : 'pulang'
      };
    }
    return { valid: true };
  }
  
  if (type === 'pulang') {
    if (!status.hasMasuk) {
      return {
        valid: false,
        message: 'Anda belum absen masuk hari ini. Absen masuk dulu sebelum absen pulang.',
        suggestion: 'masuk'
      };
    }
    
    if (status.hasPulang) {
      return {
        valid: false,
        message: `Anda sudah absen pulang hari ini pada ${status.pulangTime}`,
        suggestion: 'status'
      };
    }
    
    return { valid: true };
  }
  
  return { valid: false, message: 'Tipe absensi tidak valid' };
}

// Export the new functions
module.exports = {
  OFFICE_CENTER,
  OFFICE_RADIUS,
  calculateDistance,
  isWithinOfficeRadius,
  addAttendance,
  getTodayAttendance,
  getAttendanceSummary,
  getTodayAttendanceStatus,  // New
  validateAttendanceType     // New
};