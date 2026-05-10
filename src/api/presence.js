import { API_BASE } from '../config';

/**
 * Fetch currently online users in a service.
 * @param {string} serviceId
 * @returns {Promise<Array<{userId: string, userName: string, status: string}>>}
 */
export async function fetchOnlineUsers(serviceId) {
  const token = localStorage.getItem('chathub-token');
  const response = await fetch(`${API_BASE}/api/services/${serviceId}/online`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch online users: HTTP ${response.status}`);
  }

  return response.json();
}
