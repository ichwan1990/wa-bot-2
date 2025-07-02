const { logger } = require('../config');

class AttendanceStateManager {
  constructor() {
    this.states = new Map();
  }

  // Set user waiting for location
  setWaitingForLocation(userNumber, type) {
    this.states.set(userNumber, {
      step: 'waiting_location',
      type: type, // 'masuk' or 'pulang'
      timestamp: Date.now()
    });
    logger.debug('User set to waiting for location', { userNumber, type });
  }

  // Set user waiting for photo
  setWaitingForPhoto(userNumber, type, latitude, longitude, distance) {
    this.states.set(userNumber, {
      step: 'waiting_photo',
      type: type,
      latitude: latitude,
      longitude: longitude,
      distance: distance,
      timestamp: Date.now()
    });
    logger.debug('User set to waiting for photo', { userNumber, type, distance });
  }

  // Check if user is waiting for location
  isWaitingForLocation(userNumber) {
    const state = this.states.get(userNumber);
    return state && state.step === 'waiting_location';
  }

  // Check if user is waiting for photo
  isWaitingForPhoto(userNumber) {
    const state = this.states.get(userNumber);
    return state && state.step === 'waiting_photo';
  }

  // Get user state
  getUserState(userNumber) {
    return this.states.get(userNumber);
  }

  // Clear user state
  clearUserState(userNumber) {
    const cleared = this.states.delete(userNumber);
    if (cleared) {
      logger.debug('User attendance state cleared', { userNumber });
    }
    return cleared;
  }

  // Get active states count
  getActiveStatesCount() {
    return this.states.size;
  }

  // Cleanup old states (older than 10 minutes)
  cleanupOldStates() {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    let cleaned = 0;
    
    for (const [userNumber, state] of this.states.entries()) {
      if (state.timestamp < tenMinutesAgo) {
        this.states.delete(userNumber);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info('Cleaned up old attendance states', { cleaned });
    }
    
    return cleaned;
  }
}

// Create singleton instance
const attendanceStateManager = new AttendanceStateManager();

// Cleanup old states every 5 minutes
setInterval(() => {
  attendanceStateManager.cleanupOldStates();
}, 5 * 60 * 1000);

module.exports = attendanceStateManager;