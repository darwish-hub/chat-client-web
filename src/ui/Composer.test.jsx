import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Composer from './Composer';

vi.mock('../transport/wsClient', () => ({
  wsClient: {
    send: vi.fn(),
  },
}));

vi.mock('../protocol/builders', () => ({
  buildTextMessage: vi.fn((conversationId, serviceId, text, replyToId) => ({
    type: 'text_message',
    id: 'msg-1',
    conversationId,
    serviceId,
    text,
    replyToId,
  })),
  buildFileAttachment: vi.fn(),
}));

describe('Composer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea and send button', () => {
    render(<Composer conversationId="conv-1" serviceId="svc-1" />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('shows disabled state when no conversation', () => {
    render(<Composer conversationId={null} serviceId={null} />);
    expect(screen.getByPlaceholderText('Select a conversation first')).toBeDisabled();
    expect(screen.getByText('Send')).toBeDisabled();
  });

  it('shows reply preview when replyTo is provided', () => {
    const replyTo = {
      id: 'msg-1',
      senderId: 'user-1',
      text: 'Original message',
    };
    render(<Composer conversationId="conv-1" serviceId="svc-1" replyTo={replyTo} onDismissReply={vi.fn()} />);
    expect(screen.getByText(/Replying to/)).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
  });

  it('calls onDismissReply when dismiss button clicked', () => {
    const onDismissReply = vi.fn();
    const replyTo = {
      id: 'msg-1',
      senderId: 'user-1',
      text: 'Original message',
    };
    render(<Composer conversationId="conv-1" serviceId="svc-1" replyTo={replyTo} onDismissReply={onDismissReply} />);
    fireEvent.click(screen.getByTitle('Dismiss reply'));
    expect(onDismissReply).toHaveBeenCalled();
  });

  it('disables send button when composer is disabled', () => {
    render(<Composer conversationId="conv-1" serviceId="svc-1" disabled />);
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    expect(screen.getByText('Send')).toBeDisabled();
  });

  it('applies error class when error prop is true', () => {
    render(<Composer conversationId="conv-1" serviceId="svc-1" error />);
    expect(screen.getByPlaceholderText('Type a message...').className).toContain('composer-error');
  });
});