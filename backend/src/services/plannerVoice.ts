export const NATURAL_VOICES = [
  { id: 'en-US-Neural2-F', label: 'Female, warm' },
  { id: 'en-US-Neural2-C', label: 'Female, clear' },
  { id: 'en-US-Neural2-D', label: 'Male, steady' },
  { id: 'en-US-Neural2-J', label: 'Male, calm' },
] as const;

export const DEFAULT_VOICE = NATURAL_VOICES[0].id;
export const MAX_SPOKEN_CHARS = 240;

export interface VoiceRequest {
  text: string;
  voice: string;
  rate: number;
}

// Only short, plain driving instructions are voiced; anything else is refused before it reaches a paid API.
export function parseVoiceRequest(body: unknown): VoiceRequest {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const raw = typeof input['text'] === 'string' ? input['text'] : '';
  const text = raw.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Text is required');
  if (text.length > MAX_SPOKEN_CHARS) throw new Error(`Text must be ${MAX_SPOKEN_CHARS} characters or fewer`);

  const requested = typeof input['voice'] === 'string' ? input['voice'] : DEFAULT_VOICE;
  const voice = NATURAL_VOICES.some(item => item.id === requested) ? requested : DEFAULT_VOICE;
  const rate = Number(input['rate']);
  return { text, voice, rate: Number.isFinite(rate) ? Math.min(1.3, Math.max(0.8, rate)) : 1 };
}

// A car's Bluetooth or a phone speaker can take a moment to wake up, which swallows the first word; a short silence absorbs that.
export const VOICE_LEAD_IN_MS = 300;

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function buildSynthesisBody({ text, voice, rate }: VoiceRequest) {
  return {
    input: { ssml: `<speak><break time="${VOICE_LEAD_IN_MS}ms"/>${escapeXml(text)}</speak>` },
    voice: { languageCode: 'en-US', name: voice },
    audioConfig: { audioEncoding: 'MP3', speakingRate: rate, sampleRateHertz: 24000 },
  };
}

// A sliding window per key, so one signed-in account cannot run up the text-to-speech bill.
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now: number = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter(time => now - time < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      hits.set(key, [...recent, now]);
      return true;
    },
  };
}
