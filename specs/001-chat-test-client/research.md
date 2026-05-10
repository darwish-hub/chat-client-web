# Research: ChatHub Web Test Client

**Date**: 2026-05-10  
**Feature**: ChatHub Web Test Client  
**Purpose**: Resolve technical unknowns and document technology decisions for the implementation plan.

---

## Decision: Native WebSocket over SignalR

**Rationale**: The server exposes a native WebSocket endpoint with a custom JSON wire format. Using SignalR or any other abstraction would hide the exact protocol frames that the test client is meant to validate. Native `WebSocket` gives full control over handshake headers, binary frames, and close codes.

**Alternatives considered**:
- SignalR Client: Rejected — adds a dependency and abstracts the wire protocol.
- Socket.IO: Rejected — introduces its own protocol on top of WebSocket.

---

## Decision: React and Build Tool Dependencies

**Rationale**: The client is now a React single-page application. A build step and React ecosystem packages are required to support JSX, component-based architecture, and modern development workflows. All required browser APIs (`WebSocket`, `fetch`, `MediaRecorder`, `getUserMedia`, `AudioContext`) remain native.

**Alternatives considered**:
- Vanilla JS (no build step): Rejected — the project has evolved to require a component-based UI framework.
- Axios: Rejected — `fetch()` is sufficient for REST calls.

---

## Decision: React for UI Layer

**Rationale**: The constitution and plan now mandate React for the UI layer. React provides a declarative component model, hooks for stateful logic, and a robust ecosystem for testing. The build step is acceptable given the project's evolution from a lightweight test tool to a maintainable client.

**Alternatives considered**:
- Vanilla JS: Rejected — lacks component reusability and modern state management for a growing feature set.
- Vue (CDN build): Rejected — React is the project's chosen framework.

---

## Decision: MediaRecorder with 200ms Timeslice for Live Voice

**Rationale**: `MediaRecorder` with `timeslice: 200` produces chunks at regular intervals suitable for real-time streaming. The 200ms window balances latency (sub-500ms target) with chunk overhead. The `audio/webm` or `audio/ogg` codecs are widely supported in target browsers.

**Alternatives considered**:
- ScriptProcessorNode (deprecated): Rejected — deprecated API, replaced by AudioWorklet which requires more setup.
- Pre-recorded file upload: Rejected — would not test the live streaming path.

---

## Decision: XMLHttpRequest for Upload Progress

**Rationale**: `fetch()` does not natively expose upload progress in all target browsers without `ReadableStream` complexity. `XMLHttpRequest` provides straightforward `progress` events for large file uploads up to 100MB.

**Alternatives considered**:
- `fetch()` with `ReadableStream`: Rejected — more complex and less universally supported for upload progress tracking.

---

## Decision: In-Memory State with `Map` and `localStorage` for Auth Only

**Rationale**: Per the constitution, messages must not be durably persisted client-side. `Map` provides fast lookup and iteration for conversation and message stores. `localStorage` is used only for JWT token and connection settings to improve developer experience across reloads.

**Alternatives considered**:
- IndexedDB: Rejected — would violate the principle of not durably persisting messages.
- `sessionStorage`: Rejected — less convenient for developers who reload the page during testing.

---

## Decision: Exponential Backoff for Reconnection (1s → 2s → 4s → 8s → max 30s)

**Rationale**: Standard TCP-friendly reconnection strategy. Prevents thundering herd against a recovering server while ensuring relatively fast recovery for transient network blips.

**Alternatives considered**:
- Fixed 5s retry: Rejected — too aggressive under high load; too slow for quick blips.
- Linear backoff: Rejected — exponential is standard practice and more server-friendly.

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| How to track upload progress without framework? | Use `XMLHttpRequest` with `progress` event listener. |
| How to play voice chunks without gaps? | Use `AudioContext` with `AudioBufferSourceNode` and schedule start times precisely. |
| How to simulate packet loss for testing? | Add a client-side toggle that randomly skips `ws.send()` calls with visual warning. |
| How to handle binary + text frames in sequence? | Parser assumes: text envelope first, then immediately binary payload; enforce in transport layer. |

---

**Status**: All unknowns resolved. Ready for Phase 1 design.
