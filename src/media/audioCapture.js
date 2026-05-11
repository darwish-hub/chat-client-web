/**
 * Audio capture using MediaRecorder API.
 * Produces 200ms chunks for real-time streaming.
 * Validates chunk size against MAX_VOICE_CHUNK_BYTES.
 */

import { MAX_VOICE_CHUNK_BYTES } from '../config';

let mediaRecorder = null;
let audioStream = null;

/**
 * Request microphone permission.
 * @returns {Promise<MediaStream>}
 */
export async function requestMic() {
  audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return audioStream;
}

/**
 * Start recording audio in chunks.
 * @param {Function} onChunk - (blob: Blob) => void
 * @returns {Promise<void>}
 */
export async function startRecording(onChunk) {
  if (!audioStream) {
    await requestMic();
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : MediaRecorder.isTypeSupported('audio/ogg')
      ? 'audio/ogg'
      : '';

  mediaRecorder = new MediaRecorder(audioStream, {
    mimeType,
    audioBitsPerSecond: 128000,
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      if (event.data.size > MAX_VOICE_CHUNK_BYTES) {
        console.warn(`[AudioCapture] Chunk size ${event.data.size} bytes exceeds MAX_VOICE_CHUNK_BYTES (${MAX_VOICE_CHUNK_BYTES}), skipping`);
        return;
      }
      onChunk(event.data);
    }
  };

  mediaRecorder.start(200); // 200ms timeslice
}

/**
 * Stop recording.
 * @returns {Promise<void>}
 */
export async function stopRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder) {
      resolve();
      return;
    }
    mediaRecorder.onstop = () => {
      mediaRecorder = null;
      resolve();
    };
    mediaRecorder.stop();
  });
}

/**
 * Release microphone.
 */
export function releaseMic() {
  if (audioStream) {
    for (const track of audioStream.getTracks()) {
      track.stop();
    }
    audioStream = null;
  }
  mediaRecorder = null;
}
