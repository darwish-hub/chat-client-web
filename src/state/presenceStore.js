/**
 * In-memory presence and typing store.
 */
class PresenceStore {
  constructor() {
    this.onlineByService = new Map(); // serviceId -> Map<userId, {userId, displayName, lastSeen, isOnline, isTyping, typingConversationId}>
    this.typingByConversation = new Map(); // conversationId -> Map<userId, {timeoutId}>
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
   * Mark a user as online in a service.
   * @param {string} serviceId
   * @param {{userId: string, displayName: string, lastSeen?: string}} user
   */
  setOnline(serviceId, user) {
    if (!this.onlineByService.has(serviceId)) {
      this.onlineByService.set(serviceId, new Map());
    }
    const serviceUsers = this.onlineByService.get(serviceId);
    const existing = serviceUsers.get(user.userId);
    serviceUsers.set(user.userId, {
      userId: user.userId,
      displayName: user.displayName || user.userId,
      lastSeen: user.lastSeen || new Date().toISOString(),
      isOnline: true,
      isTyping: existing?.isTyping || false,
      typingConversationId: existing?.typingConversationId || null,
    });
    this.notify();
  }

  /**
   * Mark a user as offline in a service.
   * @param {string} serviceId
   * @param {string} userId
   */
  setOffline(serviceId, userId) {
    const serviceUsers = this.onlineByService.get(serviceId);
    if (serviceUsers) {
      serviceUsers.delete(userId);
      if (serviceUsers.size === 0) {
        this.onlineByService.delete(serviceId);
      }
    }
    this.notify();
  }

  /**
   * Get all online users for a service.
   * @param {string} serviceId
   * @returns {Array<{userId: string, displayName: string, lastSeen: string, isOnline: boolean}>}
   */
  getOnline(serviceId) {
    const serviceUsers = this.onlineByService.get(serviceId);
    return serviceUsers ? Array.from(serviceUsers.values()) : [];
  }

  /**
   * Set typing status for a user in a conversation.
   * @param {string} conversationId
   * @param {string} userId
   * @param {boolean} isTyping
   * @param {number} [clearAfterMs=5000] - Auto-clear after this many ms
   */
  setTyping(conversationId, userId, isTyping, clearAfterMs = 5000) {
    if (!this.typingByConversation.has(conversationId)) {
      this.typingByConversation.set(conversationId, new Map());
    }
    const convoTypers = this.typingByConversation.get(conversationId);

    // Clear existing timeout
    const existing = convoTypers.get(userId);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    // Update typing state in user record
    for (const [, serviceUsers] of this.onlineByService) {
      const user = serviceUsers.get(userId);
      if (user) {
        user.isTyping = isTyping;
        user.typingConversationId = isTyping ? conversationId : null;
      }
    }

    if (isTyping) {
      const timeoutId = setTimeout(() => {
        this.setTyping(conversationId, userId, false);
      }, clearAfterMs);
      convoTypers.set(userId, { timeoutId });
    } else {
      convoTypers.delete(userId);
      if (convoTypers.size === 0) {
        this.typingByConversation.delete(conversationId);
      }
    }
    this.notify();
  }

  /**
   * Get users currently typing in a conversation.
   * @param {string} conversationId
   * @returns {string[]} Array of userIds
   */
  getTyping(conversationId) {
    const convoTypers = this.typingByConversation.get(conversationId);
    return convoTypers ? Array.from(convoTypers.keys()) : [];
  }

  /**
   * Clear all presence data (e.g., on disconnect).
   */
  clear() {
    // Clear all typing timeouts
    for (const convoTypers of this.typingByConversation.values()) {
      for (const entry of convoTypers.values()) {
        if (entry.timeoutId) clearTimeout(entry.timeoutId);
      }
    }
    this.onlineByService.clear();
    this.typingByConversation.clear();
    this.notify();
  }
}

export const presenceStore = new PresenceStore();