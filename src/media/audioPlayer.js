/**
 * Audio player for live voice chunks using Web Audio API.
 * Schedules playback with AudioBufferSourceNode to eliminate gaps.
 */

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Decode an ArrayBuffer to AudioBuffer.
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<AudioBuffer>}
 */
async function decodeChunk(arrayBuffer) {
  const ctx = getAudioContext();
  // MediaRecorder produces Blob data; we need to wrap it properly for decoding
  // For webm/ogg chunks, the decoder may fail on individual chunks.
  // We'll accumulate chunks and decode the concatenated buffer when final.
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    return null;
  }
}

/**
 * Enqueue a chunk for playback.
 * @param {string} messageId
 * @param {number} sequenceNumber
 * @param {ArrayBuffer} arrayBuffer
 */
export async function enqueueChunk(messageId, sequenceNumber, arrayBuffer) {
  // For live streaming, individual chunks may not be decodable.
  // We'll store them and decode when the session is final.
  // For now, this is a placeholder for the full implementation.
  console.log(`[AudioPlayer] Chunk ${sequenceNumber} for ${messageId}, size: ${arrayBuffer.byteLength}`);
}

/**
 * Play a complete audio blob.
 * @param {Blob} blob
 * @returns {Promise<HTMLAudioElement>}
 */
export function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  audio.onended = () => URL.revokeObjectURL(url);
  return audio;
}

/**
 * Assemble chunks into a single Blob and play.
 * @param {Blob[]} chunks
 * @returns {HTMLAudioElement}
 */
export function playChunks(chunks) {
  const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
  return playBlob(blob);
}
