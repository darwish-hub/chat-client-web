# WebSocket Protocol Contract

**Scope**: Client ↔ Server real-time communication  
**Transport**: Native WebSocket (`ws://localhost:8080/ws?token={jwt}`)  
**Format**: JSON text frames for control messages; binary frames for audio payloads  
**Version**: 1.0 (aligned with ChatHub server implementation)

---

## Connection Lifecycle

1. Client opens WebSocket to `ws://localhost:8080/ws?token={jwt}`. The JWT is passed as a query parameter because HTTP upgrade requests cannot reliably carry `Authorization` headers across all platforms.
2. Server validates the JWT. On success, responds with `101 Switching Protocols`. On failure, the connection is rejected (no WebSocket upgrade).
3. Client MUST send `join_service` with a `serviceId` within 5 seconds of connection. The `token` is NOT included in this frame — it was already provided in the URL.
4. Server responds with `user_joined` for the connecting user and broadcasts `user_joined` to other participants in the service.
5. Server sends periodic `ping` frames (every 15 seconds). Client MUST reply with `pong` within 10 seconds.
6. If no `ping` is received for 30 seconds (`PING_INTERVAL_MS * 2`), the client SHOULD treat the connection as suspicious and initiate reconnect.
7. On graceful disconnect, client SHOULD send `leave_service` with the `serviceId` before closing the socket.
8. Heartbeat monitoring MUST start at connection time, not just after the first PING. If the server never sends a PING, the connection should be flagged suspicious after 30 seconds.

---

## Frame Types

### Control Frames (JSON Text)

#### Client → Server

| Type | Required Fields | Optional Fields | Description |
|------|-----------------|-----------------|-------------|
| `join_service` | `serviceId: string` | — | Subscribe to a service channel |
| `leave_service` | `serviceId: string` | — | Unsubscribe from a service |
| `text_message` | `id: string`, `conversationId: string`, `serviceId: string`, `text: string` | `replyToId: string` | Send a text message (max 10,000 chars) |
| `voice_chunk` | `id: string`, `conversationId: string`, `sequenceNumber: number`, `isFinal: boolean` | — | Header for a voice chunk (binary payload follows) |
| `voice_message` | `id: string`, `conversationId: string`, `blobId: string`, `durationMs: number`, `mimeType: string` | `replyToId: string` | Send a pre-recorded/assembled voice message |
| `file_attachment` | `id: string`, `conversationId: string`, `blobId: string`, `fileName: string`, `mimeType: string`, `sizeBytes: number` | `durationMs: number`, `replyToId: string` | Share an uploaded file (server infers type from MIME) |
| `typing` | `conversationId: string`, `isTyping: boolean` | — | Indicate typing status |
| `ack` | `messageId: string` | — | Acknowledge receipt of a message |
| `pong` | — | — | Response to server `ping` |

**Important field notes**:
- `join_service` does NOT contain a `token` field. Authentication is via the `?token=` query parameter on the WebSocket URL.
- `leave_service` requires `serviceId`. This is not optional.
- `text_message` uses a flat `text` field, NOT a nested `content: {text}` object.
- `voice_chunk` uses `id` as the voice message UUID, NOT `messageId`.
- `file_attachment` is a distinct message type. The server infers the message type from `mimeType`: `audio/*` → `"voice"`, `video/*` → `"video"`, everything else → `"file"`.
- `voice_message` is sent after a live voice stream completes (when the server has assembled the chunks into a stored blob) or for pre-recorded voice attachments.
- Client SHOULD enforce a 300ms minimum interval between `typing` events to avoid rate-limiting.
- Client MUST reject files larger than 100MB before sending `file_attachment`.
- Client SHOULD validate voice chunk size ≤ 64KB after encoding before sending.

#### Server → Client

| Type | Required Fields | Description |
|------|-----------------|-------------|
| `ping` | — | Heartbeat request; client must reply `pong` |
| `user_joined` | `userId: string`, `serviceId: string`, `displayName: string` | A user joined the service |
| `user_left` | `userId: string`, `serviceId: string` | A user left the service |
| `message_received` | `envelope: object` (see below) | A new message in a conversation |
| `voice_chunk` | `id: string`, `conversationId: string`, `sequenceNumber: number`, `isFinal: boolean`, `fromUserId: string` | Live voice stream chunk from another user |
| `delivered` | `messageId: string` | Confirmation that a sent message reached the server |
| `typing` | `conversationId: string`, `userId: string`, `isTyping: boolean` | Another user is typing |
| `error` | `code: string`, `message: string` | Server error response |

**`error` optional field**: `correlationId: string` — matches the originating message `id` when applicable.

### `message_received.envelope` Structure

The `message_received` frame wraps all message data inside an `envelope` sub-object:

```json
{
  "type": "message_received",
  "envelope": {
    "id": "ObjectId string",
    "conversationId": "string",
    "serviceId": "string",
    "senderId": "string",
    "type": "text | voice | video | file",
    "text": "string | null",
    "attachment": {
      "blobId": "string",
      "fileName": "string",
      "mimeType": "string",
      "sizeBytes": 1024000,
      "durationMs": 5000
    } | null,
    "replyToId": "string | null",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Field name differences from 002 spec**:
- `senderId` (not `fromUserId` or `fromUserName`)
- No top-level `fromUserId`/`fromUserName` — user name must be looked up from presence data or `user_joined` events
- `text` is a flat string at the envelope level (not nested in `content`)
- `attachment` is an object or `null` (not `content`)

### Binary Frames

Binary frames are used exclusively for live voice audio payloads.

**Rules**:
- A `voice_chunk` text frame MUST be sent immediately before the binary frame.
- The binary frame contains the raw audio bytes (Opus codec recommended, no framing headers).
- The server correlates the binary payload with the most recent `voice_chunk` text frame using the same WebSocket connection.
- Chunks are ordered by `sequenceNumber` for reassembly on the receiving side.
- Client MUST decode binary frames by correlating them with the preceding `voice_chunk` text envelope.

---

## Error Codes

| Code | Meaning | Client Action |
|------|---------|---------------|
| `invalid_token` | JWT is missing, expired, or malformed | Show auth error; do not retry |
| `rate_limit_exceeded` | Too many messages sent (100/min text, 10/min voice) | Disable send button for 5s; show toast |
| `not_participant` | User is not a member of the target conversation | Redirect to conversation list |
| `invalid_message` | Message format violated schema (empty text, >10,000 chars) | Highlight composer in red; show error detail |
| `service_not_found` | Target service does not exist | Show error; return to service selector |
| `invalid_reply` | `replyToId` references a nonexistent message or a message from a different conversation | Show toast; dismiss reply preview |
| `invalid_attachment` | File attachment validation failed (missing blobId, fileName, invalid sizeBytes) | Show toast with error detail |
| `voice_processing_error` | Server failed to process a voice chunk | Show warning in UI; log in protocol panel |
| `voice_assembly_error` | No voice data found to assemble a voice message | Show warning; discard incomplete voice session |
| `server_error` | Internal server error | Show generic error toast |

---

## Sequence Diagram: Text Message Flow

```text
Client                              Server
  |                                   |
  |-- ws://localhost:8080/ws?token -> |  (JWT in query param)
  |-------- join_service ------------>|  (serviceId only, no token)
  |<------- user_joined --------------|
  |                                   |
  |-------- text_message ------------>|  {id, conversationId, serviceId, text}
  |<------- delivered ----------------|  {messageId}
  |<------- message_received ---------|  {envelope: {id, senderId, type, text, ...}}
  |                                   |
```

## Sequence Diagram: Live Voice Flow

```text
Client                              Server
  |                                   |
  |-------- voice_chunk (text) ------>|  {id, conversationId, sequenceNumber, isFinal}
  |-------- [binary audio] ---------->|  (raw Opus bytes)
  |-------- voice_chunk (text) ------>|
  |-------- [binary audio] ---------->|
  |-------- voice_chunk (final) ----->|  {id, ..., isFinal: true}
  |-------- [binary audio] ---------->|
  |<------- message_received ---------|  {envelope: {senderId, type: "voice", attachment: {blobId, ...}}}
  |                                   |
```

## Sequence Diagram: File Attachment Flow

```text
Client                              Server
  |                                   |
  |-- POST /api/upload/file -------->|  (multipart/form-data)
  |<-- 200 {blobId, fileName, ...} --|  (REST: get blobId first)
  |                                   |
  |-------- file_attachment --------->|  {id, conversationId, blobId, fileName, mimeType, sizeBytes}
  |<------- delivered ----------------|  {messageId}
  |<------- message_received ---------|  {envelope: {type: "file"|"video"|"voice", attachment: {...}}}
  |                                   |
```

---

**Note**: This contract is the source of truth for `src/protocol/messageTypes.js`, `src/protocol/builders.js`, and `src/protocol/parsers.js`. All implementations MUST match these field names and shapes exactly.