import { useState } from 'react';

function LogEntry({ log, index }) {
  const [expanded, setExpanded] = useState(false);

  let direction = '•';
  let directionClass = 'log-neutral';
  if (log.message.startsWith('→')) {
    direction = '→';
    directionClass = 'log-out';
  } else if (log.message.startsWith('←')) {
    direction = '←';
    directionClass = 'log-in';
  }

  // Try to extract JSON from log message for pretty-printing
  const jsonMatch = log.message.match(/\{.*\}/s);
  const hasJson = !!jsonMatch;

  return (
    <div className={`log-entry ${expanded ? 'log-expanded' : ''}`}>
      <div className="log-summary" onClick={() => hasJson && setExpanded((v) => !v)}>
        <span className={`log-direction ${directionClass}`}>{direction}</span>
        <span className="log-timestamp">{log.timestamp}</span>
        <span className="log-message">{log.message}</span>
        {hasJson && (
          <span className="log-expand-hint">{expanded ? '▼' : '▶'}</span>
        )}
      </div>
      {expanded && hasJson && (
        <pre className="log-json">
          {JSON.stringify(JSON.parse(jsonMatch[0]), null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function ProtocolLog({ logs, onExport, onClear, compact = false }) {
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? logs.filter((l) => l.message.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className={`protocol-log ${compact ? 'protocol-log-compact' : ''}`}>
      {!compact && (
        <div className="protocol-log-header">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="log-filter"
          />
          <div className="log-actions">
            <button onClick={onExport} className="log-export-btn" title="Export as .ndjson">
              ⬇️ Export
            </button>
            <button onClick={onClear} className="log-clear-btn" title="Clear logs">
              🗑️ Clear
            </button>
          </div>
        </div>
      )}
      <div className="logs-content">
        {filtered.length === 0 ? (
          <p className="log-empty">No logs yet</p>
        ) : (
          filtered.map((log, i) => <LogEntry key={i} log={log} index={i} />)
        )}
      </div>
    </div>
  );
}
