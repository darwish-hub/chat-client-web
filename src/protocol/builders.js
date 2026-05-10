import { v4 as uuidv4 } from 'uuid';

import {
  JOIN_SERVICE,
  LEAVE_SERVICE,
  TEXT_MESSAGE,
  VOICE_CHUNK,
  FILE_ATTACHMENT,
  TYPING,
  ACK,
  PONG,
} from './messageTypes';

/**
 * Build a join_service frame.
 * @param {string} serviceId - Service identifier
 * @returns {{type: string, serviceId: string}}
 */
export function buildJoinService(serviceId) {
  return {
    type: JOIN_SERVICE,
    serviceId,
  };
}

/**
 * Build a leave_service frame.
 * @param {string} serviceId - Service identifier
 * @returns {{type: string, serviceId: string}}
 */
export function buildLeaveService(serviceId) {
  return {
    type: LEAVE_SERVICE,
    serviceId,
  };
}

/**
 * Build a text_message frame.
 * @param {string} conversationId
 * @param {string} serviceId
 * @param {string} text
 * @param {string} [replyToId]
 * @returns {{type: string, id: string, conversationId: string, serviceId: string, text: string, replyToId?: string}}
 */
export function buildTextMessage(conversationId, serviceId, text, replyToId) {
  const envelope = {
    type: TEXT_MESSAGE,
    id: uuidv4(),
    conversationId,
    serviceId,
    text,
  };
  if (replyToId) {
    envelope.replyToId = replyToId;
  }
  return envelope;
}

/**
 * Build a voice_chunk header frame.
 * @param {string} id
 * @param {string} conversationId
 * @param {number} sequenceNumber
 * @param {boolean} isFinal
 * @returns {{type: string, id: string, conversationId: string, sequenceNumber: number, isFinal: boolean}}
 */
export function buildVoiceChunk(id, conversationId, sequenceNumber, isFinal) {
  return {
    type: VOICE_CHUNK,
    id,
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
 * @returns {{type: string, id: string, conversationId: string, blobId: string, fileName: string, mimeType: string, sizeBytes: number, durationMs?: number, replyToId?: string}}
 */
export function buildFileAttachment(conversationId, blobId, fileName, mimeType, sizeBytes, durationMs, replyToId) {
  const envelope = {
    type: FILE_ATTACHMENT,
    id: uuidv4(),
    conversationId,
    blobId,
    fileName,
    mimeType,
    sizeBytes,
  };
  if (durationMs) {
    envelope.durationMs = durationMs;
  }
  if (replyToId) {
    envelope.replyToId = replyToId;
  }
  return envelope;
}
