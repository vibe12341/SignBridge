import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ConversationStream } from './components/ConversationStream';
import { LiveCaptionBanner } from './components/LiveCaptionBanner';
import { PreferencesPanel } from './components/PreferencesPanel';
import { QuickPhrasePanel } from './components/QuickPhrasePanel';
import { SignerStage } from './components/SignerStage';
import { TopBar } from './components/TopBar';
import { useBridgeSession } from './hooks/useBridgeSession';
import { BridgeSettings, VoicePersona, WorkspaceTab } from './types/bridge';

const DEFAULT_SETTINGS: BridgeSettings = {
  signLanguage: 'ASL (American Sign Language)',
  targetSpokenLanguage: 'English',
  voiceName: 'Zephyr',
  captionSize: 'large',
  highContrast: false,
  interpretMode: 'auto',
  settleDurationMs: 1100,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('bridge');
  const [settings, setSettings] = useState<BridgeSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.highContrast) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.highContrast]);

  const session = useBridgeSession(settings);

  const updateSettings = (partial: Partial<BridgeSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleToggleBridge = () => {
    if (
      session.connectionStatus === 'live' ||
      session.connectionStatus === 'connecting'
    ) {
      session.stopLiveBridge();
    } else {
      session.startLiveBridge();
    }
  };

  const handlePreviewVoice = async (voice: VoicePersona) => {
    await session.speakTypedMessage(
      `Hello, this is ${voice} speaking clearly for you.`,
      'Warm, articulate voice preview'
    );
  };

  const latestSpokenTurn = [...session.turns]
    .reverse()
    .find((t) => t.direction === 'spoken-to-caption');

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-stone-950 transition-colors duration-150 dark:bg-slate-950 dark:text-white">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connectionStatus={session.connectionStatus}
        onToggleBridge={handleToggleBridge}
        turnCount={session.turns.length}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {session.errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              <p>{session.errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => session.setErrorMessage(null)}
              aria-label="Dismiss notice"
              className="rounded-md p-1 text-amber-800 hover:bg-amber-200/50 dark:text-amber-200 dark:hover:bg-amber-900/50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {activeTab === 'bridge' && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {/* Primary Left Stage: Signer Camera + Controls + Quick Type-to-Speak */}
            <div className="space-y-5 lg:col-span-7">
              <SignerStage
                videoRef={session.videoRef}
                connectionStatus={session.connectionStatus}
                signerSource={session.signerSource}
                onChangeSignerSource={session.setSignerSource}
                selectedSampleId={session.selectedSampleId}
                onSelectSampleId={session.setSelectedSampleId}
                cameraActive={session.cameraActive}
                micMuted={session.micMuted}
                onToggleMicMute={() => session.setMicMuted((m) => !m)}
                isInterpretingSign={session.isInterpretingSign}
                isSpeaking={session.isSpeaking}
                onStopPlayback={session.stopAllPlayback}
                motionEnergy={session.motionEnergy}
                motionPhase={session.motionPhase}
                latestExpressionCue={session.latestExpressionCue}
                latestGestureCue={session.latestGestureCue}
                settings={settings}
                onChangeInterpretMode={(mode) =>
                  updateSettings({ interpretMode: mode })
                }
                onTranslateSign={session.translateCurrentSign}
                onStartBridge={session.startLiveBridge}
              />

              <QuickPhrasePanel
                isSpeakingCustom={session.isSpeakingCustom}
                onSpeakText={session.speakTypedMessage}
                compact
              />
            </div>

            {/* Right Column: Live Spoken Reply Captions + Chronological Dialogue */}
            <div className="space-y-5 lg:col-span-5">
              <LiveCaptionBanner
                connectionStatus={session.connectionStatus}
                micMuted={session.micMuted}
                micLevel={session.micLevel}
                interimCaption={session.interimCaption}
                latestSpokenText={latestSpokenTurn?.text ?? ''}
                captionSize={settings.captionSize}
                isRecordingClip={session.isRecordingClip}
                onToggleClipTranscribe={session.toggleQuickClipTranscribe}
              />

              <ConversationStream
                turns={session.turns}
                captionSize={settings.captionSize}
                onReplayAudio={session.playAudioDataUrl}
                onClearTurns={session.clearTurns}
                compact
              />
            </div>
          </div>
        )}

        {activeTab === 'phrases' && (
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
                Phraseboard &amp; Instant Voice
              </h1>
              <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">
                Tap everyday phrases or type custom messages to speak aloud in {settings.voiceName}’s voice.
              </p>
            </div>
            <QuickPhrasePanel
              isSpeakingCustom={session.isSpeakingCustom}
              onSpeakText={session.speakTypedMessage}
            />
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="mx-auto max-w-4xl space-y-6">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
                Session Transcript
              </h1>
              <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">
                Search, filter, replay spoken audio, or export the full two-way conversation log.
              </p>
            </div>
            <ConversationStream
              turns={session.turns}
              captionSize={settings.captionSize}
              onReplayAudio={session.playAudioDataUrl}
              onClearTurns={session.clearTurns}
            />
          </div>
        )}

        {activeTab === 'preferences' && (
          <PreferencesPanel
            settings={settings}
            onUpdateSettings={updateSettings}
            onPreviewVoice={handlePreviewVoice}
            isSpeakingCustom={session.isSpeakingCustom}
          />
        )}
      </main>
    </div>
  );
}
