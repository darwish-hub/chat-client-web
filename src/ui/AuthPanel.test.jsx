import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthPanel from './AuthPanel';

describe('AuthPanel', () => {
  it('renders token input and connect/disconnect buttons', () => {
    render(
      <AuthPanel
        token=""
        connectionStatus="disconnected"
        authError={null}
        onTokenChange={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Paste JWT token here...')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('disables connect button when no token', () => {
    render(
      <AuthPanel
        token=""
        connectionStatus="disconnected"
        authError={null}
        onTokenChange={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText('Connect')).toBeDisabled();
  });

  it('calls onTokenChange when typing', () => {
    const onTokenChange = vi.fn();
    render(
      <AuthPanel
        token=""
        connectionStatus="disconnected"
        authError={null}
        onTokenChange={onTokenChange}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Paste JWT token here...'), {
      target: { value: 'my-token' },
    });
    expect(onTokenChange).toHaveBeenCalledWith('my-token');
  });

  it('calls onConnect when connect button clicked', () => {
    const onConnect = vi.fn();
    render(
      <AuthPanel
        token="my-token"
        connectionStatus="disconnected"
        authError={null}
        onTokenChange={vi.fn()}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Connect'));
    expect(onConnect).toHaveBeenCalled();
  });

  it('displays auth error', () => {
    render(
      <AuthPanel
        token=""
        connectionStatus="disconnected"
        authError="Invalid token"
        onTokenChange={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText(/Invalid token/)).toBeInTheDocument();
  });

  it('shows connecting state', () => {
    render(
      <AuthPanel
        token="my-token"
        connectionStatus="connecting"
        authError={null}
        onTokenChange={vi.fn()}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.getByText('Connecting...')).toBeDisabled();
  });
});
