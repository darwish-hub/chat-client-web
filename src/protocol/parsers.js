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
 * Normalizes server-specific field names to the client's expected format.
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

    // Normalize server message formats to client-expected shapes
    if (frame.type === MESSAGE_RECEIVED && frame.envelope) {
      const env = frame.envelope;
      return {
        ...frame,
        id: env.id,
        conversationId: env.conversationId,
        serviceId: env.serviceId,
        fromUserId: env.senderId,
        fromUserName: env.senderId,
        messageType: env.type,
        text: env.text,
        attachment: env.attachment,
        content: env.text
          ? { text: env.text }
          : env.attachment
            ? {
                blobId: env.attachment.blobId,
                fileName: env.attachment.fileName,
                mimeType: env.attachment.mimeType,
                sizeBytes: env.attachment.sizeBytes,
                durationMs: env.attachment.durationMs,
              }
            : {},
        replyToId: env.replyToId,
        createdAt: env.createdAt,
      };
    }

    if (frame.type === USER_JOINED && frame.displayName !== undefined) {
      return { ...frame, userName: frame.displayName };
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
    case DELIVERED:
      return typeof frame.messageId === 'string';
    case TYPING:
      return typeof frame.conversationId === 'string' && typeof frame.userId === 'string' && typeof frame.isTyping === 'boolean';
    case ERROR:
      return typeof frame.code === 'string' && typeof frame.message === 'string';
    default:
      console.warn('[Parser] Unknown frame type:', frame.type);
      return false;
  }
}
