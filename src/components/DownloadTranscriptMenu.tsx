import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileText } from 'lucide-react';
import { ConversationTurn, formatTranscriptExport } from '../utils/transcriptUtils';
import { generateTranscriptPdfBytes } from '../utils/transcriptPdf';

interface DownloadTranscriptMenuProps {
  turns: ConversationTurn[];
}

export function DownloadTranscriptMenu({ turns }: DownloadTranscriptMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const triggerDownload = (blob: Blob, extension: 'txt' | 'pdf') => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signbridge-transcript-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const handleDownloadTxt = () => {
    const content = formatTranscriptExport(turns);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, 'txt');
  };

  const handleDownloadPdf = () => {
    const pdfBytes = generateTranscriptPdfBytes(turns);
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'application/pdf' });
    triggerDownload(blob, 'pdf');
  };

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={turns.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          turns.length === 0
            ? 'Start a conversation to download the transcript'
            : 'Download conversation transcript as Plain Text or PDF'
        }
        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200 dark:focus-visible:outline-amber-300"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download Transcript
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Transcript export formats"
          className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadTxt}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <FileText
              className="h-4 w-4 shrink-0 text-stone-500 dark:text-slate-400"
              aria-hidden="true"
            />
            <span>Plain Text (.txt)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadPdf}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Download
              className="h-4 w-4 shrink-0 text-blue-700 dark:text-amber-300"
              aria-hidden="true"
            />
            <span>PDF Document (.pdf)</span>
          </button>
        </div>
      )}
    </div>
  );
}
