import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attachLiveBridgeWebSocket,
  interpretSignFrames,
  synthesizeSpeech,
  transcribeAudioClip,
} from './server/geminiBridge.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '18mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post('/api/interpret-sign', async (req, res) => {
    try {
      const { frames, signLanguage, targetSpokenLanguage, voiceName, contextHistory } = req.body ?? {};
      if (!Array.isArray(frames) || frames.length === 0) {
        res.status(400).json({ error: 'Please provide at least one camera frame.' });
        return;
      }

      const result = await interpretSignFrames({
        frames,
        signLanguage: signLanguage || 'ASL (American Sign Language)',
        targetSpokenLanguage: targetSpokenLanguage || 'English',
        voiceName,
        contextHistory,
      });

      res.json(result);
    } catch (err) {
      console.error('Sign interpretation error:', err);
      const message = err instanceof Error ? err.message : 'Failed to interpret sign frames.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/speak', async (req, res) => {
    try {
      const { text, voiceName, style } = req.body ?? {};
      if (typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Text is required to generate speech.' });
        return;
      }
      const audio = await synthesizeSpeech({ text, voiceName, style });
      res.json(audio);
    } catch (err) {
      console.error('Speech synthesis error:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate spoken audio.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/transcribe-audio', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body ?? {};
      if (typeof audioBase64 !== 'string' || !audioBase64.trim()) {
        res.status(400).json({ error: 'Audio data is required for transcription.' });
        return;
      }
      const transcript = await transcribeAudioClip({
        audioBase64,
        mimeType: mimeType || 'audio/webm',
      });
      res.json({ transcript });
    } catch (err) {
      console.error('Audio transcription error:', err);
      const message = err instanceof Error ? err.message : 'Failed to transcribe audio.';
      res.status(500).json({ error: message });
    }
  });

  const httpServer = createServer(app);
  attachLiveBridgeWebSocket(httpServer);

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`SignBridge server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SignBridge server:', err);
  process.exit(1);
});
