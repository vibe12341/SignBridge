import { useState } from 'react';
import { Download, Search, Trash2, Volume2 } from 'lucide-react';
import { CaptionSize } from '../types/bridge';
import {
  ConversationTurn,
  filterConversationTurns,
  formatTabularTime,
  formatTranscriptExport,
  TurnFilterMode,
} from '../utils/transcriptUtils';

interface ConversationStreamProps {
  turns: ConversationTurn[];
  captionSize: CaptionSize;
  onReplayAudio: (audioDataUrl: string) => void;
  onClearTurns: () => void;
  compact?: boolean;
}

export function ConversationStream({
  turns,
  captionSize,
  onReplayAudio,
  onClearTurns,
  compact = false,
}: ConversationStreamProps) {
  const [filterMode, setFilterMode] = useState<TurnFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = filterConversationTurns(turns, filterMode, searchQuery);

  const handleExport = () => {
    const content = formatTranscriptExport(turns);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signbridge-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const textSizeClass =
    captionSize === 'xlarge'
      ? 'text-lg leading-relaxed'
      : captionSize === 'large'
        ? 'text-base leading-relaxed'
        : 'text-sm leading-relaxed';

  return (
    <section
      aria-label="Conversation history"
      className="flex flex-col rounded-xl border border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-sm font-semibold text-stone-950 dark:text-white">
            Conversation Stream
          </h2>
          <span className="font-mono text-xs tabular-nums text-stone-500 dark:text-slate-400">
            {filtered.length} {filtered.length === 1 ? 'turn' : 'turns'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter conversation turns"
            className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5 dark:border-slate-800 dark:bg-slate-950"
          >
            {(['all', 'signed', 'spoken'] as TurnFilterMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize whitespace-nowrap shrink-0 transition-colors ${
                  filterMode === mode
                    ? 'bg-white text-stone-950 shadow-xs dark:bg-slate-800 dark:text-white'
                    : 'text-stone-600 dark:text-slate-400'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {turns.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExport}
                aria-label="Export conversation transcript"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 whitespace-nowrap shrink-0 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export
              </button>
              <button
                type="button"
                onClick={onClearTurns}
                aria-label="Clear conversation transcript"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 whitespace-nowrap shrink-0 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search bar (when turns exist or full transcript view) */}
      {(turns.length > 0 || !compact) && (
        <div className="border-b border-stone-100 px-4 py-2 dark:border-slate-800/70">
          <label className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-stone-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dialogue or facial expression cues..."
              aria-label="Search conversation transcript"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-300"
            />
          </label>
        </div>
      )}

      {/* Turn List */}
      <div
        data-testid="conversation-list"
        className={`divide-y divide-stone-100 overflow-y-auto dark:divide-slate-800/80 ${
          compact ? 'max-h-[480px] min-h-[380px]' : 'min-h-[360px] max-h-[600px]'
        }`}
      >
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <p className="text-sm font-medium text-stone-700 dark:text-slate-200">
              {turns.length === 0
                ? 'No conversation turns yet'
                : 'No turns match your current filter'}
            </p>
            <p className="max-w-xs text-xs leading-relaxed text-stone-500 dark:text-slate-400">
              {turns.length === 0
                ? 'Sign in front of the camera, try a Sample Signer pose, or type a message below to begin bridging.'
                : 'Try clearing the search query or switching back to All turns.'}
            </p>
          </div>
        ) : (
          filtered.map((turn) => {
            const isIncomingSpoken = turn.direction === 'spoken-to-caption';
            const roleTitle = isIncomingSpoken
              ? 'Spoken Reply'
              : turn.direction === 'typed-to-spoken'
                ? 'Typed to Voice'
                : 'Signed to Voice';

            return (
              <article
                key={turn.id}
                className={`px-4 py-3.5 transition-colors ${
                  isIncomingSpoken
                    ? 'bg-stone-50/70 dark:bg-slate-950/60'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-slate-400">
                    <span
                      className={`font-semibold ${
                        isIncomingSpoken
                          ? 'text-teal-700 dark:text-teal-300'
                          : 'text-blue-700 dark:text-amber-300'
                      }`}
                    >
                      {roleTitle}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{turn.languageLabel}</span>
                    {turn.expressionTone && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{turn.expressionTone}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <time className="font-mono tabular-nums">
                      {formatTabularTime(turn.timestampMs)}
                    </time>
                  </div>

                  {turn.audioDataUrl && (
                    <button
                      type="button"
                      onClick={() => onReplayAudio(turn.audioDataUrl!)}
                      aria-label={`Replay spoken audio for "${turn.text}"`}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 whitespace-nowrap shrink-0 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Volume2 className="h-3 w-3" aria-hidden="true" />
                      Replay
                    </button>
                  )}
                </div>

                <p className={`font-medium text-stone-950 dark:text-white ${textSizeClass}`}>
                  {turn.text}
                </p>

                {turn.gestureCue && (
                  <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                    Observed cue: {turn.gestureCue}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
