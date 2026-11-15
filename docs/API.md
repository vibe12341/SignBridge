# SignBridge API & WebSocket Reference

All AI endpoints are served by the Express server in `server.ts` and implemented in `server/geminiBridge.ts`. The browser never imports `@google/genai` or accesses `GEMINI_API_KEY`.

---

## 1. REST Endpoints

### `GET /api/health`
Returns server health and whether `GEMINI_API_KEY` is configured.

**Response (`200 OK`)**
```json
{
  "ok": true,
  "hasApiKey": true
}
```

---

### `POST /api/interpret-sign`
Analyzes 1–6 chronological JPEG camera frames of a signer's hands and facial expressions, returns a structured translation with observed expression cues, and synthesizes expressive WAV audio.

**Request Body**
```json
{
  "frames": ["<base64-or-data-url-jpeg>"],
  "signLanguage": "ASL (American Sign Language)",
  "targetSpokenLanguage": "English",
  "voiceName": "Zephyr",
  "contextHistory": [
    "Speaker: Hello, how can I help you?",
    "Signer: Where is the pharmacy?"
  ]
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `frames` | `string[]` | Yes | Array of JPEG frames (base64 or `data:image/jpeg;base64,...`). Max last 6 frames used. |
| `signLanguage` | `string` | No | Defaults to `"ASL (American Sign Language)"`. |
| `targetSpokenLanguage` | `string` | No | Defaults to `"English"`. |
| `voiceName` | `string` | No | One of `Zephyr`, `Kore`, `Puck`, `Charon`, `Fenrir`. Defaults to `Zephyr`. |
| `contextHistory` | `string[]` | No | Up to 4 recent turns for conversational context. |

**Response (`200 OK`)**
```json
{
  "hasSign": true,
  "spokenText": "Hi there, nice to meet you!",
  "expressionTone": "Warm welcoming smile",
  "gestureCue": "Both hands raised with open palms",
  "confidence": "high",
  "audioBase64": "<base64-wav-data>",
  "audioMimeType": "audio/wav"
}
```

When no communicative sign is visible (`hasSign: false`), `spokenText` is `""` and `audioBase64` is omitted.

**Error Responses**
- `400 Bad Request`: Missing or empty `frames` array.
- `500 Internal Server Error`: `{ "error": "<human-readable message>" }`.

---

### `POST /api/speak`
Synthesizes text into spoken 24kHz WAV audio using `gemini-3.8-flash-lite-tts`. Used by **Type-to-Speak**, **Phraseboard**, and **Preview Voice**.

**Request Body**
```json
{
  "text": "Could you please speak a little slower?",
  "voiceName": "Zephyr",
  "style": "Polite, clear request"
}
```

**Response (`200 OK`)**
```json
{
  "audioBase64": "<base64-wav-data>",
  "audioMimeType": "audio/wav"
}
```

---

### `POST /api/transcribe-audio`
Transcribes a recorded audio reply clip (`.webm` / `.mp3` / `.wav`) into text using `gemini-3.5-transcribe`. Used by the **Record Reply Clip** fallback control when the WebSocket Live Bridge is not active.

**Request Body**
```json
{
  "audioBase64": "<base64-or-data-url-audio>",
  "mimeType": "audio/webm"
}
```

**Response (`200 OK`)**
```json
{
  "transcript": "Yes, I can walk you right over there."
}
```

---

## 2. WebSocket Protocol (`WS /ws/bridge`)

Connect via `ws://<host>/ws/bridge` (or `wss://<host>/ws/bridge` over HTTPS). All payloads are JSON strings.

### Client → Server Messages

1. **Initialize Dual Live Sessions (`start`)**
   Must be sent after opening the WebSocket connection.
   ```json
   {
     "type": "start",
     "signLanguage": "ASL (American Sign Language)",
     "targetSpokenLanguage": "English",
     "voiceName": "Zephyr"
   }
   ```

2. **Stream Webcam Frame (`video`)**
   Sent at `1 FPS` while Live Bridge is active.
   ```json
   {
     "type": "video",
     "data": "<base64-jpeg-frame>"
   }
   ```

3. **Stream Microphone Audio (`audio`)**
   Sent continuously as 16kHz, mono, 16-bit little-endian PCM base64 chunks (gated when muted or while TTS audio is playing).
   ```json
   {
     "type": "audio",
     "data": "<base64-pcm16-16khz>"
   }
   ```

4. **Trigger Sign Interpretation (`interpret_sign`)**
   Triggered automatically by `MotionPhraseStateMachine` when a signing gesture settles, or manually.
   ```json
   {
     "type": "interpret_sign",
     "hint": "The signer just finished a gesture sequence in ASL. Speak the direct English translation aloud now."
   }
   ```

---

### Server → Client Messages

Every server message includes a `channel` field (`"system"`, `"sign"`, or `"transcribe"`):

| Channel | Type | Payload Fields | Description |
| :--- | :--- | :--- | :--- |
| `system` | `ready` | — | Both Gemini Live sessions connected and ready. |
| `system` | `error` | `message: string` | Configuration, API, or session error message. |
| `sign` | `audio` | `audio: string` | Base64 24kHz mono 16-bit PCM spoken translation chunk. |
| `sign` | `output_transcript` | `text: string` | Incremental transcript of Gemini's spoken translation. |
| `sign` | `turn_complete` | — | Signer voice turn finished; client finalizes turn card. |
| `sign` | `interrupted` | — | Playback interrupted; client stops queued audio buffers. |
| `transcribe` | `interim` | `text: string` | Low-latency partial caption while hearing speaker talks. |
| `transcribe` | `final` | `text: string` | Finalized spoken reply sentence appended to transcript. |
