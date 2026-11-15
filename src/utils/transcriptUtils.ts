export type TurnDirection = 'signed-to-spoken' | 'spoken-to-caption' | 'typed-to-spoken';

export interface ConversationTurn {
  id: string;
  direction: TurnDirection;
  text: string;
  timestampMs: number;
  languageLabel: string;
  expressionTone?: string;
  gestureCue?: string;
  audioDataUrl?: string;
}

export type TurnFilterMode = 'all' | 'signed' | 'spoken';

export function formatTabularTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function filterConversationTurns(
  turns: ConversationTurn[],
  filterMode: TurnFilterMode,
  searchQuery: string
): ConversationTurn[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return turns.filter((turn) => {
    if (filterMode === 'signed' && turn.direction === 'spoken-to-caption') {
      return false;
    }
    if (filterMode === 'spoken' && turn.direction !== 'spoken-to-caption') {
      return false;
    }
    if (!normalizedQuery) return true;
    return (
      turn.text.toLowerCase().includes(normalizedQuery) ||
      (turn.expressionTone?.toLowerCase().includes(normalizedQuery) ?? false) ||
      (turn.gestureCue?.toLowerCase().includes(normalizedQuery) ?? false)
    );
  });
}

export function formatTranscriptExport(
  turns: ConversationTurn[],
  sessionTitle = 'SignBridge Conversation Transcript'
): string {
  const header = [
    sessionTitle,
    `Exported: ${new Date().toISOString()}`,
    `Total Turns: ${turns.length}`,
    '------------------------------------------------------------',
    '',
  ];

  const lines = turns.map((turn) => {
    const time = formatTabularTime(turn.timestampMs);
    const speakerLabel =
      turn.direction === 'spoken-to-caption'
        ? 'HEARING SPEAKER (CAPTIONED)'
        : turn.direction === 'typed-to-spoken'
          ? 'SIGNER (TYPED TO VOICE)'
          : 'SIGNER (SIGNED TO VOICE)';
    const details = [turn.languageLabel, turn.expressionTone].filter(Boolean).join(' · ');
    return `[${time}] ${speakerLabel}${details ? ` (${details})` : ''}\n${turn.text}\n`;
  });

  return [...header, ...lines].join('\n');
}
