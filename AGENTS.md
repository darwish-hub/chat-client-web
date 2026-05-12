# Chat Client Web - Test Client

## Project Overview

React-based web test client for the ChatHub real-time messaging service.

## Commands

```bash
cd chat-client-web
npm install          # Install dependencies
npm run dev         # Start dev server
npm run build       # Production build
npm run preview     # Preview production build
```

## Key Files

- `src/App.jsx` - Main application with 4-column layout
- `src/App.css` - Styling
- `src/transport/wsClient.js` - WebSocket client
- `src/protocol/parsers.js` - Frame parsing and validation
- `src/api/conversations.js` - REST API for conversations

## Configuration

- `src/config.js` - API endpoints and WebSocket URL

## Testing Multi-User Messaging

1. User 1246 creates conversation (with participant IDs)
2. User 223 connects and clicks "Browse Conversations"
3. User 223 joins 1246's conversation
4. Messages sent by either user are received by the other
