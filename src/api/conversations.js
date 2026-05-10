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
 * Create a new conversation.
 * @param {string} serviceId
 * @param {string} title
 * @param {string[]} participantIds
 */
export async function createConversation(serviceId, title, participantIds) {
  const response = await fetch(`${API_BASE}/api/conversation`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ serviceId, title, participantIds }),
  });
  return handleResponse(response);
}

/**
 * List conversations for the authenticated user.
 * @param {string} [serviceId] - Optional filter
 */
export async function listMyConversations(serviceId) {
  const url = new URL(`${API_BASE}/api/conversation`);
  if (serviceId) {
    url.searchParams.set('serviceId', serviceId);
  }
  const response = await fetch(url, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}
