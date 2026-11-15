import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
} from '@google/genai';
import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const VALID_VOICES = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);

function resolveVoice(voiceName?: string): string {
  if (voiceName && VALID_VOICES.has(voiceName)) {
    return voiceName;
  }
  return 'Zephyr';
}

export function createGenAIClient(apiVersion?: 'v1' | 'v1beta' | 'v1alpha'): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(apiVersion ? { apiVersion } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface SignInterpretationInput {
  frames: string[];
  signLanguage: string;
  targetSpokenLanguage: string;
  voiceName?: string;
  contextHistory?: string[];
}

export interface SignInterpretationResult {
  hasSign: boolean;
  spokenText: string;
  expressionTone: string;
  gestureCue: string;
  confidence: 'high' | 'medium' | 'low';
  audioBase64?: string;
  audioMimeType?: string;
}

export async function interpretSignFrames(
  input: SignInterpretationInput
): Promise<SignInterpretationResult> {
  const frames = (input.frames || []).filter(Boolean).slice(-6);
  if (frames.length === 0) {
    throw new Error('At least one video frame is required for sign interpretation.');
  }

  const imageParts = frames.map((base64) => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64.replace(/^data:image\/\w+;base64,/, ''),
    },
  }));

  const contextBlock =
    input.contextHistory && input.contextHistory.length > 0
      ? `Recent conversation turns for context:\n${input.contextHistory.slice(-4).join('\n')}\n\n`
      : '';

  const prompt = `${contextBlock}You are watching ${frames.length} chronological video frame(s) of a deaf or hard-of-hearing person communicating using ${input.signLanguage}.
Analyze BOTH:
1. Hand shapes, finger orientation, palm direction, and movement across the frames.
2. Facial expressions (eyebrow raise for yes/no questions, furrowed brows for wh-questions, warm smile, urgency, head nod/shake, mouth morphemes) which carry essential grammatical tone.

Translate what they are communicating into natural, direct, first-person ${input.targetSpokenLanguage} speech (as if you are their voice).
- Do NOT say "The person is waving" or "I see a signer". Speak directly what they mean (e.g., "Hi there, nice to meet you!" or "Excuse me, where is the nearest exit?").
- If there is no clear communicative hand gesture or facial expression (e.g. blank wall, person completely resting with no sign), set hasSign to false and spokenText to "".`;

  const startedAt = Date.now();
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          ...imageParts,
          {
            text: `${prompt}\n\nRespond ONLY with a valid JSON object matching this shape:\n{"hasSign": boolean, "spokenText": string, "expressionTone": string, "gestureCue": string, "confidence": "high" | "medium" | "low"}`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  };

  const attempts: Array<{ model: string; apiVersion?: 'v1' | 'v1beta'; timeout: number }> = [
    { model: 'gemini-4-hydrogen', apiVersion: 'v1beta', timeout: 12000 },
    { model: 'gemini-3.1-flash-lite', apiVersion: 'v1beta', timeout: 12000 },
    { model: 'gemini-4-hydrogen', apiVersion: 'v1', timeout: 12000 },
  ];

  let visionResponse: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>> | null = null;
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          ...(attempt.apiVersion ? { apiVersion: attempt.apiVersion } : {}),
          timeout: attempt.timeout,
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });
      visionResponse = await client.models.generateContent({
        model: attempt.model,
        ...requestBody,
      });
      if (visionResponse?.text) break;
    } catch (err) {
      lastError = err;
      console.warn(`[SignBridge] ${attempt.model} (${attempt.apiVersion ?? 'default'}) failed:`, err);
    }
  }

  if (!visionResponse) {
    const rawMsg = lastError instanceof Error ? lastError.message : String(lastError ?? '');
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
      throw new Error(
        'Sign vision model is temporarily busy (high demand). Please try again in a few seconds, or use Live Bridge / Type-to-Speak.'
      );
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to interpret sign frames right now.');
  }
  console.log(`[SignBridge] vision interpret took ${Date.now() - startedAt}ms`);

  const rawJson = (visionResponse.text ?? '{}')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(rawJson) as Partial<SignInterpretationResult>;

  const hasSign = Boolean(parsed.hasSign && parsed.spokenText?.trim());
  const spokenText = (parsed.spokenText ?? '').trim();
  const expressionTone = (parsed.expressionTone ?? 'Natural conversational tone').trim();
  const gestureCue = (parsed.gestureCue ?? 'Hand and facial cue').trim();
  const confidence: 'high' | 'medium' | 'low' =
    parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium';

  if (!hasSign) {
    return {
      hasSign: false,
      spokenText: '',
      expressionTone: expressionTone || 'Resting / waiting',
      gestureCue: gestureCue || 'No active sign detected',
      confidence,
    };
  }

  // Synthesize expressive speech matching the signer's facial expression
  const tts = await synthesizeSpeech({
    text: spokenText,
    voiceName: input.voiceName,
    style: expressionTone,
  });

  return {
    hasSign: true,
    spokenText,
    expressionTone,
    gestureCue,
    confidence,
    audioBase64: tts.audioBase64,
    audioMimeType: tts.audioMimeType,
  };
}

export async function synthesizeSpeech(params: {
  text: string;
  voiceName?: string;
  style?: string;
}): Promise<{ audioBase64: string; audioMimeType: string }> {
  const ai = createGenAIClient('v1beta');
  const voiceName = resolveVoice(params.voiceName);
  const cleanText = params.text.trim();
  if (!cleanText) {
    throw new Error('Text is required for speech synthesis.');
  }

  const ttsResponse = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: cleanText,
            speechMetadata: {
              style: params.style?.trim() || 'Clear, warm, natural human speaker',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio =
    ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Speech synthesis did not return audio data.');
  }

  return {
    audioBase64: base64Audio,
    audioMimeType: 'audio/wav',
  };
}

export async function transcribeAudioClip(params: {
  audioBase64: string;
  mimeType: string;
}): Promise<string> {
  const ai = createGenAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType || 'audio/webm',
            data: params.audioBase64.replace(/^data:[^;]+;base64,/, ''),
          },
        },
        {
          text: 'Transcribe the spoken words accurately and concisely with natural punctuation.',
        },
      ],
    },
  });
  return (response.text ?? '').trim();
}

interface LiveBridgeStartPayload {
  type: 'start';
  signLanguage?: string;
  targetSpokenLanguage?: string;
  voiceName?: string;
}

interface LiveBridgeVideoPayload {
  type: 'video';
  data: string;
}

interface LiveBridgeAudioPayload {
  type: 'audio';
  data: string;
}

interface LiveBridgeInterpretPayload {
  type: 'interpret_sign';
  hint?: string;
}

type ClientWsMessage =
  | LiveBridgeStartPayload
  | LiveBridgeVideoPayload
  | LiveBridgeAudioPayload
  | LiveBridgeInterpretPayload;

function safeSend(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function attachLiveBridgeWebSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/ws/bridge') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs) => {
    let signSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let transcribeSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosing = false;

    const cleanupSessions = () => {
      isClosing = true;
      try {
        signSession?.close();
      } catch {
        // ignore close error
      }
      try {
        transcribeSession?.close();
      } catch {
        // ignore close error
      }
      signSession = null;
      transcribeSession = null;
    };

    clientWs.on('close', cleanupSessions);
    clientWs.on('error', cleanupSessions);

    clientWs.on('message', async (raw) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientWsMessage;
      } catch {
        safeSend(clientWs, {
          channel: 'system',
          type: 'error',
          message: 'Invalid WebSocket message format.',
        });
        return;
      }

      if (msg.type === 'start') {
        cleanupSessions();
        isClosing = false;

        let ai: GoogleGenAI;
        try {
          ai = createGenAIClient('v1beta');
        } catch (err) {
          safeSend(clientWs, {
            channel: 'system',
            type: 'error',
            message: err instanceof Error ? err.message : 'Missing GEMINI_API_KEY.',
          });
          return;
        }

        const signLanguage = msg.signLanguage || 'ASL (American Sign Language)';
        const targetSpokenLanguage = msg.targetSpokenLanguage || 'English';
        const voiceName = resolveVoice(msg.voiceName);

        try {
          const [connectedSign, connectedTranscribe] = await Promise.all([
            ai.live.connect({
              model: 'gemini-3.8-live',
              config: {
                responseModalities: [Modality.AUDIO],
                outputAudioTranscription: {},
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
                systemInstruction: `You are SignBridge, a transparent real-time sign language and facial expression voice interpreter for a deaf or hard-of-hearing user.
You watch a continuous webcam stream of the signer using ${signLanguage}.
Pay close attention to hand gestures, finger movements, and facial expressions (raised eyebrows for questions, nods, smiles, urgency).
Whenever asked to interpret the recent gesture sequence, speak ONLY the direct first-person translation in natural ${targetSpokenLanguage} (as if you are the signer's voice).
Never add meta-commentary like "I see a person" or "They are signing". Keep translations concise and natural.`,
              },
              callbacks: {
                onmessage: (message: LiveServerMessage) => {
                  const content = message.serverContent;
                  if (content?.outputTranscription?.text) {
                    safeSend(clientWs, {
                      channel: 'sign',
                      type: 'output_transcript',
                      text: content.outputTranscription.text,
                    });
                  }
                  for (const part of content?.modelTurn?.parts ?? []) {
                    if (part.inlineData?.data) {
                      safeSend(clientWs, {
                        channel: 'sign',
                        type: 'audio',
                        audio: part.inlineData.data,
                      });
                    }
                  }
                  if (content?.interrupted) {
                    safeSend(clientWs, { channel: 'sign', type: 'interrupted' });
                  }
                  if (content?.turnComplete) {
                    safeSend(clientWs, { channel: 'sign', type: 'turn_complete' });
                  }
                },
                onerror: (err) => {
                  if (!isClosing) {
                    safeSend(clientWs, {
                      channel: 'system',
                      type: 'error',
                      message: `Sign Live stream error: ${err?.message || 'Connection issue'}`,
                    });
                  }
                },
              },
            }),
            ai.live.connect({
              model: 'gemini-3.5-transcribe-live',
              config: {
                responseModalities: [Modality.TEXT],
                inputAudioTranscription: {
                  languageCodes: [],
                },
              },
              callbacks: {
                onmessage: (message: LiveServerMessage) => {
                  const content = message.serverContent;
                  if (content?.interimInputTranscription?.text) {
                    safeSend(clientWs, {
                      channel: 'transcribe',
                      type: 'interim',
                      text: content.interimInputTranscription.text,
                    });
                  }
                  if (content?.inputTranscription?.text) {
                    safeSend(clientWs, {
                      channel: 'transcribe',
                      type: 'final',
                      text: content.inputTranscription.text,
                    });
                  }
                },
                onerror: (err) => {
                  if (!isClosing) {
                    safeSend(clientWs, {
                      channel: 'system',
                      type: 'error',
                      message: `Live transcription error: ${err?.message || 'Connection issue'}`,
                    });
                  }
                },
              },
            }),
          ]);

          if (isClosing) {
            connectedSign.close();
            connectedTranscribe.close();
            return;
          }

          signSession = connectedSign;
          transcribeSession = connectedTranscribe;
          safeSend(clientWs, { channel: 'system', type: 'ready' });
        } catch (err) {
          safeSend(clientWs, {
            channel: 'system',
            type: 'error',
            message:
              err instanceof Error
                ? err.message
                : 'Failed to connect real-time Gemini Live bridge.',
          });
        }
        return;
      }

      if (msg.type === 'video' && signSession) {
        try {
          signSession.sendRealtimeInput({
            video: {
              data: msg.data.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/jpeg',
            },
          });
        } catch {
          // ignore transient frame drop
        }
        return;
      }

      if (msg.type === 'audio' && transcribeSession) {
        try {
          transcribeSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch {
          // ignore transient audio chunk drop
        }
        return;
      }

      if (msg.type === 'interpret_sign' && signSession) {
        try {
          signSession.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text:
                      msg.hint ||
                      'Translate the signer’s most recent hand gestures and facial expressions into direct first-person spoken words.',
                  },
                ],
              },
            ],
            turnComplete: true,
          });
        } catch (err) {
          safeSend(clientWs, {
            channel: 'system',
            type: 'error',
            message:
              err instanceof Error ? err.message : 'Unable to trigger live sign interpretation.',
          });
        }
      }
    });
  });
}
