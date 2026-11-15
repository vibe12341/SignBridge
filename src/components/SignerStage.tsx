import { RefObject, useState } from 'react';
import {
  Camera,
  Hand,
  Loader2,
  Mic,
  MicOff,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BridgeSettings,
  InterpretMode,
  SAMPLE_SIGNER_PRESETS,
  SignerSource,
} from '../types/bridge';
import { BridgeConnectionStatus } from '../hooks/useBridgeSession';
import { MotionPhase } from '../utils/motionDetector';

interface SignerStageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  connectionStatus: BridgeConnectionStatus;
  signerSource: SignerSource;
  onChangeSignerSource: (source: SignerSource) => void;
  selectedSampleId: string;
  onSelectSampleId: (id: string) => void;
  cameraActive: boolean;
  micMuted: boolean;
  onToggleMicMute: () => void;
  isInterpretingSign: boolean;
  isSpeaking: boolean;
  onStopPlayback: () => void;
  motionEnergy: number;
  motionPhase: MotionPhase;
  latestExpressionCue: string;
  latestGestureCue: string;
  settings: BridgeSettings;
  onChangeInterpretMode: (mode: InterpretMode) => void;
  onTranslateSign: () => void;
  onStartBridge: () => void;
}

export function SignerStage({
  videoRef,
  connectionStatus,
  signerSource,
  onChangeSignerSource,
  selectedSampleId,
  onSelectSampleId,
  cameraActive,
  micMuted,
  onToggleMicMute,
  isInterpretingSign,
  isSpeaking,
  onStopPlayback,
  motionEnergy,
  motionPhase,
  latestExpressionCue,
  latestGestureCue,
  settings,
  onChangeInterpretMode,
  onTranslateSign,
  onStartBridge,
}: SignerStageProps) {
  const [imageBroken, setImageBroken] = useState(false);

  const activeSample =
    SAMPLE_SIGNER_PRESETS.find((p) => p.id === selectedSampleId) ||
    SAMPLE_SIGNER_PRESETS[0];

  const motionPercent = Math.min(100, Math.round(motionEnergy * 600));

  const phaseLabel =
    motionPhase === 'signing'
      ? 'Gesture detected'
      : motionPhase === 'settling'
        ? 'Finishing phrase...'
        : motionPhase === 'cooldown'
          ? 'Spoken'
          : cameraActive
            ? 'Watching hands & expression'
            : 'Camera idle';

  return (
    <section
      aria-label="Signer camera and gesture stage"
      className="flex flex-col gap-4"
    >
      {/* Stage Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-stone-950 dark:text-white">
            Signer Viewport
          </h1>
          <p className="text-xs text-stone-600 dark:text-slate-300">
            {settings.signLanguage}
            <span aria-hidden="true" className="mx-1.5">·</span>
            Speaks in {settings.targetSpokenLanguage} ({settings.voiceName})
          </p>
        </div>

        {/* Feed Source Segmented Control */}
        <div
          role="group"
          aria-label="Video input source"
          className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 p-1 dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => onChangeSignerSource('webcam')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              signerSource === 'webcam'
                ? 'bg-white text-stone-950 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-stone-600 hover:text-stone-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
            Live Camera
          </button>
          <button
            type="button"
            onClick={() => {
              setImageBroken(false);
              onChangeSignerSource('sample');
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              signerSource === 'sample'
                ? 'bg-white text-stone-950 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-stone-600 hover:text-stone-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Hand className="h-3.5 w-3.5" aria-hidden="true" />
            Sample Signer
          </button>
        </div>
      </div>

      {/* Video / Signer Viewport */}
      <div
        data-testid="signer-viewport"
        className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-stone-200 dark:border-slate-700 ${
          cameraActive || signerSource === 'sample'
            ? 'bg-stone-950'
            : 'bg-stone-100 dark:bg-slate-900'
        }`}
      >
        {signerSource === 'webcam' ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover -scale-x-100 ${
                cameraActive ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-stone-100 dark:bg-slate-900">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-stone-200 bg-white text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300">
                  <Camera className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="max-w-sm space-y-1.5">
                  <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
                    Camera &amp; Microphone Ready
                  </h2>
                  <p className="text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                    Start the Live Bridge to stream hand gestures and facial expressions aloud, or switch to Sample Signer to test immediately.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onStartBridge}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
                  >
                    Enable Camera &amp; Mic
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSignerSource('sample')}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 whitespace-nowrap shrink-0 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Try Sample Signer
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="relative h-full w-full bg-stone-200 dark:bg-slate-900">
            {!imageBroken ? (
              <img
                src={activeSample.imageUrl}
                alt={activeSample.contextLabel}
                referrerPolicy="no-referrer"
                onError={() => setImageBroken(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-stone-600 dark:text-slate-300">
                <Hand className="h-8 w-8" aria-hidden="true" />
                <p className="text-sm font-medium">{activeSample.label}</p>
                <p className="text-xs">{activeSample.contextLabel}</p>
              </div>
            )}
          </div>
        )}

        {/* Measured Bottom Contrast Scrim for Active Cues */}
        {(cameraActive || signerSource === 'sample') && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3.5 pt-10 text-white">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-medium text-stone-200">
                  {signerSource === 'sample'
                    ? `Sample Frame · ${activeSample.label}`
                    : `${phaseLabel}${connectionStatus === 'live' ? ' · Live stream active' : ''}`}
                </p>
                <p className="truncate text-sm font-medium text-white">
                  {latestExpressionCue
                    ? `${latestExpressionCue}${latestGestureCue ? ` — ${latestGestureCue}` : ''}`
                    : signerSource === 'sample'
                      ? activeSample.contextLabel
                      : 'Position hands and face clearly inside the frame'}
                </p>
              </div>

              {signerSource === 'webcam' && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] tabular-nums text-stone-200">
                    Motion
                  </span>
                  <div
                    aria-label={`Gesture motion level ${motionPercent}%`}
                    className="h-1.5 w-20 overflow-hidden rounded-full bg-white/25"
                  >
                    <div
                      className="h-full bg-amber-300 transition-[width] duration-150"
                      style={{ width: `${motionPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sample Signer Selector (visible only when Sample Signer source is selected) */}
      {signerSource === 'sample' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-stone-700 dark:text-slate-300">
            Select Sample Signer Pose
          </span>
          <div className="flex items-center gap-2">
            {SAMPLE_SIGNER_PRESETS.map((preset) => {
              const selected = preset.id === activeSample.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setImageBroken(false);
                    onSelectSampleId(preset.id);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    selected
                      ? 'bg-blue-700 text-white dark:bg-amber-300 dark:text-slate-950'
                      : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Signer Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTranslateSign}
            disabled={isInterpretingSign || (signerSource === 'webcam' && !cameraActive)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
          >
            {isInterpretingSign ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
            {isInterpretingSign ? 'Translating Sign...' : 'Translate & Speak Sign'}
          </button>

          {isSpeaking && (
            <button
              type="button"
              onClick={onStopPlayback}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 whitespace-nowrap shrink-0 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
              Stop Voice
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Watch vs Manual Trigger */}
          <div
            role="group"
            aria-label="Sign detection timing"
            className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5 dark:border-slate-800 dark:bg-slate-950"
          >
            <button
              type="button"
              onClick={() => onChangeInterpretMode('auto')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                settings.interpretMode === 'auto'
                  ? 'bg-white text-stone-950 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-stone-600 dark:text-slate-400'
              }`}
            >
              Auto-Watch
            </button>
            <button
              type="button"
              onClick={() => onChangeInterpretMode('manual')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                settings.interpretMode === 'manual'
                  ? 'bg-white text-stone-950 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-stone-600 dark:text-slate-400'
              }`}
            >
              Manual
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleMicMute}
            aria-pressed={micMuted}
            aria-label={micMuted ? 'Unmute speaker microphone' : 'Mute speaker microphone'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              micMuted
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {micMuted ? (
              <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {micMuted ? 'Mic Muted' : 'Mic On'}
          </button>
        </div>
      </div>
    </section>
  );
}
