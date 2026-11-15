# SignBridge

**SignBridge** is a real-time, bidirectional communication bridge between deaf or hard-of-hearing signers and spoken-language speakers using a standard webcam and microphone.

Gemini watches hand gestures, finger shapes, and facial expressions in real time, speaks the natural first-person translation aloud, and transcribes spoken replies back onto the screen in high-legibility live captions.

---

## Key Features

- **Real-Time Sign & Facial Expression Translation**: Watches both hand movements and grammatical facial cues (raised eyebrows for questions, furrowed brows, head tilts, smiles, urgency) and speaks direct first-person translations aloud.
- **Live Spoken-Reply Captions**: Streams microphone audio to Gemini Live Transcription (`gemini-3.5-transcribe-live`) to display interim words as a speaker talks, then finalizes them into a chronological conversation log.
- **Auto-Watch Phrase Detection & Manual Control**: Automatically detects when a signer begins gesturing and pauses (`MotionPhraseStateMachine`), or lets the user trigger **Translate & Speak Sign** manually at any moment.
- **Echo-Suppression Gating**: Automatically pauses outgoing microphone audio streaming while synthesized voice output is playing so the app never transcribes its own spoken output.
- **Sample Signer Mode**: Built-in studio reference poses (`Friendly Greeting`, `Clarifying Question`) allow full end-to-end vision and voice synthesis testing without requiring physical webcam hardware.
- **Type-to-Speak & Phraseboard**: Allows deaf or hard-of-hearing users to type any custom message or tap common clarification phrases for immediate spoken playback.
- **Accessibility-First Interface**:
  - Selectable caption font sizes (`Standard`, `Large`, `Extra Large`).
  - Toggleable **High Contrast Dark** theme (`#0B0E14` / `#FFFFFF` / high-visibility amber accents).
  - Multi-dialect sign language selection (`ASL`, `BSL`, `ISL`, `Universal Gestures`) and target spoken languages (`English`, `Spanish`, `French`, `German`, `Japanese`, `Hindi`).
  - Searchable, filterable conversation transcript with per-turn audio replay and `.txt` export.

---

## Architecture Overview

SignBridge uses a full-stack **React + Vite + Express + WebSocket** architecture where all `@google/genai` SDK calls run strictly on the server:

```text
Browser (React 19)                         Node / Express Server (server.ts)              Gemini API
──────────────────                         ─────────────────────────────────              ──────────
Webcam (1 FPS JPEG + Motion) ──WS /ws/bridge──▶ Sign-Watch Session          ──────────▶ gemini-3.8-live
                                                (Modality.AUDIO + Transcript)             (24kHz PCM + Text)
Microphone (16kHz PCM)       ──WS /ws/bridge──▶ Transcribe Session          ──────────▶ gemini-3.5-transcribe-live
                                                (Modality.TEXT)                           (Interim + Final STT)
Burst Frames / Sample Pose   ──POST /api/interpret-sign──▶ Vision + TTS     ──────────▶ gemini-4-hydrogen /
                                                                                          gemini-3.1-flash-lite +
                                                                                          gemini-3.8-flash-lite-tts
Type-to-Speak / Phraseboard  ──POST /api/speak──────────▶ Expressive TTS    ──────────▶ gemini-3.8-flash-lite-tts
Recorded Reply Audio Clip    ──POST /api/transcribe-audio─▶ Clip STT        ──────────▶ gemini-3.5-transcribe
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed audio/video pipeline specifications and [docs/API.md](docs/API.md) for full HTTP and WebSocket schemas.

---

## Project Structure

```text
.
├── .env.example                     # Environment variable template
├── index.html                       # Document metadata & Google Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono)
├── metadata.json                    # App permissions (camera, microphone) & capabilities
├── package.json                     # Dependencies & npm scripts
├── server.ts                        # Express HTTP server, REST endpoints, WebSocket upgrade & Vite middleware
├── server/
│   └── geminiBridge.ts              # Server-side @google/genai client, Live WS bridge, Vision & TTS handlers
├── docs/
│   ├── ARCHITECTURE.md              # Deep-dive system, audio/video pipeline, and state machine documentation
│   └── API.md                       # REST & WebSocket protocol specification
├── src/
│   ├── App.tsx                      # Root layout, theme management, and tab routing
│   ├── index.css                    # Tailwind CSS v4 configuration & custom dark variant
│   ├── main.tsx                     # React entry point
│   ├── assets/images/               # Generated studio reference frames for Sample Signer mode
│   ├── components/
│   │   ├── TopBar.tsx               # Three-zone navigation header & primary Live Bridge toggle
│   │   ├── SignerStage.tsx          # Webcam/Sample viewport, motion indicator & gesture controls
│   │   ├── LiveCaptionBanner.tsx    # High-visibility real-time spoken reply caption banner
│   │   ├── ConversationStream.tsx   # Chronological dialogue log with search, filter, replay & export
│   │   ├── QuickPhrasePanel.tsx     # Type-to-Speak composer & quick phraseboard
│   │   └── PreferencesPanel.tsx     # Language, voice persona, caption size & contrast settings
│   ├── hooks/
│   │   ├── useAudioPlayback.ts      # 24kHz gapless PCM chunk scheduler & WAV audio playback
│   │   └── useBridgeSession.ts      # Webcam/mic capture, WS lifecycle, motion polling & REST actions
│   ├── types/
│   │   └── bridge.ts                # Shared TypeScript interfaces, presets & phraseboard catalog
│   └── utils/
│       ├── audioPcm.ts              # Pure Float32 <-> Int16 base64 PCM & RMS energy utilities
│       ├── motionDetector.ts        # Frame luminance delta & MotionPhraseStateMachine
│       ├── transcriptUtils.ts       # Tabular time formatting, turn filtering & .txt export
│       └── bridgeLogic.test.ts      # Node.js unit tests for pure audio, motion & transcript logic
├── tsconfig.json                    # TypeScript configuration
└── vite.config.ts                   # Vite bundler configuration
```

---

## Prerequisites & Environment Variables

- **Node.js** `>= 20` (tested on Node `22.x`)
- **Gemini API Key** configured in the server environment

Copy `.env.example` to `.env` for local development outside AI Studio:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Yes | Server-side Gemini API key used by `server/geminiBridge.ts`. Never exposed to the browser. |
| `PORT` | No | Server listening port (defaults to `3000`). |
| `APP_URL` | No | Public application URL when deployed behind a proxy. |

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run in Development

Starts the Express server (`server.ts`) on `http://localhost:3000` with Vite middleware and WebSocket `/ws/bridge` support:

```bash
npm run dev
```

### 3. Build & Run for Production

```bash
npm run build
NODE_ENV=production npm start
```

### 4. Typecheck & Unit Tests

Run TypeScript typechecking:

```bash
npm run lint
```

Run pure logic unit tests (`audioPcm`, `motionDetector`, `transcriptUtils`) using Node's native test runner via `tsx`:

```bash
npx --yes tsx --test src/utils/bridgeLogic.test.ts
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js, Express 4, `ws` WebSocket Server, `tsx`
- **AI SDK & Models**: `@google/genai` (`gemini-3.8-live`, `gemini-3.5-transcribe-live`, `gemini-4-hydrogen`, `gemini-3.1-flash-lite`, `gemini-3.8-flash-lite-tts`, `gemini-3.5-transcribe`)
- **Testing**: `node:test` + `node:assert/strict`
