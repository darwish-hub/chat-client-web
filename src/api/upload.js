import { API_BASE, MAX_UPLOAD_BYTES } from '../config';

/**
 * Upload a file with progress tracking via XMLHttpRequest.
 * @param {File} file
 * @param {Function} onProgress - (percent: number) => void
 * @returns {Promise<{blobId: string, url: string, fileName: string, mimeType: string, sizeBytes: number}>}
 */
export function uploadFile(file, onProgress) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error(`File too large: ${file.size} bytes exceeds the ${MAX_UPLOAD_BYTES} byte limit`));
  }

  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('chathub-token');
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (err) {
          reject(new Error('Invalid JSON response from upload'));
        }
      } else {
        let message = `Upload failed: HTTP ${xhr.status}`;
        try {
          const error = JSON.parse(xhr.responseText);
          message = error.error?.message || message;
        } catch {
          // ignore
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed: network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', `${API_BASE}/api/upload/file`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}

/**
 * Upload a file from a public URL.
 * @param {string} url
 * @param {Function} onProgress
 */
export async function uploadFromUrl(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const fileName = url.split('/').pop() || 'download';
  const file = new File([blob], fileName, { type: blob.type });
  return uploadFile(file, onProgress);
}
