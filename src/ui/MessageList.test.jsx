import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageList from './MessageList';
import { messageStore } from '../state/messageStore';

vi.mock('../api/download', () => ({
  download: vi.fn(),
}));

vi.mock('../media/videoPreview', () => ({
  getVideoUrl: vi.fn(() => 'http://localhost:8080/api/download/test-blob'),
}));

vi.mock('../api/history', () => ({
  fetchThread: vi.fn().mockResolvedValue([]),
}));

describe('MessageList', () => {
  beforeEach(() => {
    messageStore.clear();
  });

  it('shows placeholder when no conversation', () => {
    render(<MessageList conversationId={null} />);
    expect(screen.getByText('Select a conversation to view messages')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<MessageList conversationId="conv-1" />);
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('renders text messages', () => {
    messageStore.add({
      id: 'msg-1',
      conversationId: 'conv-1',
      fromUserId: 'user-1',
      fromUserName: 'Alice',
      type: 'text',
      content: { text: 'Hello world' },
      createdAt: '2026-05-10T12:00:00Z',
    });

    render(<MessageList conversationId="conv-1" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders reply button on messages', () => {
    messageStore.add({
      id: 'msg-1',
      conversationId: 'conv-1',
      fromUserId: 'user-1',
      fromUserName: 'Alice',
      type: 'text',
      content: { text: 'Hello' },
      createdAt: '2026-05-10T12:00:00Z',
    });

    render(<MessageList conversationId="conv-1" />);
    expect(screen.getByTitle('Reply')).toBeInTheDocument();
  });

  it('renders delivered checkmark', () => {
    messageStore.add({
      id: 'msg-1',
      conversationId: 'conv-1',
      fromUserId: 'user-1',
      fromUserName: 'Alice',
      type: 'text',
      content: { text: 'Hello' },
      createdAt: '2026-05-10T12:00:00Z',
      deliveredAt: '2026-05-10T12:00:01Z',
    });

    render(<MessageList conversationId="conv-1" />);
    expect(screen.getByTitle('Delivered')).toBeInTheDocument();
  });

  it('escapes HTML in text messages (XSS prevention)', () => {
    messageStore.add({
      id: 'msg-1',
      conversationId: 'conv-1',
      fromUserId: 'user-1',
      fromUserName: 'Alice',
      type: 'text',
      content: { text: '<script>alert("xss")</script>' },
      createdAt: '2026-05-10T12:00:00Z',
    });

    render(<MessageList conversationId="conv-1" />);
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
  });
});
