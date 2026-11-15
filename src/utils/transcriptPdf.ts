import {
  ConversationTurn,
  formatTabularTime,
} from './transcriptUtils';

interface StyledLine {
  text: string;
  font: 'F1' | 'F2';
  size: number;
  leading: number;
  gray?: number;
}

export function sanitizePdfText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00B7/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, '?');
}

export function escapePdfString(input: string): string {
  return sanitizePdfText(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function wrapTextLines(text: string, maxChars: number): string[] {
  const normalized = sanitizePdfText(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
      }
      continue;
    }

    if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      if (word.length <= maxChars) {
        current = word;
      } else {
        current = '';
        for (let i = 0; i < word.length; i += maxChars) {
          const chunk = word.slice(i, i + maxChars);
          if (i + maxChars < word.length) {
            lines.push(chunk);
          } else {
            current = chunk;
          }
        }
      }
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines;
}

function buildTranscriptStyledLines(
  turns: ConversationTurn[],
  sessionTitle: string
): StyledLine[] {
  const lines: StyledLine[] = [
    { text: sessionTitle, font: 'F2', size: 16, leading: 22, gray: 0.08 },
    {
      text: `Exported: ${new Date().toISOString()}  |  Total Turns: ${turns.length}`,
      font: 'F1',
      size: 10,
      leading: 18,
      gray: 0.35,
    },
    { text: '--------------------------------------------------------------------------', font: 'F1', size: 10, leading: 16, gray: 0.7 },
  ];

  if (turns.length === 0) {
    lines.push({
      text: 'No conversation turns recorded in this session.',
      font: 'F1',
      size: 11,
      leading: 16,
      gray: 0.35,
    });
    return lines;
  }

  for (const turn of turns) {
    const time = formatTabularTime(turn.timestampMs);
    const speakerLabel =
      turn.direction === 'spoken-to-caption'
        ? 'HEARING SPEAKER (CAPTIONED)'
        : turn.direction === 'typed-to-spoken'
          ? 'SIGNER (TYPED TO VOICE)'
          : 'SIGNER (SIGNED TO VOICE)';
    const details = [turn.languageLabel, turn.expressionTone]
      .filter(Boolean)
      .join(' - ');

    const headerLine = `[${time}] ${speakerLabel}${details ? ` (${details})` : ''}`;
    for (const wrapped of wrapTextLines(headerLine, 84)) {
      lines.push({ text: wrapped, font: 'F2', size: 10, leading: 14, gray: 0.12 });
    }

    for (const wrapped of wrapTextLines(turn.text, 78)) {
      lines.push({ text: wrapped, font: 'F1', size: 11, leading: 15, gray: 0.05 });
    }

    if (turn.gestureCue) {
      for (const wrapped of wrapTextLines(`Observed cue: ${turn.gestureCue}`, 84)) {
        lines.push({ text: wrapped, font: 'F1', size: 9.5, leading: 13, gray: 0.4 });
      }
    }

    lines.push({ text: '', font: 'F1', size: 10, leading: 10 });
  }

  return lines;
}

export function generateTranscriptPdfBytes(
  turns: ConversationTurn[],
  sessionTitle = 'SignBridge Conversation Transcript'
): Uint8Array {
  const allLines = buildTranscriptStyledLines(turns, sessionTitle);

  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 54;
  const startY = 738;
  const minY = 64;

  const pages: Array<Array<StyledLine & { y: number }>> = [];
  let currentPage: Array<StyledLine & { y: number }> = [];
  let y = startY;

  for (const line of allLines) {
    if (y - line.leading < minY && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      y = startY;
    }
    currentPage.push({ ...line, y });
    y -= line.leading;
  }
  if (currentPage.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  // Build PDF objects:
  // 1: Catalog, 2: Pages, 3: Helvetica (F1), 4: Helvetica-Bold (F2)
  // For each page i: Page object = 5 + i*2, Contents object = 6 + i*2
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    pageObjectIds.push(5 + i * 2);
  }

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(' ')}] /Count ${pages.length} >>\nendobj\n`
  );
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'
  );

  const encoder = new TextEncoder();

  for (let i = 0; i < pages.length; i++) {
    const pageObjId = 5 + i * 2;
    const contentObjId = 6 + i * 2;
    const ops: string[] = [];

    for (const item of pages[i]) {
      if (!item.text) continue;
      const g = (item.gray ?? 0).toFixed(2);
      ops.push(
        `BT /${item.font} ${item.size} Tf ${g} ${g} ${g} rg 1 0 0 1 ${marginX} ${item.y} Tm (${escapePdfString(
          item.text
        )}) Tj ET`
      );
    }

    // Footer with page number
    const footerText = `Page ${i + 1} of ${pages.length}`;
    ops.push(
      `BT /F1 9 Tf 0.45 0.45 0.45 rg 1 0 0 1 ${marginX} 36 Tm (${escapePdfString(
        footerText
      )}) Tj ET`
    );

    const streamBody = ops.join('\n') + '\n';
    const streamLength = encoder.encode(streamBody).length;

    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamBody}endstream\nendobj\n`
    );
  }

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // object 0
  let totalBytes = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    totalBytes += bytes.length;
  };

  pushStr('%PDF-1.4\n');
  for (const obj of objects) {
    offsets.push(totalBytes);
    pushStr(obj);
  }

  const xrefOffset = totalBytes;
  pushStr(`xref\n0 ${objects.length + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  const output = new Uint8Array(totalBytes);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}
