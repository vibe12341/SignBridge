import { useCallback, useEffect, useRef, useState } from 'react';
import { base64Int16ToFloat32 } from '../utils/audioPcm';

export function useAudioPlayback() {
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentAudioElRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const ensureOutputContext = useCallback(async (): Promise<AudioContext> => {
    if (!outputCtxRef.current || outputCtxRef.current.state === 'closed') {
      outputCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (outputCtxRef.current.state === 'suspended') {
      await outputCtxRef.current.resume();
    }
    return outputCtxRef.current;
  }, []);

  const updatePlayingFlag = useCallback(() => {
    const active = activeSourcesRef.current.size > 0 || currentAudioElRef.current !== null;
    isPlayingRef.current = active;
    setIsSpeaking(active);
  }, []);

  const stopAllPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore stopped source
      }
    }
    activeSourcesRef.current.clear();
    if (currentAudioElRef.current) {
      currentAudioElRef.current.pause();
      currentAudioElRef.current = null;
    }
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    updatePlayingFlag();
  }, [updatePlayingFlag]);

  const enqueuePcmChunk = useCallback(
    async (base64Pcm: string) => {
      try {
        const ctx = await ensureOutputContext();
        const float32 = base64Int16ToFloat32(base64Pcm);
        if (float32.length === 0) return;

        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        if (nextStartTimeRef.current < now) {
          nextStartTimeRef.current = now + 0.02;
        }
        const startAt = nextStartTimeRef.current;
        nextStartTimeRef.current = startAt + buffer.duration;

        activeSourcesRef.current.add(source);
        updatePlayingFlag();

        source.onended = () => {
          activeSourcesRef.current.delete(source);
          updatePlayingFlag();
        };

        source.start(startAt);
      } catch {
        // Ignore audio context autoplay errors in headless environments
      }
    },
    [ensureOutputContext, updatePlayingFlag]
  );

  const playAudioDataUrl = useCallback(
    async (dataUrl: string) => {
      if (!dataUrl) return;
      stopAllPlayback();
      try {
        const audio = new Audio(dataUrl);
        currentAudioElRef.current = audio;
        updatePlayingFlag();

        audio.onended = () => {
          if (currentAudioElRef.current === audio) {
            currentAudioElRef.current = null;
          }
          updatePlayingFlag();
        };
        audio.onerror = () => {
          if (currentAudioElRef.current === audio) {
            currentAudioElRef.current = null;
          }
          updatePlayingFlag();
        };

        await audio.play();
      } catch {
        currentAudioElRef.current = null;
        updatePlayingFlag();
      }
    },
    [stopAllPlayback, updatePlayingFlag]
  );

  useEffect(() => {
    return () => {
      stopAllPlayback();
      if (outputCtxRef.current && outputCtxRef.current.state !== 'closed') {
        outputCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopAllPlayback]);

  return {
    isSpeaking,
    isPlayingRef,
    enqueuePcmChunk,
    playAudioDataUrl,
    stopAllPlayback,
  };
}
