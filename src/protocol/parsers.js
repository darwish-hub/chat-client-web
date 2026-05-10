import {
  PING,
  USER_JOINED,
  USER_LEFT,
  MESSAGE_RECEIVED,
  DELIVERED,
  TYPING,
  ERROR,
} from './messageTypes';

/**
 * Parse an incoming JSON text frame.
 * @param {string} jsonString
 * @returns {object|null} Parsed frame or null if invalid.
 */
export function parseTextFrame(jsonString) {
  try {
    const frame = JSON.parse(jsonString);
    if (!frame.type) {
      console.warn('[Parser] Frame missing type:', frame);
      return null;
    }
    return frame;
  } catch (err) {
    console.warn('[Parser] Invalid JSON frame:', err.message);
    return null;
  }
}

/**
 * Parse a binary frame (raw ArrayBuffer for voice audio).
 * @param {ArrayBuffer} buffer
 * @returns {{data: ArrayBuffer, timestamp: number}}
 */
export function parseBinaryFrame(buffer) {
  return {
    data: buffer,
    timestamp: Date.now(),
  };
}

/**
 * Validate a server-to-client frame shape.
 * @param {object} frame
 * @returns {boolean}
 */
export function validateServerFrame(frame) {
  if (!frame || typeof frame !== 'object') return false;

  switch (frame.type) {
    case PING:
      return true;
    case USER_JOINED:
      return typeof frame.userId === 'string' && typeof frame.userName === 'string' && typeof frame.serviceId === 'string';
    case USER_LEFT:
      return typeof frame.userId === 'string' && typeof frame.serviceId === 'string';
    case MESSAGE_RECEIVED:
      return (
        typeof frame.id === 'string' &&
        typeof frame.conversationId === 'string' &&
        typeof frame.fromUserId === 'string' &&
        typeof frame.fromUserName === 'string' &&
        typeof frame.type === 'string' &&
        typeof frame.content === 'object' &&
        typeof frame.createdAt === 'string'
      );
    case DELIVERED:
      return typeof frame.messageId === 'string' && typeof frame.conversationId === 'string' && typeof frame.deliveredAt === 'string';
    case TYPING:
      return typeof frame.conversationId === 'string' && typeof frame.userId === 'string' && typeof frame.isTyping === 'boolean';
    case ERROR:
      return typeof frame.code === 'string' && typeof frame.message === 'string';
    default:
      console.warn('[Parser] Unknown frame type:', frame.type);
      return false;
  }
}
