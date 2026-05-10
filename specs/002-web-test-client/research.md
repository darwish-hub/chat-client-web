# Research: ChatHub Web Test Client (React)

**Date**: 2026-05-10
**Feature**: ChatHub Web Test Client
**Purpose**: Resolve technical unknowns and document technology decisions for the implementation plan.

---

## Decision: React 18+ for UI Layer

**Rationale**: React provides a declarative component model, hooks for stateful logic, and a robust ecosystem for testing. The build step is acceptable given the project's evolution from a lightweight test tool to a maintainable client with complex UI state (multi-panel layout, real-time updates, media playback).

**Alternatives considered**:
- Vanilla JS: Rejected — lacks component reusability and modern state management for a growing feature set.
- Vue 3: Rejected — React is more commonly used in the ecosystem and has better tooling for testing.

---

## Decision: Vite as Build Tool

**Rationale**: Vite provides fast development server startup, hot module replacement (HMR), and optimized production builds. It has first-class support for React and JSX without complex configuration.

**Alternatives considered**:
- Create React App (CRA): Rejected — slower, no longer actively maintained, larger bundle size.
- Webpack: Rejected — more complex configuration than needed for this project.

---

## Decision: Native WebSocket over SignalR

**Rationale**: The server exposes a native WebSocket endpoint with a custom JSON wire format. Using SignalR or any other abstraction would hide the exact protocol frames that the test client is meant to validate. Native `WebSocket` gives full control over handshake headers, binary frames, and close codes.

**Alternatives considered**:
- SignalR Client: Rejected — adds a dependency and abstracts the wire protocol.
- Socket.IO: Rejected — introduces its own protocol on top of WebSocket.

---

## Decision: React Testing Library for Component Tests

**Rationale**: React Testing Library is the standard for testing React components. It encourages testing from the user's perspective rather than implementation details, aligning with the test client's purpose of validating user-facing behavior.

**Alternatives considered**:
- Enzyme: Rejected — discontinued, no longer maintained.
- Cypress: Rejected — e2e testing is overkill for unit/component tests; manual browser testing covers e2e.

---

## Decision: In-Memory State with `Map` and `localStorage` for Auth Only

**Rationale**: Per the constitution, messages must not be durably persisted client-side. `Map` provides fast lookup and iteration for conversation and message stores. `localStorage` is used only for JWT token and connection settings to improve developer experience across reloads.

**Alternatives considered**:
- IndexedDB: Rejected — would violate the principle of not durably persisting messages.
- `sessionStorage`: Rejected — less convenient for developers who reload the page during testing.
- Redux/Zustand: Rejected — state management libraries add unnecessary abstraction for this scope.

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
| How to structure React components for layered architecture? | Components live in `ui/` layer; hooks for stateful logic; custom hooks for cross-cutting concerns (e.g., useWebSocket, useVoiceRecorder). |

---

**Status**: All unknowns resolved. Ready for Phase 1 design.
