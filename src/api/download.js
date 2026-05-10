import { API_BASE } from '../config';

/**
 * Download a file by blobId.
 * Opens in a new tab or triggers in-app download.
 * @param {string} blobId
 * @param {string} [fileName]
 */
export async function download(blobId, fileName) {
  const token = localStorage.getItem('chathub-token');
  const url = `${API_BASE}/api/download/${blobId}`;

  // Try in-app download first
  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName || blobId;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}
