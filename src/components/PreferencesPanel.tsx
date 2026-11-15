import { Volume2 } from 'lucide-react';
import {
  BridgeSettings,
  CaptionSize,
  SIGN_LANGUAGES,
  SignLanguageOption,
  SPOKEN_LANGUAGES,
  SpokenLanguageOption,
  VOICE_PERSONAS,
  VoicePersona,
} from '../types/bridge';

interface PreferencesPanelProps {
  settings: BridgeSettings;
  onUpdateSettings: (partial: Partial<BridgeSettings>) => void;
  onPreviewVoice: (voice: VoicePersona) => void;
  isSpeakingCustom: boolean;
}

export function PreferencesPanel({
  settings,
  onUpdateSettings,
  onPreviewVoice,
  isSpeakingCustom,
}: PreferencesPanelProps) {
  return (
    <section
      aria-label="Communication and accessibility preferences"
      className="mx-auto max-w-4xl space-y-6"
    >
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
          Bridge Preferences &amp; Accessibility
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">
          Customize sign language dialect, spoken voice output, caption legibility, and high-contrast display.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Language & Dialect */}
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Languages
          </h2>

          <div className="space-y-1.5">
            <label
              htmlFor="sign-language-select"
              className="block text-xs font-medium text-stone-700 dark:text-slate-300"
            >
              Sign Language / Gesture System
            </label>
            <select
              id="sign-language-select"
              value={settings.signLanguage}
              onChange={(e) =>
                onUpdateSettings({
                  signLanguage: e.target.value as SignLanguageOption,
                })
              }
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-amber-300"
            >
              {SIGN_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="spoken-language-select"
              className="block text-xs font-medium text-stone-700 dark:text-slate-300"
            >
              Target Spoken Output Language
            </label>
            <select
              id="spoken-language-select"
              value={settings.targetSpokenLanguage}
              onChange={(e) =>
                onUpdateSettings({
                  targetSpokenLanguage: e.target.value as SpokenLanguageOption,
                })
              }
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-amber-300"
            >
              {SPOKEN_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-stone-700 dark:text-slate-300">
              Auto-Watch Pause Sensitivity
            </span>
            <div
              role="group"
              aria-label="Auto-watch pause sensitivity"
              className="grid grid-cols-3 gap-2"
            >
              {[
                { label: 'Fast (0.8s)', ms: 800 },
                { label: 'Balanced (1.1s)', ms: 1100 },
                { label: 'Patient (1.6s)', ms: 1600 },
              ].map((opt) => (
                <button
                  key={opt.ms}
                  type="button"
                  onClick={() => onUpdateSettings({ settleDurationMs: opt.ms })}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    settings.settleDurationMs === opt.ms
                      ? 'border-blue-700 bg-blue-50 text-blue-800 dark:border-amber-300 dark:bg-slate-800 dark:text-amber-300'
                      : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Accessibility Display & Voice */}
        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Captions &amp; Display
          </h2>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-stone-700 dark:text-slate-300">
              Visual Contrast Theme
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ highContrast: false })}
                className={`rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                  !settings.highContrast
                    ? 'border-blue-700 bg-blue-50 text-blue-800 dark:border-amber-300 dark:bg-slate-800 dark:text-amber-300'
                    : 'border-stone-200 bg-stone-50 text-stone-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                Standard Daylight
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ highContrast: true })}
                className={`rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                  settings.highContrast
                    ? 'border-blue-700 bg-blue-50 text-blue-800 dark:border-amber-300 dark:bg-slate-800 dark:text-amber-300'
                    : 'border-stone-200 bg-stone-50 text-stone-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                High Contrast Dark
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-stone-700 dark:text-slate-300">
              Live Caption Text Size
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'standard', label: 'Standard' },
                  { id: 'large', label: 'Large' },
                  { id: 'xlarge', label: 'Extra Large' },
                ] as Array<{ id: CaptionSize; label: string }>
              ).map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => onUpdateSettings({ captionSize: size.id })}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                    settings.captionSize === size.id
                      ? 'border-blue-700 bg-blue-50 text-blue-800 dark:border-amber-300 dark:bg-slate-800 dark:text-amber-300'
                      : 'border-stone-200 bg-stone-50 text-stone-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="voice-persona-select"
                className="text-xs font-medium text-stone-700 dark:text-slate-300"
              >
                Spoken Output Voice
              </label>
              <button
                type="button"
                disabled={isSpeakingCustom}
                onClick={() => onPreviewVoice(settings.voiceName)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50 dark:text-amber-300"
              >
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                Preview Voice
              </button>
            </div>
            <select
              id="voice-persona-select"
              value={settings.voiceName}
              onChange={(e) =>
                onUpdateSettings({ voiceName: e.target.value as VoicePersona })
              }
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-950 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-amber-300"
            >
              {VOICE_PERSONAS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.tone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
