import { WS_URL, RECONNECT_DELAY_MS, MAX_RECONNECT_DELAY_MS, HEARTBEAT_TIMEOUT_MS } from '../config';
import { sendQueue } from './sendQueue';
import { HeartbeatManager } from './heartbeat';
import { parseTextFrame, parseBinaryFrame, validateServerFrame } from '../protocol/parsers';
import { PING, USER_JOINED, USER_LEFT, ERROR, MESSAGE_RECEIVED, VOICE_CHUNK, DELIVERED, TYPING } from '../protocol/messageTypes';

/**
 * WebSocket client wrapper with reconnection, heartbeat, and serialized sends.
 */
export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeat = null;
    this.listeners = new Map();
    this.currentServiceId = null;
  }

  get queueDepth() {
    return sendQueue.depth;
  }

  /**
   * Connect to the WebSocket server.
   * @param {string} token - JWT token
   * @returns {Promise<void>}
   */
  connect(token, { isReconnect = false } = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
        }
        reject(new Error('WebSocket connection timed out'));
      }, 10000);
      const cleanupTimeout = () => clearTimeout(timeout);

      this.token = token;

      try {
        this.ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
        return;
      }

      let settled = false;
      const settle = (fn) => (...args) => {
        if (settled) return;
        settled = true;
        fn(...args);
      };

      this.ws.onopen = () => {
        cleanupTimeout();
        this.reconnectAttempts = 0;

        if (!this.heartbeat) {
          this.heartbeat = new HeartbeatManager(this);
        }
        this.heartbeat.start();

        if (isReconnect) {
          this.emit('reconnect');
        }
        this.emit('open');
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const frame = parseTextFrame(event.data);
          if (!frame) {
            console.warn('[WebSocket] Failed to parse text frame');
            return;
          }
          if (!validateServerFrame(frame)) {
            console.warn('[WebSocket] Invalid frame structure, discarding:', frame.type, frame);
            this.emit('protocol_log', { direction: 'in', type: 'invalid', data: frame, timestamp: Date.now() });
            return;
          }
          this.handleFrame(frame);
          this.emit('message', frame);
        } else if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          this.handleBinary(event.data);
        }
      };

      this.ws.onclose = (event) => {
        cleanupTimeout();
        this.cleanup();
        this.emit('close', event);
        if (!settled) {
          settled = true;
          reject(new Error(`WebSocket closed before connected (code: ${event.code})`));
        }
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        cleanupTimeout();
        this.emit('error', error);
        settle(reject)(error);
      };
    });
  }

  /**
   * Send a JSON text frame.
   * @param {object} json
   * @returns {Promise<void>}
   */
  async send(json) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    const text = JSON.stringify(json);
    await sendQueue.enqueue(this.ws, text);
  }

  /**
   * Send a binary frame.
   * @param {ArrayBuffer} data
   * @returns {Promise<void>}
   */
  async sendBinary(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    await sendQueue.enqueue(this.ws, data);
  }

  /**
   * Close the WebSocket connection gracefully.
   */
  close() {
    this.clearReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Client closed');
    }
    this.cleanup();
  }

  /**
   * Force close the WebSocket without sending leave_service
   * and without triggering automatic reconnection.
   * Useful for testing server-side timeout detection.
   */
  forceClose() {
    this.clearReconnect();
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect logic
      this.ws.close(1001, 'Simulated disconnect');
      this.ws = null;
    }
    this.cleanup();
  }

  /**
   * Register an event listener.
   * @param {string} event - 'open' | 'message' | 'close' | 'error' | 'suspicious'
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove an event listener.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  handleFrame(frame) {
    if (frame.type === PING) {
      if (this.heartbeat) {
        this.heartbeat.onPing();
      }
      return;
    }

    if (frame.type === USER_JOINED) {
      this.emit('user_joined', frame);
      return;
    }

    if (frame.type === USER_LEFT) {
      this.emit('user_left', frame);
      return;
    }

    if (frame.type === ERROR) {
      this.emit('server_error', frame);
      if (frame.code === 'invalid_token') {
        this.emit('auth_error', frame);
      }
      if (frame.code === 'service_not_found') {
        this.emit('service_not_found', frame);
      }
      if (frame.code === 'invalid_reply') {
        this.emit('invalid_reply', frame);
      }
      if (frame.code === 'invalid_attachment') {
        this.emit('invalid_attachment', frame);
      }
      if (frame.code === 'voice_processing_error') {
        this.emit('voice_processing_error', frame);
      }
      if (frame.code === 'voice_assembly_error') {
        this.emit('voice_assembly_error', frame);
      }
      if (frame.code === 'rate_limit_exceeded') {
        this.emit('rate_limit_exceeded', frame);
      }
      if (frame.code === 'not_participant') {
        this.emit('not_participant', frame);
      }
      if (frame.code === 'invalid_message') {
        this.emit('invalid_message', frame);
      }
      return;
    }

    if (frame.type === MESSAGE_RECEIVED) {
      this.emit('message_received', frame);
      return;
    }

    if (frame.type === VOICE_CHUNK) {
      this.emit('voice_chunk_text', frame);
      return;
    }

    if (frame.type === DELIVERED) {
      this.emit('delivered', frame);
      return;
    }

    if (frame.type === TYPING) {
      this.emit('typing', frame);
      return;
    }
  }

  async handleBinary(data) {
    let buffer;
    if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else {
      buffer = data;
    }
    const frame = parseBinaryFrame(buffer);
    this.emit('binary', frame);
  }

  cleanup() {
    if (this.heartbeat) {
      this.heartbeat.stop();
      this.heartbeat = null;
    }
    sendQueue.clear();
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );
    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emit('reconnecting', { delay, attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        this.connect(this.token, { isReconnect: true })
          .then(() => {
            if (this.currentServiceId) {
              // Re-join the service after reconnect
              this.emit('reconnect_join_service', { token: this.token, serviceId: this.currentServiceId });
            }
          })
          .catch((err) => {
            console.error('[WebSocket] Reconnect failed:', err.message);
          });
      }
    }, delay);
  }

  clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const wsClient = new WebSocketClient();
