/**
 * In-memory voice session store.
 * Tracks active outbound and inbound voice streams.
 */

class VoiceSessionStore {
  constructor() {
    /** @type {Map<string, OutboundSession>} */
    this.outbound = new Map();
    /** @type {Map<string, InboundSession>} */
    this.inbound = new Map();
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb();
    }
  }

  /**
   * Start an outbound voice session.
   * @param {string} messageId
   * @param {string} conversationId
   */
  startOutbound(messageId, conversationId) {
    this.outbound.set(messageId, {
      messageId,
      conversationId,
      sequenceNumber: 0,
      isFinal: false,
      startedAt: Date.now(),
    });
    this.notify();
  }

  /**
   * Get next sequence number for an outbound session.
   * @param {string} messageId
   * @returns {number}
   */
  nextSequence(messageId) {
    const session = this.outbound.get(messageId);
    if (!session) return 0;
    const seq = session.sequenceNumber;
    session.sequenceNumber++;
    return seq;
  }

  /**
   * Mark outbound session as complete.
   * @param {string} messageId
   */
  finalizeOutbound(messageId) {
    const session = this.outbound.get(messageId);
    if (session) {
      session.isFinal = true;
      this.notify();
    }
  }

  /**
   * Remove an outbound session.
   * @param {string} messageId
   */
  removeOutbound(messageId) {
    this.outbound.delete(messageId);
    this.notify();
  }

  /**
   * Start or get an inbound voice session.
   * @param {string} key - `${messageId}:${fromUserId}`
   * @param {string} messageId
   * @param {string} fromUserId
   */
  startInbound(key, messageId, fromUserId) {
    if (!this.inbound.has(key)) {
      this.inbound.set(key, {
        messageId,
        fromUserId,
        chunks: [],
        isFinal: false,
        startedAt: Date.now(),
      });
      this.notify();
    }
  }

  /**
   * Add a chunk to an inbound session.
   * @param {string} key
   * @param {number} sequenceNumber
   * @param {ArrayBuffer} buffer
   */
  addInboundChunk(key, sequenceNumber, buffer) {
    const session = this.inbound.get(key);
    if (!session) return;
    session.chunks.push({ sequenceNumber, buffer });
    session.chunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    this.notify();
  }

  /**
   * Mark inbound session as complete.
   * @param {string} key
   */
  finalizeInbound(key) {
    const session = this.inbound.get(key);
    if (session) {
      session.isFinal = true;
      this.notify();
    }
  }

  /**
   * Get sorted chunks for an inbound session.
   * @param {string} key
   * @returns {{sequenceNumber: number, buffer: ArrayBuffer}[]}
   */
  getInboundChunks(key) {
    const session = this.inbound.get(key);
    return session ? session.chunks : [];
  }

  /**
   * Check if inbound session is complete.
   * @param {string} key
   * @returns {boolean}
   */
  isInboundFinal(key) {
    const session = this.inbound.get(key);
    return session ? session.isFinal : false;
  }

  clear() {
    this.outbound.clear();
    this.inbound.clear();
    this.notify();
  }
}

export const voiceSessionStore = new VoiceSessionStore();
