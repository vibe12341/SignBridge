import test from 'node:test';
import assert from 'node:assert/strict';
import {
  float32ToInt16Base64,
  base64Int16ToFloat32,
  computeRmsEnergy,
} from './audioPcm';
import {
  computeFrameMotion,
  MotionPhraseStateMachine,
} from './motionDetector';
import {
  ConversationTurn,
  filterConversationTurns,
  formatTabularTime,
  formatTranscriptExport,
} from './transcriptUtils';
import {
  escapePdfString,
  generateTranscriptPdfBytes,
  wrapTextLines,
} from './transcriptPdf';
import { transcribeAudioClip } from '../../server/geminiBridge';

test('audioPcm roundtrip preserves float32 signal within 16-bit quantization tolerance', () => {
  const input = new Float32Array([0, 0.5, -0.5, 0.95, -0.95]);
  const encoded = float32ToInt16Base64(input);
  const decoded = base64Int16ToFloat32(encoded);

  assert.equal(decoded.length, input.length);
  for (let i = 0; i < input.length; i++) {
    assert.ok(
      Math.abs(decoded[i] - input[i]) < 0.001,
      `Sample ${i} mismatch: got ${decoded[i]}, expected ${input[i]}`
    );
  }
});

test('computeRmsEnergy handles silence and clamped amplitude correctly', () => {
  assert.equal(computeRmsEnergy(new Float32Array(0)), 0);
  assert.equal(computeRmsEnergy(new Float32Array([0, 0, 0, 0])), 0);
  const loud = computeRmsEnergy(new Float32Array([1, -1, 1, -1]));
  assert.equal(loud, 1);
  const half = computeRmsEnergy(new Float32Array([0.5, -0.5, 0.5, -0.5]));
  assert.ok(Math.abs(half - 0.5) < 0.0001);
});

test('computeFrameMotion returns 0 for identical frames or missing previous frame', () => {
  const frameA = new Uint8ClampedArray([10, 20, 30, 40]);
  assert.equal(computeFrameMotion(null, frameA), 0);
  assert.equal(computeFrameMotion(frameA, new Uint8ClampedArray([10, 20, 30, 40])), 0);

  const frameB = new Uint8ClampedArray([265, 255, 255, 255]); // clamped to 255
  const frameZero = new Uint8ClampedArray([0, 0, 0, 0]);
  assert.equal(computeFrameMotion(frameZero, frameB), 1);
});

test('MotionPhraseStateMachine detects signing start, settling pause, trigger, and cooldown', () => {
  const sm = new MotionPhraseStateMachine({
    startThreshold: 0.05,
    settleThreshold: 0.02,
    settleDurationMs: 1000,
    cooldownDurationMs: 1500,
  });

  assert.equal(sm.getPhase(), 'idle');

  // Slight noise stays idle
  let res = sm.step(0.01, 100);
  assert.equal(res.phase, 'idle');
  assert.equal(res.shouldTriggerInterpret, false);

  // Signing starts
  res = sm.step(0.08, 200);
  assert.equal(res.phase, 'signing');
  assert.equal(res.shouldTriggerInterpret, false);

  // Signer pauses -> enters settling
  res = sm.step(0.01, 500);
  assert.equal(res.phase, 'settling');
  assert.equal(res.shouldTriggerInterpret, false);

  // If signer moves again before 1000ms, returns to signing without triggering
  res = sm.step(0.07, 900);
  assert.equal(res.phase, 'signing');
  assert.equal(res.shouldTriggerInterpret, false);

  // Pause again -> settling at t=1000
  res = sm.step(0.005, 1000);
  assert.equal(res.phase, 'settling');
  assert.equal(res.shouldTriggerInterpret, false);

  // Still settling at t=1800
  res = sm.step(0.01, 1800);
  assert.equal(res.phase, 'settling');
  assert.equal(res.shouldTriggerInterpret, false);

  // Settle duration reached at t=2050 -> triggers interpret & enters cooldown
  res = sm.step(0.005, 2050);
  assert.equal(res.phase, 'cooldown');
  assert.equal(res.shouldTriggerInterpret, true);

  // During cooldown, movement does not immediately re-trigger
  res = sm.step(0.12, 2500);
  assert.equal(res.phase, 'cooldown');
  assert.equal(res.shouldTriggerInterpret, false);

  // After cooldown expires (2050 + 1500 = 3550), returns to idle
  res = sm.step(0.01, 3600);
  assert.equal(res.phase, 'idle');
});

test('transcriptUtils filters turns and formats export cleanly', () => {
  const sampleTurns: ConversationTurn[] = [
    {
      id: '1',
      direction: 'signed-to-spoken',
      text: 'Hello, where is the pharmacy?',
      timestampMs: new Date(2026, 10, 15, 9, 5, 3).getTime(),
      languageLabel: 'ASL',
      expressionTone: 'Raised eyebrows (question)',
    },
    {
      id: '2',
      direction: 'spoken-to-caption',
      text: 'It is right down the hall on your left.',
      timestampMs: new Date(2026, 10, 15, 9, 5, 14).getTime(),
      languageLabel: 'Spoken English',
    },
    {
      id: '3',
      direction: 'typed-to-spoken',
      text: 'Thank you so much!',
      timestampMs: new Date(2026, 10, 15, 9, 5, 20).getTime(),
      languageLabel: 'Typed Voice',
    },
  ];

  assert.equal(formatTabularTime(sampleTurns[0].timestampMs), '09:05:03');
  assert.equal(filterConversationTurns(sampleTurns, 'all', '').length, 3);
  assert.equal(filterConversationTurns(sampleTurns, 'signed', '').length, 2);
  assert.equal(filterConversationTurns(sampleTurns, 'spoken', '').length, 1);
  assert.equal(filterConversationTurns(sampleTurns, 'all', 'pharmacy').length, 1);
  assert.equal(filterConversationTurns(sampleTurns, 'all', 'eyebrows').length, 1);

  const exported = formatTranscriptExport(sampleTurns);
  assert.match(exported, /SIGNER \(SIGNED TO VOICE\)/);
  assert.match(exported, /HEARING SPEAKER \(CAPTIONED\)/);
  assert.match(exported, /Hello, where is the pharmacy\?/);
  assert.match(exported, /Total Turns: 3/);
});

test('transcriptPdf escapes special characters, wraps text, and generates valid multi-page PDF bytes', () => {
  assert.equal(
    escapePdfString('Hello (world) \\ test \u2014 \u201Cok\u201D'),
    'Hello \\(world\\) \\\\ test - "ok"'
  );

  const wrapped = wrapTextLines(
    'This is a long line that should cleanly wrap across multiple lines without dropping words.',
    28
  );
  assert.ok(wrapped.length >= 3);
  for (const line of wrapped) {
    assert.ok(line.length <= 28, `Wrapped line exceeded 28 chars: ${line}`);
  }

  const decoder = new TextDecoder('latin1');
  const emptyPdf = decoder.decode(generateTranscriptPdfBytes([]));
  assert.ok(emptyPdf.startsWith('%PDF-1.4\n'));
  assert.ok(emptyPdf.trimEnd().endsWith('%%EOF'));
  assert.match(emptyPdf, /\/Type \/Catalog/);
  assert.match(emptyPdf, /No conversation turns recorded in this session\./);
  assert.match(emptyPdf, /Page 1 of 1/);

  const manyTurns: ConversationTurn[] = Array.from({ length: 36 }, (_, idx) => ({
    id: `turn-${idx + 1}`,
    direction: idx % 2 === 0 ? 'signed-to-spoken' : 'spoken-to-caption',
    text: `Turn ${idx + 1}: Checking prescription pickup counter number ${idx + 1} with clear details.`,
    timestampMs: new Date(2026, 10, 15, 10, idx % 60, 0).getTime(),
    languageLabel: idx % 2 === 0 ? 'ASL' : 'Spoken English',
    gestureCue: idx % 2 === 0 ? 'Open hand gesture toward counter' : undefined,
  }));

  const multiPdfBytes = generateTranscriptPdfBytes(manyTurns);
  const multiPdf = decoder.decode(multiPdfBytes);
  assert.ok(multiPdf.startsWith('%PDF-1.4\n'));
  assert.ok(multiPdf.trimEnd().endsWith('%%EOF'));
  assert.match(multiPdf, /\/Type \/Pages \/Kids \[5 0 R 7 0 R/);
  assert.match(multiPdf, /Page 1 of /);
  assert.match(multiPdf, /Page 2 of /);
  assert.match(multiPdf, /Turn 36: Checking prescription pickup counter/);
});

test('transcribeAudioClip uses v1beta, cleans MIME codecs, and falls back on 404 NOT_FOUND', async () => {
  const calls: Array<{ apiVersion: string; model: string; mimeType: string; data: string }> = [];

  const transcript = await transcribeAudioClip(
    {
      audioBase64: 'data:audio/webm;codecs=opus;base64,AAAA',
      mimeType: 'audio/webm;codecs=opus',
    },
    {
      clientFactory: (apiVersion) => ({
        models: {
          generateContent: async (req) => {
            const parts = (req.contents as { parts: Array<{ inlineData?: { mimeType: string; data: string } }> }).parts;
            const inline = parts[0]?.inlineData;
            calls.push({
              apiVersion,
              model: String(req.model),
              mimeType: inline?.mimeType ?? '',
              data: inline?.data ?? '',
            });

            if (req.model === 'gemini-3.5-transcribe') {
              throw new Error('{"error":{"code":404,"status":"NOT_FOUND"}}');
            }
            return { text: '  Yes, I can help you right away.  ' };
          },
        },
      }),
    }
  );

  assert.equal(transcript, 'Yes, I can help you right away.');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    apiVersion: 'v1beta',
    model: 'gemini-3.5-transcribe',
    mimeType: 'audio/webm',
    data: 'AAAA',
  });
  assert.deepEqual(calls[1], {
    apiVersion: 'v1beta',
    model: 'gemini-4-hydrogen',
    mimeType: 'audio/webm',
    data: 'AAAA',
  });
});


