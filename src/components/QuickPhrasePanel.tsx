import { FormEvent, useState } from 'react';
import { Loader2, Send, Volume2 } from 'lucide-react';
import { QUICK_PHRASES } from '../types/bridge';

interface QuickPhrasePanelProps {
  isSpeakingCustom: boolean;
  onSpeakText: (text: string, style?: string) => Promise<void>;
  compact?: boolean;
}

export function QuickPhrasePanel({
  isSpeakingCustom,
  onSpeakText,
  compact = false,
}: QuickPhrasePanelProps) {
  const [draft, setDraft] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    'All' | 'Conversation' | 'Clarification' | 'Everyday'
  >('All');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean || isSpeakingCustom) return;
    setDraft('');
    await onSpeakText(clean);
  };

  const phrases =
    selectedCategory === 'All'
      ? QUICK_PHRASES
      : QUICK_PHRASES.filter((p) => p.category === selectedCategory);

  return (
    <section
      aria-label="Type to speak and quick phraseboard"
      className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold text-stone-950 dark:text-white">
            Type-to-Speak &amp; Quick Phrases
          </h2>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            Type a reply or tap a phrase to speak aloud immediately.
          </p>
        </div>

        {!compact && (
          <div
            role="group"
            aria-label="Phrase category filter"
            className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5 dark:border-slate-800 dark:bg-slate-950"
          >
            {(['All', 'Conversation', 'Clarification', 'Everyday'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-white text-stone-950 shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-stone-600 dark:text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Type-to-Speak Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor="type-to-speak-input" className="sr-only">
          Type a message to speak aloud
        </label>
        <input
          id="type-to-speak-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type something to speak aloud..."
          className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm text-stone-950 placeholder:text-stone-400 focus:border-blue-700 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-300"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isSpeakingCustom}
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-stone-800 disabled:opacity-45 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"
        >
          {isSpeakingCustom ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Speak
        </button>
      </form>

      {/* Quick Phrases Grid */}
      <div
        className={`mt-3 grid gap-2 ${
          compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {(compact ? phrases.slice(0, 4) : phrases).map((phrase) => (
          <button
            key={phrase.id}
            type="button"
            disabled={isSpeakingCustom}
            onClick={() => onSpeakText(phrase.text, phrase.style)}
            className="group flex items-start justify-between gap-2.5 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-amber-300/60 dark:hover:bg-slate-800"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
                {phrase.category}
              </p>
              <p className="text-xs font-medium leading-snug text-stone-900 dark:text-slate-100">
                {phrase.text}
              </p>
            </div>
            <Volume2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400 group-hover:text-blue-700 dark:text-slate-500 dark:group-hover:text-amber-300"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
