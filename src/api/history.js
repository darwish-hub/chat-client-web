import { API_BASE } from '../config';

function getHeaders() {
  const token = localStorage.getItem('chathub-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch message history for a conversation.
 * @param {string} conversationId
 * @param {string} [before] - ISO datetime
 * @param {number} [limit=50]
 */
export async function fetchHistory(conversationId, before, limit = 50) {
  const url = new URL(`${API_BASE}/api/conversations/${conversationId}/messages`);
  if (before) {
    url.searchParams.set('before', before);
  }
  if (limit) {
    url.searchParams.set('limit', String(limit));
  }
  const response = await fetch(url, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

/**
 * Fetch reply thread for a specific message.
 * @param {string} conversationId
 * @param {string} messageId
 */
export async function fetchThread(conversationId, messageId) {
  const response = await fetch(
    `${API_BASE}/api/conversations/${conversationId}/messages/${messageId}/replies`,
    { headers: getHeaders() }
  );
  return handleResponse(response);
}
