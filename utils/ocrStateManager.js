const { logger } = require('../config');

// Store user OCR states
const userStates = new Map();

// OCR states
const OCR_STATES = {
  WAITING_IMAGE: 'waiting_image',
  WAITING_CONFIRMATION: 'waiting_confirmation',
  IDLE: 'idle'
};

class OCRStateManager {
  // Set user in waiting for image state
  setWaitingForImage(userId) {
    userStates.set(userId, {
      state: OCR_STATES.WAITING_IMAGE,
      timestamp: Date.now()
    });
    logger.debug('User set to waiting for image', { userId });
  }

  // Set user in waiting for confirmation with OCR data
  setWaitingForConfirmation(userId, ocrData, possibleTransactions) {
    userStates.set(userId, {
      state: OCR_STATES.WAITING_CONFIRMATION,
      timestamp: Date.now(),
      ocrData,
      possibleTransactions
    });
    logger.debug('User set to waiting for confirmation', { userId });
  }

  // Get user state
  getUserState(userId) {
    const state = userStates.get(userId);
    if (!state) return { state: OCR_STATES.IDLE };
    
    // Check if state is expired (5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - state.timestamp > fiveMinutes) {
      this.clearUserState(userId);
      return { state: OCR_STATES.IDLE };
    }
    
    return state;
  }

  // Clear user state
  clearUserState(userId) {
    userStates.delete(userId);
    logger.debug('User state cleared', { userId });
  }

  // Check if user is waiting for image
  isWaitingForImage(userId) {
    const state = this.getUserState(userId);
    return state.state === OCR_STATES.WAITING_IMAGE;
  }

  // Check if user is waiting for confirmation
  isWaitingForConfirmation(userId) {
    const state = this.getUserState(userId);
    return state.state === OCR_STATES.WAITING_CONFIRMATION;
  }

  // Get confirmation data
  getConfirmationData(userId) {
    const state = this.getUserState(userId);
    if (state.state === OCR_STATES.WAITING_CONFIRMATION) {
      return {
        ocrData: state.ocrData,
        possibleTransactions: state.possibleTransactions
      };
    }
    return null;
  }

  // Get all active states (for monitoring)
  getActiveStatesCount() {
    return userStates.size;
  }
}

module.exports = {
  OCRStateManager: new OCRStateManager(),
  OCR_STATES
};