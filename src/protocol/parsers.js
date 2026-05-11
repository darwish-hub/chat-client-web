import {
  PING,
  USER_JOINED,
  USER_LEFT,
  MESSAGE_RECEIVED,
  VOICE_CHUNK,
  DELIVERED,
  TYPING,
  ERROR,
} from './messageTypes';

/**
 * Parse an incoming JSON text frame.
 * Unwraps server-specific envelope structures and normalizes
 * field names to match the data model (e.g., senderId, displayName, flat text).
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

    if (frame.type === MESSAGE_RECEIVED && frame.envelope) {
      const env = frame.envelope;
      return {
        type: MESSAGE_RECEIVED,
        id: env.id,
        conversationId: env.conversationId,
        serviceId: env.serviceId,
        senderId: env.senderId,
        messageType: env.type,
        text: env.text || null,
        attachment: env.attachment || null,
        replyToId: env.replyToId || null,
        createdAt: env.createdAt,
      };
    }

    if (frame.type === USER_JOINED) {
      return {
        type: USER_JOINED,
        userId: frame.userId,
        serviceId: frame.serviceId,
        displayName: frame.displayName,
      };
    }

    if (frame.type === VOICE_CHUNK) {
      return {
        type: VOICE_CHUNK,
        id: frame.id,
        conversationId: frame.conversationId,
        sequenceNumber: frame.sequenceNumber,
        isFinal: frame.isFinal,
        fromUserId: frame.fromUserId,
      };
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
 * Returns true if the frame has the required fields for its type.
 * Malformed frames should be logged and discarded without disconnecting.
 * @param {object} frame
 * @returns {boolean}
 */
export function validateServerFrame(frame) {
  if (!frame || typeof frame !== 'object') return false;

  switch (frame.type) {
    case PING:
      return true;
    case USER_JOINED:
      return typeof frame.userId === 'string' && typeof frame.displayName === 'string' && typeof frame.serviceId === 'string';
    case USER_LEFT:
      return typeof frame.userId === 'string' && typeof frame.serviceId === 'string';
    case MESSAGE_RECEIVED:
      return (
        frame.envelope &&
        typeof frame.envelope.id === 'string' &&
        typeof frame.envelope.conversationId === 'string' &&
        typeof frame.envelope.senderId === 'string' &&
        typeof frame.envelope.type === 'string' &&
        typeof frame.envelope.createdAt === 'string'
      );
    case VOICE_CHUNK:
      return (
        typeof frame.id === 'string' &&
        typeof frame.conversationId === 'string' &&
        typeof frame.sequenceNumber === 'number' &&
        typeof frame.isFinal === 'boolean' &&
        typeof frame.fromUserId === 'string'
      );
    case DELIVERED:
      return typeof frame.messageId === 'string';
    case TYPING:
      return typeof frame.conversationId === 'string' && typeof frame.userId === 'string' && typeof frame.isTyping === 'boolean';
    case ERROR:
      return typeof frame.code === 'string' && typeof frame.message === 'string';
    default:
      console.warn('[Parser] Unknown frame type in validation:', frame.type);
      return false;
  }
}