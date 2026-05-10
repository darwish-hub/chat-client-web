/**
 * Message type constants for the ChatHub WebSocket protocol.
 * Source of truth: specs/002-web-test-client/contracts/websocket-protocol.md
 */

// Client → Server
export const JOIN_SERVICE = 'join_service';
export const LEAVE_SERVICE = 'leave_service';
export const TEXT_MESSAGE = 'text_message';
export const VOICE_CHUNK = 'voice_chunk';
export const TYPING = 'typing';
export const ACK = 'ack';
export const PONG = 'pong';

// Server → Client
export const PING = 'ping';
export const USER_JOINED = 'user_joined';
export const USER_LEFT = 'user_left';
export const MESSAGE_RECEIVED = 'message_received';
export const DELIVERED = 'delivered';
export const ERROR = 'error';

export const CLIENT_MESSAGE_TYPES = [
  JOIN_SERVICE,
  LEAVE_SERVICE,
  TEXT_MESSAGE,
  VOICE_CHUNK,
  TYPING,
  ACK,
  PONG,
];

export const SERVER_MESSAGE_TYPES = [
  PING,
  USER_JOINED,
  USER_LEFT,
  MESSAGE_RECEIVED,
  DELIVERED,
  TYPING,
  ERROR,
];
