import { useMemo } from 'react';

export default function MetricsDashboard({
  connectionStatus,
  connectTime,
  messagesSent,
  messagesReceived,
  deliveredLatencies,
  voiceChunkLatencies,
  queueDepth,
}) {
  const uptime = useMemo(() => {
    if (!connectTime || connectionStatus !== 'connected') return '—';
    const ms = Date.now() - connectTime;
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    if (hr > 0) return `${hr}h ${min % 60}m ${sec % 60}s`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
  }, [connectTime, connectionStatus]);

  const avgLatency = useMemo(() => {
    if (!deliveredLatencies.length) return '—';
    const avg = deliveredLatencies.reduce((a, b) => a + b, 0) / deliveredLatencies.length;
    return `${avg.toFixed(1)}ms`;
  }, [deliveredLatencies]);

  const voiceLatencyStats = useMemo(() => {
    if (!voiceChunkLatencies.length) return null;
    const sorted = [...voiceChunkLatencies].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    return { avg: avg.toFixed(1), p50, p95 };
  }, [voiceChunkLatencies]);

  return (
    <div className="metrics-dashboard">
      <div className="metric-card">
        <span className="metric-label">Uptime</span>
        <span className="metric-value">{uptime}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Sent</span>
        <span className="metric-value">{messagesSent}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Received</span>
        <span className="metric-value">{messagesReceived}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Avg Latency</span>
        <span className="metric-value">{avgLatency}</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Queue Depth</span>
        <span className="metric-value">{queueDepth}</span>
      </div>
      {voiceLatencyStats && (
        <div className="metric-card metric-wide">
          <span className="metric-label">Voice Chunk Latency</span>
          <span className="metric-value">
            avg {voiceLatencyStats.avg}ms · p50 {voiceLatencyStats.p50}ms · p95 {voiceLatencyStats.p95}ms
          </span>
        </div>
      )}
    </div>
  );
}
