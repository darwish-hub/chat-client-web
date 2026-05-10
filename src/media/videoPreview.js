import { API_BASE } from '../config';

/**
 * Get the video playback URL for a blobId.
 * @param {string} blobId
 * @returns {string}
 */
export function getVideoUrl(blobId) {
  return `${API_BASE}/api/download/${blobId}`;
}

/**
 * Create a video element for preview.
 * @param {string} blobId
 * @returns {HTMLVideoElement}
 */
export function createVideoElement(blobId) {
  const video = document.createElement('video');
  video.controls = true;
  video.src = getVideoUrl(blobId);
  video.preload = 'metadata';
  video.style.maxWidth = '100%';
  return video;
}
