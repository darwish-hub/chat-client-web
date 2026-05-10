# Data Model: ChatHub Web Test Client

**Date**: 2026-05-10
**Feature**: ChatHub Web Test Client
**Purpose**: Define client-side data structures and state transitions.

---

## Entities

### Conversation

A chat room representing a group of participants.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique identifier |
| `serviceId` | `string` | The service this conversation belongs to |
| `title` | `string` | Display name of the conversation |
| `participantIds` | `string[]` | List of user IDs who are members |
| `createdAt` | `ISO datetime` | When the conversation was created |
| `updatedAt` | `ISO datetime` | When the conversation was last updated |

**State**: No explicit state machine; conversations are immutable once created (except for participant list changes from server events).

---

### Message

A chat envelope representing any type of communication within a conversation.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique identifier (client-generated for outbound) |
| `conversationId` | `string` | Parent conversation |
| `fromUserId` | `string` | Sender's user ID |
| `fromUserName` | `string` | Sender's display name |
| `type` | `"text" \| "voice" \| "video" \| "file"` | Message content type |
| `content` | `object` | Type-specific payload (see below) |
| `replyToId` | `string \| null` | Reference to parent message if this is a reply |
| `createdAt` | `ISO datetime` | Timestamp of creation |
| `deliveredAt` | `ISO datetime \| null` | When server confirmed delivery |

**Content Payloads**:

- **text**: `{ text: string }`
- **voice**: `{ messageId: string, durationMs: number, url?: string }`
- **video**: `{ blobId: string, fileName: string, mimeType: string, sizeBytes: number, url?: string }`
- **file**: `{ blobId: string, fileName: string, mimeType: string, sizeBytes: number, url?: string }`

**State Transitions**:

```
[sent] → [delivered]  (on receiving `delivered` frame from server)
[sent] → [error]      (on receiving `error` frame with messageId)
```

---

### User

A participant in the chat system.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique user identifier (from JWT `sub` claim) |
| `name` | `string` | Display name (from JWT `name` claim) |
| `isOnline` | `boolean` | Current online status in the service |
| `isTyping` | `boolean` | Whether the user is currently typing |
| `typingConversationId` | `string \| null` | Which conversation they are typing in |

**State Transitions**:

```
[offline] → [online]  (on `user_joined` event)
[online]  → [offline] (on `user_left` event or timeout)
[not typing] → [typing] (on `typing` event with isTyping: true)
[typing] → [not typing] (on `typing` event with isTyping: false or 5s timeout)
```

---

### VoiceSession

An active live voice stream, tracking both outbound and inbound audio.

| Field | Type | Description |
|-------|------|-------------|
| `messageId` | `string` | Unique identifier for this voice message |
| `conversationId` | `string` | Target conversation |
| `direction` | `"outbound" \| "inbound"` | Whether this is a send or receive session |
| `sequenceNumber` | `number` | Current chunk sequence (0-indexed) |
| `isFinal` | `boolean` | Whether the final chunk has been sent/received |
| `chunks` | `ArrayBuffer[]` | Buffer of audio chunks (inbound only) |
| `startedAt` | `timestamp` | When recording/playback started |

**State Transitions (Outbound)**:

```
[idle] → [recording] → [streaming] → [completed]
```

**State Transitions (Inbound)**:

```
[idle] → [buffering] → [playing] → [completed]
```

---

### FileAttachment

A shared file metadata object.

| Field | Type | Description |
|-------|------|-------------|
| `blobId` | `string` | Server-generated blob identifier |
| `fileName` | `string` | Original file name |
| `mimeType` | `string` | MIME type (e.g., `application/pdf`) |
| `sizeBytes` | `number` | File size in bytes |
| `durationMs` | `number \| null` | Duration for audio/video files |
| `url` | `string \| null` | Download URL (null until upload completes) |

**State Transitions**:

```
[uploading] → [uploaded] → [shared]
```

---

## In-Memory Stores

The client uses `Map` instances for transient state:

- `conversationStore: Map<conversationId, Conversation>`
- `messageStore: Map<messageId, Message>`
- `presenceStore: Map<serviceId, Map<userId, User>>`
- `voiceSessionStore: Map<sessionKey, VoiceSession>`
- `fileAttachmentStore: Map<blobId, FileAttachment>`

**Store Rules**:
- All stores are cleared on page reload.
- No messages are persisted to `localStorage`.
- `localStorage` only stores JWT token and last connection settings.

---

## Validation Rules

1. **Message ID**: Must be a valid UUID v4 (client-generated for outbound messages).
2. **Conversation ID**: Must be a valid UUID.
3. **Content Text**: Maximum 2000 characters (enforced client-side before send).
4. **File Size**: Maximum 100MB (enforced before upload).
5. **Voice Chunk Size**: Each chunk must be < 64KB after encoding.
6. **Typing Debounce**: Minimum 300ms between `typing` events to prevent spam.

---

**Status**: Data model complete. Ready for contract definition.
