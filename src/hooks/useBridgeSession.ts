import { useCallback, useEffect, useRef, useState } from 'react';
import { computeRmsEnergy, float32ToInt16Base64 } from '../utils/audioPcm';
import {
  computeFrameMotion,
  MotionPhase,
  MotionPhraseStateMachine,
} from '../utils/motionDetector';
import { ConversationTurn } from '../utils/transcriptUtils';
import {
  BridgeSettings,
  SAMPLE_SIGNER_PRESETS,
  SignerSource,
} from '../types/bridge';
import { useAudioPlayback } from './useAudioPlayback';

export type BridgeConnectionStatus = 'idle' | 'connecting' | 'live' | 'error';

export function useBridgeSession(settings: BridgeSettings) {
  const [connectionStatus, setConnectionStatus] = useState<BridgeConnectionStatus>('idle');
  const [signerSource, setSignerSource] = useState<SignerSource>('webcam');
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_SIGNER_PRESETS[0].id);
  const [cameraActive, setCameraActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [isInterpretingSign, setIsInterpretingSign] = useState(false);
  const [isSpeakingCustom, setIsSpeakingCustom] = useState(false);
  const [isRecordingClip, setIsRecordingClip] = useState(false);

  const [motionEnergy, setMotionEnergy] = useState(0);
  const [motionPhase, setMotionPhase] = useState<MotionPhase>('idle');
  const [micLevel, setMicLevel] = useState(0);

  const [interimCaption, setInterimCaption] = useState('');
  const [latestExpressionCue, setLatestExpressionCue] = useState('');
  const [latestGestureCue, setLatestGestureCue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const motionIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const prevGrayRef = useRef<Uint8ClampedArray | null>(null);
  const rollingFramesRef = useRef<string[]>([]);
  const motionSmRef = useRef<MotionPhraseStateMachine>(
    new MotionPhraseStateMachine({ settleDurationMs: settings.settleDurationMs })
  );
  const liveSignTranscriptBufferRef = useRef('');

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const micMutedRef = useRef(micMuted);
  micMutedRef.current = micMuted;
  const signerSourceRef = useRef(signerSource);
  signerSourceRef.current = signerSource;
  const selectedSampleIdRef = useRef(selectedSampleId);
  selectedSampleIdRef.current = selectedSampleId;
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  const {
    isSpeaking,
    isPlayingRef,
    enqueuePcmChunk,
    playAudioDataUrl,
    stopAllPlayback,
  } = useAudioPlayback();

  useEffect(() => {
    motionSmRef.current.updateConfig({
      settleDurationMs: settings.settleDurationMs,
    });
  }, [settings.settleDurationMs]);

  const appendTurn = useCallback((turn: Omit<ConversationTurn, 'id' | 'timestampMs'>) => {
    const newTurn: ConversationTurn = {
      ...turn,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestampMs: Date.now(),
    };
    setTurns((prev) => [...prev, newTurn]);
    return newTurn;
  }, []);

  const captureCurrentJpegFrame = useCallback(async (): Promise<string | null> => {
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const canvas = captureCanvasRef.current;

    if (signerSourceRef.current === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
      const video = videoRef.current;
      const targetWidth = 640;
      const aspect = video.videoHeight > 0 ? video.videoHeight / video.videoWidth : 0.75;
      canvas.width = targetWidth;
      canvas.height = Math.round(targetWidth * aspect);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    }

    if (signerSourceRef.current === 'sample') {
      const preset =
        SAMPLE_SIGNER_PRESETS.find((p) => p.id === selectedSampleIdRef.current) ||
        SAMPLE_SIGNER_PRESETS[0];
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, 640, 480);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(null);
        img.src = preset.imageUrl;
      });
    }

    return null;
  }, []);

  const sampleMotionFrame = useCallback(() => {
    if (signerSourceRef.current !== 'webcam') {
      setMotionEnergy(0);
      setMotionPhase('idle');
      return;
    }
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    if (!motionCanvasRef.current) {
      motionCanvasRef.current = document.createElement('canvas');
      motionCanvasRef.current.width = 64;
      motionCanvasRef.current.height = 48;
    }
    const ctx = motionCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, 64, 48);
    const { data } = ctx.getImageData(0, 0, 64, 48);
    const gray = new Uint8ClampedArray(64 * 48);
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    }

    const energy = computeFrameMotion(prevGrayRef.current, gray);
    prevGrayRef.current = gray;
    setMotionEnergy(energy);

    if (settingsRef.current.interpretMode === 'auto' && !isPlayingRef.current) {
      const step = motionSmRef.current.step(energy, Date.now());
      setMotionPhase(step.phase);
      if (step.shouldTriggerInterpret) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'interpret_sign',
              hint: `The signer just finished a gesture sequence in ${settingsRef.current.signLanguage}. Speak the direct ${settingsRef.current.targetSpokenLanguage} translation aloud now.`,
            })
          );
        }
      }
    } else {
      setMotionPhase('idle');
    }
  }, [isPlayingRef]);

  const stopMediaAndTimers = useCallback(() => {
    if (frameIntervalRef.current !== null) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (motionIntervalRef.current !== null) {
      window.clearInterval(motionIntervalRef.current);
      motionIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setMicLevel(0);
    setMotionEnergy(0);
    setMotionPhase('idle');
    prevGrayRef.current = null;
  }, []);

  const stopLiveBridge = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopMediaAndTimers();
    stopAllPlayback();
    setConnectionStatus('idle');
    setInterimCaption('');
  }, [stopAllPlayback, stopMediaAndTimers]);

  const startLiveBridge = useCallback(async () => {
    setErrorMessage(null);
    setConnectionStatus('connecting');

    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Camera or microphone permission was declined.';
      setErrorMessage(
        `${msg} Switched to Sample Signer Feed — you can still test Sign-to-Voice translation and Type-to-Speak.`
      );
      setSignerSource('sample');
      setConnectionStatus('error');
      return;
    }

    if (!stream) {
      setErrorMessage(
        'Camera and microphone are unavailable in this browser environment. Use Sample Signer Feed or Type-to-Speak below.'
      );
      setSignerSource('sample');
      setConnectionStatus('error');
      return;
    }

    mediaStreamRef.current = stream;
    setSignerSource('webcam');
    setCameraActive(true);

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    // Open WebSocket Live Bridge
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/bridge`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'start',
          signLanguage: settingsRef.current.signLanguage,
          targetSpokenLanguage: settingsRef.current.targetSpokenLanguage,
          voiceName: settingsRef.current.voiceName,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === 'system') {
          if (msg.type === 'ready') {
            setConnectionStatus('live');
          } else if (msg.type === 'error') {
            setErrorMessage(msg.message || 'Live bridge connection error.');
            setConnectionStatus('error');
          }
          return;
        }

        if (msg.channel === 'sign') {
          if (msg.type === 'audio' && msg.audio) {
            enqueuePcmChunk(msg.audio);
          } else if (msg.type === 'output_transcript' && msg.text) {
            liveSignTranscriptBufferRef.current += msg.text;
          } else if (msg.type === 'turn_complete') {
            const finalized = liveSignTranscriptBufferRef.current.trim();
            liveSignTranscriptBufferRef.current = '';
            if (finalized) {
              setLatestExpressionCue('Live facial & gesture interpretation');
              appendTurn({
                direction: 'signed-to-spoken',
                text: finalized,
                languageLabel: settingsRef.current.signLanguage.split(' ')[0],
                expressionTone: 'Live spoken translation',
              });
            }
          } else if (msg.type === 'interrupted') {
            stopAllPlayback();
          }
          return;
        }

        if (msg.channel === 'transcribe') {
          if (msg.type === 'interim' && typeof msg.text === 'string') {
            setInterimCaption(msg.text);
          } else if (msg.type === 'final' && typeof msg.text === 'string') {
            const clean = msg.text.trim();
            setInterimCaption('');
            if (clean) {
              appendTurn({
                direction: 'spoken-to-caption',
                text: clean,
                languageLabel: `Spoken ${settingsRef.current.targetSpokenLanguage}`,
              });
            }
          }
        }
      } catch {
        // ignore malformed WS frames
      }
    };

    ws.onerror = () => {
      setErrorMessage('Live WebSocket connection encountered an error.');
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        setConnectionStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      }
    };

    // 16kHz PCM mic capture
    try {
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        const samples = e.inputBuffer.getChannelData(0);
        const rms = computeRmsEnergy(samples);
        setMicLevel(micMutedRef.current ? 0 : rms);

        if (
          !micMutedRef.current &&
          !isPlayingRef.current &&
          ws.readyState === WebSocket.OPEN
        ) {
          const base64 = float32ToInt16Base64(samples);
          ws.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };
    } catch {
      // Non-fatal if AudioContext cannot start
    }

    // 1 FPS video streaming to Gemini Live + rolling 5-frame buffer
    frameIntervalRef.current = window.setInterval(async () => {
      const frame = await captureCurrentJpegFrame();
      if (!frame) return;
      rollingFramesRef.current = [...rollingFramesRef.current.slice(-4), frame];
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'video', data: frame }));
      }
    }, 1000);

    // 250ms lightweight motion sampling for Auto-Watch phrase boundaries
    motionIntervalRef.current = window.setInterval(sampleMotionFrame, 250);
  }, [
    appendTurn,
    captureCurrentJpegFrame,
    enqueuePcmChunk,
    isPlayingRef,
    sampleMotionFrame,
    stopAllPlayback,
  ]);

  const translateCurrentSign = useCallback(async () => {
    setErrorMessage(null);
    setIsInterpretingSign(true);
    try {
      const latestFrame = await captureCurrentJpegFrame();
      const framesToSend =
        signerSourceRef.current === 'sample'
          ? latestFrame
            ? [latestFrame]
            : []
          : rollingFramesRef.current.length > 0
            ? [...rollingFramesRef.current.slice(-3), ...(latestFrame ? [latestFrame] : [])]
            : latestFrame
              ? [latestFrame]
              : [];

      if (framesToSend.length === 0) {
        setErrorMessage(
          'No camera frame available yet. Start Live Bridge or switch to Sample Signer Feed.'
        );
        return;
      }

      const contextHistory = turnsRef.current
        .slice(-4)
        .map((t) => `${t.direction === 'spoken-to-caption' ? 'Speaker' : 'Signer'}: ${t.text}`);

      const response = await fetch('/api/interpret-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: framesToSend,
          signLanguage: settingsRef.current.signLanguage,
          targetSpokenLanguage: settingsRef.current.targetSpokenLanguage,
          voiceName: settingsRef.current.voiceName,
          contextHistory,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Sign interpretation request failed.');
      }

      setLatestExpressionCue(data.expressionTone || '');
      setLatestGestureCue(data.gestureCue || '');

      if (!data.hasSign || !data.spokenText) {
        setErrorMessage(
          'No clear hand sign or facial cue was detected in that frame. Try holding the gesture clearly in frame.'
        );
        return;
      }

      const audioDataUrl = data.audioBase64
        ? `data:${data.audioMimeType || 'audio/wav'};base64,${data.audioBase64}`
        : undefined;

      appendTurn({
        direction: 'signed-to-spoken',
        text: data.spokenText,
        languageLabel: settingsRef.current.signLanguage.split(' ')[0],
        expressionTone: data.expressionTone,
        gestureCue: data.gestureCue,
        audioDataUrl,
      });

      if (audioDataUrl) {
        await playAudioDataUrl(audioDataUrl);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to translate sign right now.'
      );
    } finally {
      setIsInterpretingSign(false);
    }
  }, [appendTurn, captureCurrentJpegFrame, playAudioDataUrl]);

  const speakTypedMessage = useCallback(
    async (text: string, style?: string) => {
      const clean = text.trim();
      if (!clean) return;
      setErrorMessage(null);
      setIsSpeakingCustom(true);
      try {
        const response = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            voiceName: settingsRef.current.voiceName,
            style,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate spoken audio.');
        }

        const audioDataUrl = `data:${data.audioMimeType || 'audio/wav'};base64,${data.audioBase64}`;
        appendTurn({
          direction: 'typed-to-spoken',
          text: clean,
          languageLabel: 'Typed Voice',
          expressionTone: style || `${settingsRef.current.voiceName} voice`,
          audioDataUrl,
        });
        await playAudioDataUrl(audioDataUrl);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to speak message aloud.'
        );
      } finally {
        setIsSpeakingCustom(false);
      }
    },
    [appendTurn, playAudioDataUrl]
  );

  const toggleQuickClipTranscribe = useCallback(async () => {
    if (isRecordingClip && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingClip(false);
      return;
    }

    setErrorMessage(null);
    try {
      const stream =
        mediaStreamRef.current ||
        (await navigator.mediaDevices.getUserMedia({ audio: true }));
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorderRef.current = recorder;
      setIsRecordingClip(true);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        setIsRecordingClip(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        if (!mediaStreamRef.current) {
          stream.getTracks().forEach((t) => t.stop());
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = typeof reader.result === 'string' ? reader.result : '';
          if (!base64) return;
          try {
            const resp = await fetch('/api/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                mimeType: blob.type || 'audio/webm',
              }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Transcription failed');
            if (data.transcript) {
              appendTurn({
                direction: 'spoken-to-caption',
                text: data.transcript,
                languageLabel: `Spoken ${settingsRef.current.targetSpokenLanguage}`,
              });
            }
          } catch (err) {
            setErrorMessage(
              err instanceof Error ? err.message : 'Unable to transcribe spoken clip.'
            );
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
    } catch (err) {
      setIsRecordingClip(false);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Microphone access is needed to transcribe a spoken reply.'
      );
    }
  }, [appendTurn, isRecordingClip]);

  const clearTurns = useCallback(() => {
    setTurns([]);
    setInterimCaption('');
    setLatestExpressionCue('');
    setLatestGestureCue('');
  }, []);

  useEffect(() => {
    return () => {
      stopLiveBridge();
    };
  }, [stopLiveBridge]);

  return {
    videoRef,
    connectionStatus,
    signerSource,
    setSignerSource,
    selectedSampleId,
    setSelectedSampleId,
    cameraActive,
    micMuted,
    setMicMuted,
    isInterpretingSign,
    isSpeakingCustom,
    isRecordingClip,
    isSpeaking,
    motionEnergy,
    motionPhase,
    micLevel,
    interimCaption,
    latestExpressionCue,
    latestGestureCue,
    errorMessage,
    setErrorMessage,
    turns,
    startLiveBridge,
    stopLiveBridge,
    translateCurrentSign,
    speakTypedMessage,
    toggleQuickClipTranscribe,
    playAudioDataUrl,
    stopAllPlayback,
    clearTurns,
  };
}
