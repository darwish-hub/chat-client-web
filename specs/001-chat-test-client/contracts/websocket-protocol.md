# WebSocket Protocol Contract

**Scope**: Client ↔ Server real-time communication  
**Transport**: Native WebSocket (`ws://localhost:8080/ws`)  
**Format**: JSON text frames for control messages; binary frames for audio payloads  
**Version**: 1.0

---

## Connection Lifecycle

1. Client opens WebSocket to `ws://localhost:8080/ws`.
2. Server responds with `101 Switching Protocols` if the connection is accepted.
3. Client MUST send `join_service` with a valid JWT token within 5 seconds.
4. Server responds with `user_joined` for the connecting user and broadcasts `user_joined` to other participants in the service.
5. Server sends periodic `ping` frames (every 15 seconds). Client MUST reply with `pong`.
6. If no `ping` is received for `PING_INTERVAL_MS * 2` (default 30s), the client SHOULD treat the connection as suspicious and initiate reconnect.
7. On graceful disconnect, client SHOULD send `leave_service` before closing the socket.

---

## Frame Types

### Control Frames (JSON Text)

#### Client → Server

| Type | Required Fields | Optional Fields | Description |
|------|-----------------|-----------------|-------------|
| `join_service` | `token: string` | — | Authenticate and join a service |
| `leave_service` | — | — | Notify server of intentional departure |
| `text_message` | `id: string`, `conversationId: string`, `content: { text: string }` | `replyToId: string` | Send a text message |
| `voice_chunk` | `messageId: string`, `conversationId: string`, `sequenceNumber: number`, `isFinal: boolean` | — | Header for a voice chunk (binary payload follows) |
| `typing` | `conversationId: string`, `isTyping: boolean` | — | Indicate typing status |
| `ack` | `messageId: string` | — | Acknowledge receipt of a message |
| `pong` | — | — | Response to server `ping` |

#### Server → Client

| Type | Required Fields | Description |
|------|-----------------|-------------|
| `ping` | — | Heartbeat request; client must reply `pong` |
| `user_joined` | `userId: string`, `userName: string`, `serviceId: string` | A user joined the service |
| `user_left` | `userId: string`, `serviceId: string` | A user left the service |
| `message_received` | `id: string`, `conversationId: string`, `fromUserId: string`, `fromUserName: string`, `type: string`, `content: object`, `createdAt: string` | A new message in a conversation |
| `delivered` | `messageId: string`, `conversationId: string`, `deliveredAt: string` | Confirmation that a sent message reached the server |
| `typing` | `conversationId: string`, `userId: string`, `isTyping: boolean` | Another user is typing |
| `error` | `code: string`, `message: string` | Server error response |

### Binary Frames

Binary frames are used exclusively for live voice audio payloads.

**Rules**:
- A `voice_chunk` text frame MUST be sent immediately before the binary frame.
- The binary frame contains the raw audio chunk (`ArrayBuffer`).
- No additional framing or headers are present in the binary payload.
- The server correlates the binary payload with the most recent `voice_chunk` text frame using the same WebSocket connection.

---

## Error Codes

| Code | Meaning | Client Action |
|------|---------|---------------|
| `invalid_token` | JWT is missing, expired, or malformed | Show auth error; do not retry |
| `rate_limit_exceeded` | Too many messages sent in a time window | Disable send button for 5s; show toast |
| `not_participant` | User is not a member of the target conversation | Redirect to conversation list |
| `invalid_message` | Message format violated schema | Highlight composer in red; show error detail |
| `service_not_found` | Target service does not exist | Show error; return to service selector |

---

## Sequence Diagram: Text Message Flow

```text
Client                              Server
  |                                   |
  |-------- join_service ------------>|
  |<------- user_joined --------------|
  |                                   |
  |-------- text_message ------------>|
  |<------- delivered ----------------|
  |<------- message_received ---------|
  |                                   |
```

## Sequence Diagram: Live Voice Flow

```text
Client                              Server
  |                                   |
  |-------- voice_chunk (text) ------>|
  |-------- [binary audio] ---------->|
  |-------- voice_chunk (text) ------>|
  |-------- [binary audio] ---------->|
  |-------- voice_chunk (final) ----->|
  |-------- [binary audio] ---------->|
  |<------- message_received ---------|
  |                                   |
```

---

**Note**: This contract is the source of truth for `js/protocol/messageTypes.js`, `js/protocol/builders.js`, and `js/protocol/parsers.js`.
