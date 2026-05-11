/**
 * Audio player for live voice chunks using Web Audio API.
 * Schedules playback with AudioBufferSourceNode to eliminate gaps.
 */

import { voiceSessionStore } from '../state/voiceSessionStore';

let audioContext = null;

function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

const sessions = new Map();

/**
 * Enqueue a chunk for playback.
 * Decodes the ArrayBuffer and schedules playback in sequence order.
 * @param {string} sessionId - Voice session key (e.g., messageId:fromUserId)
 * @param {number} sequenceNumber - Chunk sequence number
 * @param {ArrayBuffer} arrayBuffer - Raw audio bytes
 */
export async function enqueueChunk(sessionId, sequenceNumber, arrayBuffer) {
  const ctx = getAudioContext();

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      chunks: new Map(),
      nextSequence: 0,
      playing: false,
      scheduledEndTime: 0,
    });
  }

  const session = sessions.get(sessionId);

  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    if (!audioBuffer) return;
    session.chunks.set(sequenceNumber, audioBuffer);
    playNextChunks(sessionId);
  } catch (err) {
    console.warn(`[AudioPlayer] Failed to decode chunk ${sequenceNumber} for session ${sessionId}:`, err.message);
  }
}

/**
 * Play queued chunks in sequence order.
 * @param {string} sessionId
 */
function playNextChunks(sessionId) {
  const ctx = getAudioContext();
  const session = sessions.get(sessionId);
  if (!session || session.playing) return;

  session.playing = true;
  const playback = () => {
    const chunk = session.chunks.get(session.nextSequence);
    if (!chunk) {
      session.playing = false;

      if (voiceSessionStore.isInboundFinal(sessionId)) {
        sessions.delete(sessionId);
        console.log(`[AudioPlayer] Session ${sessionId} complete`);
      }
      return;
    }

    session.chunks.delete(session.nextSequence);
    session.nextSequence++;

    const source = ctx.createBufferSource();
    source.buffer = chunk;

    const startTime = Math.max(ctx.currentTime, session.scheduledEndTime);
    source.connect(ctx.destination);
    source.start(startTime);

    session.scheduledEndTime = startTime + chunk.duration;

    source.onended = () => {
      playback();
    };
  };

  playback();
}

/**
 * Mark a session as complete and flush remaining buffer.
 * @param {string} sessionId
 */
export function completeSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    voiceSessionStore.finalizeInbound(sessionId);
  }
}

/**
 * Play a complete audio blob (for replay of assembled messages).
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