import { PING } from '../protocol/messageTypes';
import { buildPong } from '../protocol/builders';
import { PING_INTERVAL_MS } from '../config';

/**
 * Heartbeat manager for WebSocket connections.
 * Handles ping/pong and connection timeout detection.
 */
export class HeartbeatManager {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.lastPingTime = null;
    this.checkTimer = null;
  }

  start() {
    this.lastPingTime = Date.now();
    this.scheduleCheck();
  }

  stop() {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
  }

  onPing() {
    this.lastPingTime = Date.now();
    // Reply with pong
    this.wsClient.send(buildPong());
  }

  scheduleCheck() {
    const timeout = PING_INTERVAL_MS * 2;
    this.checkTimer = setTimeout(() => {
      const elapsed = Date.now() - this.lastPingTime;
      if (elapsed > timeout) {
        console.warn('[Heartbeat] No ping received for', elapsed, 'ms; connection suspicious');
        this.wsClient.emit('suspicious');
      } else {
        this.scheduleCheck();
      }
    }, timeout);
  }
}
