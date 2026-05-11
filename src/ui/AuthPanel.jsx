import { useState, useEffect } from 'react';

/**
 * AuthPanel component for JWT input and connection controls.
 * @param {Object} props
 * @param {string} props.token - Current JWT token
 * @param {string} props.connectionStatus - 'disconnected' | 'connecting' | 'connected'
 * @param {string|null} props.authError - Authentication error message
 * @param {Function} props.onTokenChange - (token: string) => void
 * @param {Function} props.onConnect - () => void
 * @param {Function} props.onDisconnect - () => void
 */
export default function AuthPanel({
  token,
  connectionStatus,
  authError,
  onTokenChange,
  onConnect,
  onDisconnect,
}) {
  const [localToken, setLocalToken] = useState(token);

  // Sync local state when prop changes (e.g. from localStorage on mount)
  useEffect(() => {
    setLocalToken(token);
  }, [token]);

  const handleChange = (e) => {
    setLocalToken(e.target.value);
    onTokenChange(e.target.value);
  };

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  return (
    <div className="auth-panel-content">
      <div className="auth-row">
        <textarea
          rows={3}
          placeholder="Paste JWT token here..."
          value={localToken}
          onChange={handleChange}
          disabled={isConnected}
          className="auth-token-input"
        />
        <div className="auth-controls">
          <button
            onClick={onConnect}
            disabled={isConnected || isConnecting || !localToken.trim()}
            className="auth-btn auth-btn-connect"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
          <button
            onClick={onDisconnect}
            disabled={!isConnected && !isConnecting}
            className="auth-btn auth-btn-disconnect"
          >
            Disconnect
          </button>
        </div>
      </div>

      {authError && (
        <div className="auth-error">
          <strong>Auth Error:</strong> {authError}
          {authError.toLowerCase().includes('token') && (
            <button
              className="auth-btn auth-btn-connect"
              style={{ marginLeft: '8px' }}
              onClick={onConnect}
            >
              Retry with new token
            </button>
          )}
        </div>
      )}

      <div className="auth-status-row">
        <span className="auth-status-label">Status:</span>
        <span className={`auth-status-value auth-status-${connectionStatus}`}>
          {connectionStatus}
        </span>
      </div>
    </div>
  );
}
