const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { OpenAI } = require('openai');

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

class TranscriptionService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for Whisper transcription');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async transcribeBuffer(audioBuffer, { mimeType = 'audio/webm', language = 'en', prompt = null } = {}) {
    if (!audioBuffer || !(audioBuffer instanceof Buffer)) {
      throw new Error('Audio buffer is required for transcription');
    }

    const fileExtension = this.#detectExtension(mimeType);
    const tempFilePath = path.join(os.tmpdir(), `voice-input-${Date.now()}.${fileExtension}`);

    try {
      await writeFileAsync(tempFilePath, audioBuffer);

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language,
        response_format: 'verbose_json',
        temperature: 0.2,
        prompt: prompt || undefined
      });

      return {
        text: transcription.text,
        segments: transcription.segments || [],
        confidence: transcription.duration ? this.#estimateConfidence(transcription) : null
      };
    } finally {
      try {
        await unlinkAsync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to remove temporary audio file:', cleanupError.message);
      }
    }
  }

  #detectExtension(mimeType) {
    if (!mimeType || typeof mimeType !== 'string') {
      return 'webm';
    }

    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('m4a')) return 'm4a';

    return 'webm';
  }

  #estimateConfidence(transcription) {
    const segments = transcription.segments || [];
    if (!segments.length) {
      return null;
    }

    const avgConfidence = segments.reduce((sum, segment) => {
      if (typeof segment.avg_logprob === 'number') {
        return sum + Math.exp(segment.avg_logprob);
      }
      if (typeof segment.confidence === 'number') {
        return sum + segment.confidence;
      }
      return sum + 0.7; // fallback heuristic
    }, 0) / segments.length;

    return Math.min(0.99, Math.max(0.4, avgConfidence));
  }
}

let transcriptionService;

function getTranscriptionService() {
  if (!transcriptionService) {
    try {
      transcriptionService = new TranscriptionService();
      console.log('✅ Whisper transcription service initialized');
    } catch (error) {
      console.warn('⚠️  Whisper transcription unavailable:', error.message);
      transcriptionService = null;
    }
  }
  return transcriptionService;
}

module.exports = {
  getTranscriptionService
};

