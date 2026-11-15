# SignBridge Technical Architecture

This document explains the internal design of **SignBridge**, including its dual-channel Gemini Live architecture, client-side audio/video pipelines, phrase-boundary detection state machine, and accessibility design decisions.

---

## 1. Dual-Channel Real-Time Bridge Design

A naive single-session voice assistant causes two major problems in a human-to-human sign/speech bridge:
1. **Conversational Interference**: When a hearing person replies, a general conversational model tries to *answer* the hearing person as an AI assistant instead of transcribing their words verbatim for the deaf user.
2. **Audio Feedback Loops**: When the app speaks the signer's translation aloud, the local microphone can pick up the speaker output and transcribe itself.

SignBridge solves both cleanly in `server/geminiBridge.ts` and `src/hooks/useBridgeSession.ts`:

### Isolated Server-Side Gemini Sessions (`/ws/bridge`)
Each active WebSocket client opens **two concurrent, isolated Gemini Live sessions**:

1. **Sign-Watch Session (`gemini-3.8-live`)**
   - **Inputs**: Webcam JPEG frames (`image/jpeg`) streamed at `1 FPS` via `sendRealtimeInput({ video })`, plus phrase interpretation triggers (`sendClientContent`).
   - **Outputs**: `Modality.AUDIO` (24kHz mono 16-bit PCM) + `outputAudioTranscription` text chunks.
   - **Role**: Strictly acts as a transparent first-person voice for the signer, translating hand gestures and facial expressions without AI preamble.
   - **Isolation**: Microphone audio is *never* sent to this session.

2. **Spoken-Reply Transcribe Session (`gemini-3.5-transcribe-live`)**
   - **Inputs**: Microphone 16kHz mono 16-bit PCM audio streamed via `sendRealtimeInput({ audio })`.
   - **Outputs**: `Modality.TEXT` emitting `interimInputTranscription` (live partial captions as the speaker talks) and finalized `inputTranscription` turns.
   - **Role**: Pure verbatim live captioning for the deaf/hard-of-hearing user.

---

## 2. Audio Capture, Encoding & Playback Pipeline

### Microphone Capture (`src/hooks/useBridgeSession.ts` & `src/utils/audioPcm.ts`)
- Opens `navigator.mediaDevices.getUserMedia` with `echoCancellation: true`, `noiseSuppression: true`, and `autoGainControl: true`.
- Creates an `AudioContext({ sampleRate: 16000 })` and processes audio frames via `ScriptProcessorNode(4096, 1, 1)`.
- Computes normalized RMS amplitude (`computeRmsEnergy`) for the live microphone level meter in `LiveCaptionBanner.tsx`.
- Encodes Float32 samples `[-1, 1]` to 16-bit little-endian PCM base64 (`float32ToInt16Base64`) and transmits over WebSocket **only when**:
  - `!micMutedRef.current`
  - `!isPlayingRef.current` (echo-suppression gate while TTS or Live audio is actively playing)

### Gapless 24kHz Playback (`src/hooks/useAudioPlayback.ts`)
- Live API audio chunks arrive as raw headerless 24kHz Int16 PCM base64.
- `base64Int16ToFloat32` decodes little-endian `Int16` samples into `Float32Array` buffers.
- `enqueuePcmChunk` schedules each `AudioBufferSourceNode` using a monotonic `nextStartTimeRef` cursor (`source.start(startAt)`), eliminating network-jitter clicks and overlaps.
- Unary REST audio from `/api/interpret-sign` and `/api/speak` returns complete RIFF WAV files (`audio/wav`, 24kHz) played via `HTMLAudioElement` (`playAudioDataUrl`).

---

## 3. Video Frame Buffering & Auto-Watch Motion State Machine

Sign language relies on movement over time rather than single static poses.

### Frame Extraction
- **Live Camera**: Captures `640px`-wide JPEG frames from the `<video>` element once per second (`1 FPS`) for Gemini Live streaming and keeps a rolling buffer of the 5 most recent frames for multi-frame burst interpretation (`/api/interpret-sign`).
- **Sample Signer**: Draws the selected studio signer reference image onto a `640x480` offscreen canvas and extracts real JPEG data for backend vision evaluation.

### Motion Phrase State Machine (`src/utils/motionDetector.ts`)
Every `250ms`, the client downsamples the video feed to `64x48` grayscale pixels and computes mean pixel delta (`computeFrameMotion`):

```text
  [idle] ──(energy >= startThreshold)──▶ [signing]
    ▲                                       │  ▲
    │                         (energy < settleThreshold)  (energy >= startThreshold)
    │                                       ▼  │
  (now >= cooldownUntil)               [settling]
    │                                       │
    │                         (settled >= settleDurationMs)
    └─── [cooldown] ◀───────────────────────┘
                          (triggers interpret_sign)
```

- Configurable settle durations in **Preferences**: `Fast (0.8s)`, `Balanced (1.1s)`, and `Patient (1.6s)`.
- Prevents premature triggers mid-sentence and prevents repeated triggers while the signer is resting.

---

## 4. Multi-Frame Vision & Expressive TTS Fallback (`/api/interpret-sign`)

When the user clicks **Translate & Speak Sign** (either with live camera rolling frames or in **Sample Signer** mode):
1. `interpretSignFrames` in `server/geminiBridge.ts` sends up to 6 chronological frames plus recent conversation history to Gemini (`gemini-4-hydrogen` with fallback to `gemini-3.1-flash-lite`) requesting structured JSON:
   - `hasSign`: whether a communicative gesture/expression is visible
   - `spokenText`: direct first-person spoken translation
   - `expressionTone`: observed facial expression / grammatical tone (e.g., `"Raised eyebrows, inquisitive"`)
   - `gestureCue`: brief description of hand shape/movement
   - `confidence`: `"high" | "medium" | "low"`
2. If `hasSign` is `true`, `synthesizeSpeech` calls `gemini-3.8-flash-lite-tts` (`apiVersion: 'v1beta'`) passing `speechMetadata: { style: expressionTone }` so the spoken voice matches the signer's facial expression.

---

## 5. Accessibility & Styling Architecture

- **Typography**: `Plus Jakarta Sans` (display/headers), `DM Sans` (high-legibility captions and body), `JetBrains Mono` (`tabular-nums` timestamps and turn counters).
- **Theme Switching**: Uses Tailwind CSS v4 `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`. Toggling **High Contrast Dark** applies `.dark` to `<html>` with paired high-contrast surfaces (`bg-slate-950`, `text-white`, `amber-300` accents).
- **Caption Scaling**: `Standard`, `Large`, and `Extra Large` text scale presets dynamically adjust both `LiveCaptionBanner` and `ConversationStream`.
- **Reduced Motion**: Global `@media (prefers-reduced-motion: reduce)` rule minimizes transitions and animations.
