/**
 * In-memory presence and typing store.
 */
class PresenceStore {
  constructor() {
    this.onlineByService = new Map(); // serviceId -> Map<userId, {userId, userName, status}>
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
   * @param {{userId: string, userName: string}} user
   */
  setOnline(serviceId, user) {
    if (!this.onlineByService.has(serviceId)) {
      this.onlineByService.set(serviceId, new Map());
    }
    const serviceUsers = this.onlineByService.get(serviceId);
    serviceUsers.set(user.userId, { ...user, status: 'online' });
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
   * @returns {Array<{userId: string, userName: string, status: string}>}
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
