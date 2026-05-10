import { v4 as uuidv4 } from 'uuid';

import {
  JOIN_SERVICE,
  LEAVE_SERVICE,
  TEXT_MESSAGE,
  VOICE_CHUNK,
  TYPING,
  ACK,
  PONG,
} from './messageTypes';

/**
 * Build a join_service frame.
 * @param {string} token - JWT token
 * @returns {{type: string, token: string}}
 */
export function buildJoinService(token) {
  return {
    type: JOIN_SERVICE,
    token,
  };
}

/**
 * Build a leave_service frame.
 * @returns {{type: string}}
 */
export function buildLeaveService() {
  return {
    type: LEAVE_SERVICE,
  };
}

/**
 * Build a text_message frame.
 * @param {string} conversationId
 * @param {string} text
 * @param {string} [replyToId]
 * @returns {{type: string, id: string, conversationId: string, content: {text: string}, replyToId?: string}}
 */
export function buildTextMessage(conversationId, text, replyToId) {
  const envelope = {
    type: TEXT_MESSAGE,
    id: uuidv4(),
    conversationId,
    content: { text },
  };
  if (replyToId) {
    envelope.replyToId = replyToId;
  }
  return envelope;
}

/**
 * Build a voice_chunk header frame.
 * @param {string} messageId
 * @param {string} conversationId
 * @param {number} sequenceNumber
 * @param {boolean} isFinal
 * @returns {{type: string, messageId: string, conversationId: string, sequenceNumber: number, isFinal: boolean}}
 */
export function buildVoiceChunk(messageId, conversationId, sequenceNumber, isFinal) {
  return {
    type: VOICE_CHUNK,
    messageId,
    conversationId,
    sequenceNumber,
    isFinal,
  };
}

/**
 * Build a typing frame.
 * @param {string} conversationId
 * @param {boolean} isTyping
 * @returns {{type: string, conversationId: string, isTyping: boolean}}
 */
export function buildTyping(conversationId, isTyping) {
  return {
    type: TYPING,
    conversationId,
    isTyping,
  };
}

/**
 * Build an ack frame.
 * @param {string} messageId
 * @returns {{type: string, messageId: string}}
 */
export function buildAck(messageId) {
  return {
    type: ACK,
    messageId,
  };
}

/**
 * Build a pong frame.
 * @returns {{type: string}}
 */
export function buildPong() {
  return {
    type: PONG,
  };
}

/**
 * Build a file_attachment frame.
 * @param {string} conversationId
 * @param {string} blobId
 * @param {string} fileName
 * @param {string} mimeType
 * @param {number} sizeBytes
 * @param {number} [durationMs]
 * @param {string} [replyToId]
 * @returns {{type: string, id: string, conversationId: string, content: object, replyToId?: string}}
 */
export function buildFileAttachment(conversationId, blobId, fileName, mimeType, sizeBytes, durationMs, replyToId) {
  const envelope = {
    type: TEXT_MESSAGE,
    id: uuidv4(),
    conversationId,
    content: {
      blobId,
      fileName,
      mimeType,
      sizeBytes,
    },
  };
  if (durationMs) {
    envelope.content.durationMs = durationMs;
  }
  if (replyToId) {
    envelope.replyToId = replyToId;
  }
  return envelope;
}
