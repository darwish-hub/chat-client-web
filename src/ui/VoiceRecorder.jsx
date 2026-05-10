import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { startRecording, stopRecording, releaseMic } from '../media/audioCapture';
import { buildVoiceChunk } from '../protocol/builders';
import { wsClient } from '../transport/wsClient';
import { voiceSessionStore } from '../state/voiceSessionStore';
import { MAX_TEXT_LENGTH } from '../config';

export default function VoiceRecorder({ conversationId, onSend, simulatePacketLoss }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveStreamEnabled, setLiveStreamEnabled] = useState(true);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const messageIdRef = useRef(null);
  const chunksRef = useRef([]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedMs(0);
  }, []);

  const handleStart = async () => {
    if (!conversationId) return;

    const messageId = uuidv4();
    messageIdRef.current = messageId;
    chunksRef.current = [];

    voiceSessionStore.startOutbound(messageId, conversationId);

    try {
      await startRecording((blob) => {
        // Simulate packet loss if enabled
        if (simulatePacketLoss && Math.random() < 0.05) {
          console.warn('[VoiceRecorder] Simulated packet loss - dropping chunk');
          return;
        }

        chunksRef.current.push(blob);

        const seq = voiceSessionStore.nextSequence(messageId);
        const isFinal = false;

        // Send text envelope first
        const envelope = buildVoiceChunk(messageId, conversationId, seq, isFinal);
        wsClient.send(envelope);

        // Then send binary payload
        blob.arrayBuffer().then((buffer) => {
          wsClient.sendBinary(buffer);
        });

        onSend?.(envelope, blob);
      });

      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('[VoiceRecorder] Failed to start recording:', err);
      alert('Microphone access denied or not available');
    }
  };

  const handleStop = async () => {
    const messageId = messageIdRef.current;
    if (!messageId) return;

    await stopRecording();
    stopTimer();
    setIsRecording(false);

    voiceSessionStore.finalizeOutbound(messageId);

    // Send final chunk
    const seq = voiceSessionStore.nextSequence(messageId);
    const envelope = buildVoiceChunk(messageId, conversationId, seq, true);
    wsClient.send(envelope);

    onSend?.(envelope, null);

    // Clean up after a delay
    setTimeout(() => {
      voiceSessionStore.removeOutbound(messageId);
    }, 5000);
  };

  const formatElapsed = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
  };

  return (
    <div className="voice-recorder">
      <div className="voice-recorder-controls">
        <button
          className={`voice-ptt-btn ${isRecording ? 'recording' : ''}`}
          onMouseDown={handleStart}
          onMouseUp={handleStop}
          onTouchStart={handleStart}
          onTouchEnd={handleStop}
          disabled={!conversationId}
          title="Hold to record, release to stop"
        >
          {isRecording ? '🔴 Recording...' : '🎤 Push to Talk'}
        </button>
        {isRecording && (
          <span className="voice-timer">{formatElapsed(elapsedMs)}</span>
        )}
      </div>
      <label className="voice-toggle">
        <input
          type="checkbox"
          checked={liveStreamEnabled}
          onChange={(e) => setLiveStreamEnabled(e.target.checked)}
        />
        Live stream
      </label>
    </div>
  );
}
