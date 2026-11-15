export type SignLanguageOption =
  | 'ASL (American Sign Language)'
  | 'BSL (British Sign Language)'
  | 'ISL (Indian Sign Language)'
  | 'Universal Gestures & Facial Cues';

export type SpokenLanguageOption =
  | 'English'
  | 'Spanish'
  | 'French'
  | 'German'
  | 'Japanese'
  | 'Hindi';

export type VoicePersona = 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';

export type CaptionSize = 'standard' | 'large' | 'xlarge';

export type InterpretMode = 'auto' | 'manual';

export type SignerSource = 'webcam' | 'sample';

export type WorkspaceTab = 'bridge' | 'phrases' | 'transcript' | 'preferences';

export interface BridgeSettings {
  signLanguage: SignLanguageOption;
  targetSpokenLanguage: SpokenLanguageOption;
  voiceName: VoicePersona;
  captionSize: CaptionSize;
  highContrast: boolean;
  interpretMode: InterpretMode;
  settleDurationMs: number;
}

export interface SampleSignerPreset {
  id: string;
  label: string;
  contextLabel: string;
  imageUrl: string;
}

export const SAMPLE_SIGNER_PRESETS: SampleSignerPreset[] = [
  {
    id: 'greeting',
    label: 'Friendly Greeting',
    contextLabel: 'Open-hand greeting with warm welcoming smile',
    imageUrl: '/src/assets/images/signer_greeting_1794736140812.jpg',
  },
  {
    id: 'question',
    label: 'Clarifying Question',
    contextLabel: 'Open-palm pause gesture with raised inquisitive eyebrows',
    imageUrl: '/src/assets/images/signer_question_1794736142348.jpg',
  },
];

export const SIGN_LANGUAGES: SignLanguageOption[] = [
  'ASL (American Sign Language)',
  'BSL (British Sign Language)',
  'ISL (Indian Sign Language)',
  'Universal Gestures & Facial Cues',
];

export const SPOKEN_LANGUAGES: SpokenLanguageOption[] = [
  'English',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Hindi',
];

export const VOICE_PERSONAS: Array<{ id: VoicePersona; label: string; tone: string }> = [
  { id: 'Zephyr', label: 'Zephyr', tone: 'Warm, steady conversational voice' },
  { id: 'Kore', label: 'Kore', tone: 'Clear, articulate neutral voice' },
  { id: 'Puck', label: 'Puck', tone: 'Bright, expressive everyday voice' },
  { id: 'Charon', label: 'Charon', tone: 'Calm, grounded lower register' },
  { id: 'Fenrir', label: 'Fenrir', tone: 'Confident, resonant projection' },
];

export interface QuickPhraseItem {
  id: string;
  category: 'Conversation' | 'Clarification' | 'Everyday';
  text: string;
  style: string;
}

export const QUICK_PHRASES: QuickPhraseItem[] = [
  {
    id: 'qp-1',
    category: 'Conversation',
    text: 'Hello, I communicate using sign language and this live caption bridge.',
    style: 'Warm, friendly introduction',
  },
  {
    id: 'qp-2',
    category: 'Clarification',
    text: 'Could you please speak a little slower and face the microphone?',
    style: 'Polite, clear request',
  },
  {
    id: 'qp-3',
    category: 'Clarification',
    text: 'Could you repeat that last sentence? The caption was unclear.',
    style: 'Calm, polite request',
  },
  {
    id: 'qp-4',
    category: 'Conversation',
    text: 'Yes, I understand. Give me one moment to sign my reply.',
    style: 'Reassuring, natural tone',
  },
  {
    id: 'qp-5',
    category: 'Everyday',
    text: 'Thank you so much for your patience and help.',
    style: 'Grateful, warm smile',
  },
  {
    id: 'qp-6',
    category: 'Everyday',
    text: 'Could you write down the name or number so I can double-check it?',
    style: 'Practical, friendly request',
  },
];
