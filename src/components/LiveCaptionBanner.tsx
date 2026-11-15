import { Mic, Square } from 'lucide-react';
import { CaptionSize } from '../types/bridge';
import { BridgeConnectionStatus } from '../hooks/useBridgeSession';

interface LiveCaptionBannerProps {
  connectionStatus: BridgeConnectionStatus;
  micMuted: boolean;
  micLevel: number;
  interimCaption: string;
  latestSpokenText: string;
  captionSize: CaptionSize;
  isRecordingClip: boolean;
  onToggleClipTranscribe: () => void;
}

export function LiveCaptionBanner({
  connectionStatus,
  micMuted,
  micLevel,
  interimCaption,
  latestSpokenText,
  captionSize,
  isRecordingClip,
  onToggleClipTranscribe,
}: LiveCaptionBannerProps) {
  const sizeClass =
    captionSize === 'xlarge'
      ? 'text-2xl sm:text-3xl leading-snug'
      : captionSize === 'large'
        ? 'text-xl sm:text-2xl leading-snug'
        : 'text-base sm:text-lg leading-relaxed';

  const levelPercent = Math.min(100, Math.round(micLevel * 450));

  const statusText = micMuted
    ? 'Microphone muted'
    : connectionStatus === 'live'
      ? 'Listening live for spoken replies'
      : isRecordingClip
        ? 'Recording spoken reply clip...'
        : 'Spoken Reply Captions';

  return (
    <section
      aria-label="Live spoken reply captions"
      aria-live="polite"
      className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-tight text-stone-700 dark:text-amber-300">
            {statusText}
          </span>
          {connectionStatus === 'live' && !micMuted && (
            <div
              aria-label={`Microphone input level ${levelPercent}%`}
              className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800"
            >
              <div
                className="h-full bg-teal-600 transition-[width] duration-100 dark:bg-amber-300"
                style={{ width: `${levelPercent}%` }}
              />
            </div>
          )}
        </div>

        {connectionStatus !== 'live' && (
          <button
            type="button"
            onClick={onToggleClipTranscribe}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              isRecordingClip
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
                : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isRecordingClip ? (
              <>
                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                Stop &amp; Transcribe
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                Record Reply Clip
              </>
            )}
          </button>
        )}
      </div>

      <div className="min-h-[4.25rem] flex items-center">
        {interimCaption ? (
          <p className={`font-medium text-stone-700 italic dark:text-amber-200 ${sizeClass}`}>
            {interimCaption}
          </p>
        ) : latestSpokenText ? (
          <p className={`font-semibold text-stone-950 dark:text-white ${sizeClass}`}>
            “{latestSpokenText}”
          </p>
        ) : (
          <p className="text-sm text-stone-500 dark:text-slate-400">
            When a hearing speaker replies into the microphone, their words appear here immediately in large, readable captions.
          </p>
        )}
      </div>
    </section>
  );
}
