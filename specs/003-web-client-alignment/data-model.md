# Data Model: ChatHub Web Test Client (Aligned)

**Date**: 2026-05-11  
**Feature**: Web Client Realignment with ChatHub Server  
**Purpose**: Define client-side data structures and state transitions aligned with the actual server wire format.

---

## Changes from 002 Data Model

| Entity | Field | Old (002) | New (Aligned) | Reason |
|---|---|---|---|---|
| Message | `fromUserId` | Top-level field | Use `senderId` from envelope | Server sends `senderId`, not `fromUserId` |
| Message | `fromUserName` | Top-level field | Look up from presence store | Server doesn't send user name in messages |
| Message | `content` | Nested `{text}` object | Flat `text` field | Server uses flat `text`, not nested `content` |
| Message | `attachment` | In `content` | Top-level `attachment?` field | Server puts `attachment` alongside `text` |
| User | `name` | `userName` | `displayName` | Server sends `displayName` in `user_joined` |
| OnlineUser | Response shape | Array of users | `{serviceId, onlineUsers: [...]}` | REST API wraps in object |
| History | Response shape | Array of messages | `{conversationId, messages, hasMore}` | REST API wraps in object |
| Thread | Response shape | Array of messages | `{originalMessage, replies}` | REST API wraps in object |
| VoiceChunk | ID field | `messageId` | `id` | Server protocol uses `id` |

---

## Entities

### ConversationDocument

A conversation as returned by the REST API.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (server-generated) |
| `serviceId` | `string` | The service this conversation belongs to |
| `title` | `string \| null` | Display name (optional) |
| `participantIds` | `string[]` | List of user IDs who are members |
| `createdBy` | `string` | User ID of the creator |
| `createdAt` | `ISO datetime` | When the conversation was created |
| `lastMessageAt` | `ISO datetime \| null` | When the last message was sent |

**State**: No explicit state machine; conversations are mutable only via server events (participant changes).


### MessageEnvelope

The envelope object inside a `message_received` frame or a history REST response.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (ObjectId string from server, or client-generated UUID) |
| `conversationId` | `string` | Parent conversation |
| `serviceId` | `string` | Service context |
| `senderId` | `string` | Sender's user ID (NOT `fromUserId`) |
| `type` | `"text" \| "voice" \| "video" \| "file"` | Message content type |
| `text` | `string \| null` | Text content (flat field, NOT nested in `content`) |
| `attachment` | `Attachment \| null` | File/voice/video metadata (null for pure text) |
| `replyToId` | `string \| null` | Reference to parent message if this is a reply |
| `createdAt` | `ISO datetime` | Timestamp of creation |

**State Transitions**:

```
[sent] → [delivered]  (on receiving {type: "delivered", messageId} frame from server)
[sent] → [error]      (on receiving {type: "error", code, correlationId} frame)
```

---

### Attachment

File/voice/video metadata embedded in a `MessageEnvelope`.

| Field | Type | Description |
|-------|------|-------------|
| `blobId` | `string` | Server-generated blob identifier |
| `fileName` | `string` | Original or sanitized filename |
| `mimeType` | `string` | MIME type (e.g., `application/pdf`, `audio/webm`) |
| `sizeBytes` | `number` | File size in bytes |
| `durationMs` | `number \| null` | Duration for audio/video files |

---

### User

A participant in the chat system, tracked in the presence store.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique user identifier (from JWT `sub` claim) |
| `displayName` | `string` | Display name (from `user_joined.displayName`, NOT `userName`) |
| `lastSeen` | `ISO datetime \| null` | Last seen timestamp (from REST presence API) |
| `isOnline` | `boolean` | Current online status in the service |
| `isTyping` | `boolean` | Whether the user is currently typing |
| `typingConversationId` | `string \| null` | Which conversation they are typing in |

**State Transitions**:

```
[offline] → [online]  (on `user_joined` event or REST presence fetch)
[online]  → [offline] (on `user_left` event or timeout)
[not typing] → [typing] (on `typing` event with isTyping: true)
[typing] → [not typing] (on `typing` event with isTyping: false or 5s timeout)
```

---

### VoiceSession

An active live voice stream, tracking both outbound and inbound audio.

| Field | Type | Description |
|-------|------|-------------|
| `messageId` | `string` | Unique identifier for this voice message (field name `id` on the wire) |
| `conversationId` | `string` | Target conversation |
| `direction` | `"outbound" \| "inbound"` | Whether this is a send or receive session |
| `sequenceNumber` | `number` | Current chunk sequence (0-indexed) |
| `isFinal` | `boolean` | Whether the final chunk has been sent/received |
| `chunks` | `ArrayBuffer[]` | Buffer of audio chunks (inbound only) |
| `fromUserId` | `string` | Sender user ID (inbound only, from `voice_chunk.fromUserId`) |
| `startedAt` | `timestamp` | When recording/playback started |

**State Transitions (Outbound)**:

```
[idle] → [recording] → [streaming] → [completed]
```

**State Transitions (Inbound)**:

```
[idle] → [buffering] → [playing] → [completed]
```

**Wire format note**: The `voice_chunk` frame uses `id` for the message UUID, not `messageId`. Both outbound and inbound sessions key on this `id` value.

---

### FileAttachment

A shared file metadata object (for tracking pre-upload state).

| Field | Type | Description |
|-------|------|-------------|
| `blobId` | `string` | Server-generated blob identifier (empty until upload completes) |
| `fileName` | `string` | Original filename |
| `mimeType` | `string` | MIME type |
| `sizeBytes` | `number` | File size in bytes |
| `durationMs` | `number \| null` | Duration for audio/video files |
| `url` | `string \| null` | Download URL (null until upload completes) |

**Validation**: `sizeBytes` MUST be ≤ 100MB (104,857,600 bytes). Client-side validation MUST reject files exceeding this limit before initiating upload.

**State Transitions**:

```
[uploading] → [uploaded] → [shared]
```

---

### OnlineUsersResponse

Shape returned by `GET /api/services/{serviceId}/online`.

| Field | Type | Description |
|-------|------|-------------|
| `serviceId` | `string` | Service identifier |
| `onlineUsers` | `OnlineUser[]` | Array of online users |

### OnlineUser

| Field | Type | Description |
|-------|------|-------------|
| `userId` | `string` | User identifier |
| `displayName` | `string` | Display name (NOT `userName`) |
| `lastSeen` | `ISO datetime` | Last activity timestamp |

---

### HistoryResponse

Shape returned by `GET /api/conversation/{id}/messages`.

| Field | Type | Description |
|-------|------|-------------|
| `conversationId` | `string` | Conversation identifier |
| `messages` | `MessageEnvelope[]` | Array of messages (sorted chronologically) |
| `hasMore` | `boolean` | Whether more messages exist before the `before` cursor |

---

### ThreadResponse

Shape returned by `GET /api/conversation/{id}/messages/{msgId}/replies`.

| Field | Type | Description |
|-------|------|-------------|
| `originalMessage` | `MessageEnvelope` | The message being replied to |
| `replies` | `MessageEnvelope[]` | Array of reply messages |

---

### UploadResponse

Shape returned by `POST /api/upload/file`.

| Field | Type | Description |
|-------|------|-------------|
| `blobId` | `string` | Reference to use in `file_attachment` WebSocket message |
| `fileName` | `string` | Sanitized filename |
| `mimeType` | `string` | Detected MIME type |
| `sizeBytes` | `number` | File size |
| `durationMs` | `number \| null` | Media duration if provided during upload |
| `url` | `string \| null` | Pre-signed download URL (may be null) |

---

### ErrorResponse

Shape returned by REST API on error.

| Field | Type | Description |
|-------|------|-------------|
| `error.code` | `string` | Error code (`invalid_request`, `unauthorized`, `forbidden`, `not_found`, `rate_limited`, `internal_error`) |
| `error.message` | `string` | Human-readable error message |
| `error.details` | `object \| null` | Optional additional details |

WebSocket error frame shape:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"error"` | Frame type |
| `code` | `string` | Error code (see WebSocket protocol contract) |
| `message` | `string` | Human-readable message |
| `correlationId` | `string \| null` | Matches the originating message `id` when applicable |

---

## In-Memory Stores

The client uses `Map` instances for transient state:

- `conversationStore: Map<conversationId, ConversationDocument>`
- `messageStore: Map<messageId, MessageEnvelope>`
- `presenceStore: Map<serviceId, Map<userId, User>>`
- `voiceSessionStore: Map<sessionKey, VoiceSession>`
- `fileAttachmentStore: Map<blobId, FileAttachment>`

**Store Rules**:
- All stores are cleared on page reload.
- No messages are persisted to `localStorage`.
- `localStorage` only stores JWT token and last connection settings.
- `messageStore.add()` performs duplicate detection by `id` — if a message with the same `id` exists, it merges the new data into the existing entry rather than duplicating.
- Messages from history fetches MUST be inserted in chronological order, even if they arrive with older timestamps than the last visible message.

---

## Validation Rules

1. **Message ID**: Must be a valid UUID v4 (client-generated for outbound messages).
2. **Conversation ID**: Must be a valid UUID.
3. **Text Content**: Maximum 10,000 characters (server limit; client MAY enforce 2,000 as a softer UI limit).
4. **File Size**: Maximum 100MB (104,857,600 bytes) enforced client-side BEFORE upload.
5. **Voice Chunk Size**: Each chunk MUST be < 64KB after encoding; client SHOULD validate before sending.
6. **Typing Debounce**: Minimum 300ms between `typing` events to prevent server rate-limiting.
7. **File Attachment fields**: `blobId`, `fileName`, `mimeType`, `sizeBytes` are all required in `file_attachment` frames.
8. **Heartbeat**: Client MUST send `pong` within 10 seconds of receiving `ping`.
9. **Reconnection**: Exponential backoff starting at 1 second, max 30 seconds (1s → 2s → 4s → 8s → 16s → 30s → 30s...).

---

**Status**: Data model aligned with ChatHub server implementation.