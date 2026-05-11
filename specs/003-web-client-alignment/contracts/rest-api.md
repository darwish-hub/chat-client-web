# REST API Contract

**Scope**: Client ↔ Server HTTP communication  
**Base URL**: `http://localhost:8080`  
**Format**: JSON request/response bodies; `multipart/form-data` for uploads  
**Authentication**: Bearer token via `Authorization: Bearer <JWT>` header

**Important**: All conversation-related endpoints use singular path segments (`/api/conversation/`, NOT `/api/conversations/`). This matches the actual server implementation.

---

## Endpoints

### Conversations

#### `POST /api/conversation`

Create a new conversation.

**Request Body**:
```json
{
  "serviceId": "string",
  "title": "string | null",
  "participantIds": ["string"]
}
```

**Request Fields**:
- `serviceId` (required): Service to create conversation in
- `title` (optional): Conversation name
- `participantIds` (required): Array of user IDs (the creator is automatically added if not included)

**Response 201**:
```json
{
  "id": "string",
  "serviceId": "string",
  "participantIds": ["string"],
  "title": "string | null",
  "createdBy": "string",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastMessageAt": "string | null"
}
```

**Errors**: `401` (invalid token), `403` (not authorized for service), `400` (invalid participants or missing fields)

---

#### `GET /api/conversation`

List conversations the authenticated user participates in.

**Query Params**: `?serviceId=<string>` (optional filter)

**Response 200**:
```json
[
  {
    "id": "string",
    "serviceId": "string",
    "participantIds": ["string"],
    "title": "string | null",
    "createdBy": "string",
    "createdAt": "2024-01-15T10:30:00Z",
    "lastMessageAt": "string | null"
  }
]
```

**Errors**: `401`

---

#### `GET /api/conversation/{id}`

Get a single conversation by ID.

**Response 200**: Same shape as a single conversation object.

**Errors**: `401`, `403` (not a participant), `404`

---

### Messages / History

#### `GET /api/conversation/{conversationId}/messages`

Fetch message history for a conversation.

**Path Params**: `conversationId` (UUID)

**Query Params**:
- `before` (ISO datetime, optional): Fetch messages before this timestamp
- `limit` (number, default 50, max 200): Number of messages to return

**Response 200**:
```json
{
  "conversationId": "string",
  "messages": [
    {
      "id": "string",
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
  ],
  "hasMore": true
}
```

**Important**: The response is an object with `conversationId`, `messages` array, and `hasMore` boolean — NOT a plain array.

**Errors**: `401`, `403` (not a participant), `404` (conversation not found)

---

#### `GET /api/conversation/{conversationId}/messages/{messageId}/replies`

Fetch reply thread for a specific message.

**Response 200**:
```json
{
  "originalMessage": {
    "id": "string",
    "senderId": "string",
    "type": "string",
    "text": "string | null",
    "attachment": {} | null,
    "replyToId": "string | null",
    "createdAt": "string"
  },
  "replies": [
    {
      "id": "string",
      "senderId": "string",
      "type": "string",
      "text": "string | null",
      "attachment": {} | null,
      "replyToId": "string | null",
      "createdAt": "string"
    }
  ]
}
```

**Important**: The response is an object with `originalMessage` and `replies` array — NOT a plain array.

**Errors**: `401`, `403`, `404`

---

### Upload

#### `POST /api/upload/file`

Upload a file attachment.

**Request**: `multipart/form-data`
- `file` (required): Binary file data (max 100MB)
- `durationMs` (optional, form field): Media duration in milliseconds

**Response 200** (NOT 201):
```json
{
  "blobId": "string",
  "fileName": "string",
  "mimeType": "string",
  "sizeBytes": 12345,
  "durationMs": 5000,
  "url": "string | null"
}
```

**Important**: 
- Response status is `200` (not `201`).
- Client MUST validate file size ≤ 100MB before upload.
- Server infers message type from MIME: `audio/*` → `"voice"`, `video/*` → `"video"`, else → `"file"`.

**Errors**: `401`, `413` (file too large), `415` (unsupported media type)

---

### Download

#### `GET /api/upload/download/{blobId}`

Download a previously uploaded file.

**Response**: 
- `200`: Binary file data with `Content-Type` and `Content-Disposition` headers
- `302`: Redirect to a pre-signed S3 URL (5 minute expiry)

**Errors**: `401` (or may be `[AllowAnonymous]` depending on server config), `404` (blob not found)

**Note**: The download endpoint may not require authentication if the server has `[AllowAnonymous]` on it. Client should handle both authenticated and public download flows.

---

### Presence

#### `GET /api/services/{serviceId}/online`

Fetch currently online users in a service.

**Response 200**:
```json
{
  "serviceId": "string",
  "onlineUsers": [
    {
      "userId": "string",
      "displayName": "string",
      "lastSeen": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Important**: The response is an object with `serviceId` and `onlineUsers` array — NOT a plain array. Each user has `displayName` (not `userName`) and `lastSeen`.

**Errors**: `401`, `404` (service not found)

---

#### `GET /api/services/{serviceId}/online/{userId}`

Check if a specific user is online.

**Response 200**:
```json
{
  "serviceId": "string",
  "userId": "string",
  "isOnline": true
}
```

---

### Health

#### `GET /healthz`

Liveness check.

**Response 200**:
```json
{
  "status": "Healthy",
  "timestamp": "..."
}
```

---

#### `GET /readyz`

Readiness check.

**Response 200**:
```json
{
  "status": "Healthy"
}
```

**Response 503**: Service not ready

---

## Common Response Patterns

All error responses follow this structure:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

**Standard HTTP Status Codes**:
- `200` — Success
- `201` — Created (conversation creation)
- `400` — Bad Request (validation failure)
- `401` — Unauthorized (invalid or missing JWT)
- `403` — Forbidden (not a participant / not authorized)
- `404` — Not Found
- `413` — Payload Too Large
- `415` — Unsupported Media Type
- `429` — Too Many Requests (rate limited)
- `500` — Internal Server Error

Rate limit headers may be included:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1705315800
```

---

**Note**: This contract is the source of truth for all files under `src/api/`. All implementations MUST use these exact paths and parse these exact response shapes.