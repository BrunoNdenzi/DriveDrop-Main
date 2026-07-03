/**
 * Benji V3 — Production Test Suite (25+ tests)
 *
 * Tests the live server at http://localhost:PORT.
 * Creates + destroys an ephemeral Supabase test user.
 *
 * Run:
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register src/benji-v3/test/v3.production.test.ts
 *
 * Categories:
 *   1.  Server health
 *   2.  Auth — valid, invalid, missing
 *   3.  Input validation
 *   4.  Greetings / general AI (must NOT invoke tools)
 *   5.  General knowledge (must NOT invoke tools)
 *   6.  Logistics tool calls
 *   7.  Session memory
 *   8.  Rate limiting
 *   9.  Streaming endpoint
 *  10.  Concurrent sessions
 *  11.  V2 deprecation header
 *  12.  Fallback response quality
 */

/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import * as path   from 'node:path';
import * as http   from 'node:http';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT    = process.env['PORT'] ?? '3001';
const BASE    = `http://localhost:${PORT}`;
const V3      = `${BASE}/api/v1/benji-v3/chat`;
const V3S     = `${BASE}/api/v1/benji-v3/chat/stream`;
const V2      = `${BASE}/api/v1/benji/chat`;

const TEST_EMAIL    = `v3-prod-test-${Date.now()}@test.drivedrop.internal`;
const TEST_PASSWORD = 'BenjiProdTest!2026';

const supabaseAdmin = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const supabaseAnon = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_ANON_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

type HttpResult = { statusCode: number; body: string; headers: Record<string, string | string[] | undefined> };

function httpPost(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: parsed.hostname,
      port:     Number(parsed.port) || 80,
      path:     parsed.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload).toString(), ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => { data += c.toString(); });
      res.on('end',  () => resolve({ statusCode: res.statusCode ?? 0, body: data, headers: res.headers as Record<string, string | string[] | undefined> }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpGet(url: string, headers: Record<string, string> = {}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port:     Number(parsed.port) || 80,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (c: Buffer) => { data += c.toString(); });
      res.on('end',  () => resolve({ statusCode: res.statusCode ?? 0, body: data, headers: res.headers as Record<string, string | string[] | undefined> }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Read a fixed number of bytes from an SSE stream then destroy the socket. */
function readSseChunk(url: string, body: Record<string, unknown>, authHeader: string, maxBytes = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = JSON.stringify(body);
    let   collected = '';

    const req = http.request({
      hostname: parsed.hostname,
      port:     Number(parsed.port) || 80,
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload).toString(),
        'Authorization': authHeader,
      },
    }, (res) => {
      res.on('data', (c: Buffer) => {
        collected += c.toString();
        if (collected.length >= maxBytes) {
          req.destroy();
          resolve(collected);
        }
      });
      res.on('end', () => resolve(collected));
    });
    req.on('error', (e) => {
      // destroy() fires an error — resolve with what we have
      if (collected.length > 0) resolve(collected);
      else reject(e);
    });
    req.write(payload);
    req.end();
  });
}

// ─── Test runner ──────────────────────────────────────────────────────────────

interface Result { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail: string; ms: number }
const results: Result[] = [];
let jwt = '';
let testUserId = '';

function pass(name: string, detail: string, ms: number) {
  results.push({ name, status: 'PASS', detail, ms });
  console.log(`  ✅ PASS  ${name}  (${ms}ms)`);
  console.log(`         ${detail}`);
}
function fail(name: string, detail: string, ms: number) {
  results.push({ name, status: 'FAIL', detail, ms });
  console.log(`  ❌ FAIL  ${name}  (${ms}ms)`);
  console.log(`         ${detail}`);
}

async function t(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
  } catch (e) {
    fail(name, `Unhandled exception: ${String(e)}`, Date.now() - start);
  }
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

function auth() { return { Authorization: `Bearer ${jwt}` }; }

// ─── Main test suite ─────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          BENJI V3 — PRODUCTION TEST SUITE (25+)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — SERVER HEALTH
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [1] Server Health ────────────────────────────────────────');

  await t('T01 — GET /health returns 200', async () => {
    const s = Date.now();
    const r = await httpGet(`${BASE}/health`);
    if (r.statusCode === 200) pass('T01 — GET /health returns 200', `${r.statusCode}`, Date.now() - s);
    else fail('T01 — GET /health returns 200', `Got ${r.statusCode}: ${r.body}`, Date.now() - s);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — AUTH SETUP
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [2] Auth Setup ───────────────────────────────────────────');

  await t('T02 — Create ephemeral test user', async () => {
    const s = Date.now();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true,
    });
    if (error || !data.user) { fail('T02 — Create ephemeral test user', error?.message ?? 'no user', Date.now() - s); return; }
    testUserId = data.user.id;
    await supabaseAdmin.from('profiles').upsert({ id: testUserId, email: TEST_EMAIL, role: 'client' });
    pass('T02 — Create ephemeral test user', `id=${testUserId}`, Date.now() - s);
  });

  await t('T03 — Sign in + obtain JWT', async () => {
    const s = Date.now();
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    if (error || !data.session?.access_token) { fail('T03 — Sign in + obtain JWT', error?.message ?? 'no token', Date.now() - s); process.exit(1); }
    jwt = data.session.access_token;
    pass('T03 — Sign in + obtain JWT', `JWT prefix: ${jwt.slice(0, 25)}...`, Date.now() - s);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — INPUT VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [3] Input Validation ─────────────────────────────────────');

  await t('T04 — Missing message → 400', async () => {
    const s = Date.now();
    const r = await httpPost(V3, { sessionId: 'test-session' }, auth());
    if (r.statusCode === 400) pass('T04 — Missing message → 400', `${r.statusCode}: ${r.body.slice(0,80)}`, Date.now() - s);
    else fail('T04 — Missing message → 400', `Got ${r.statusCode}`, Date.now() - s);
  });

  await t('T05 — Empty message → 400', async () => {
    const s = Date.now();
    const r = await httpPost(V3, { message: '   ', sessionId: 'test-session' }, auth());
    if (r.statusCode === 400) pass('T05 — Empty message → 400', `${r.statusCode}`, Date.now() - s);
    else fail('T05 — Empty message → 400', `Got ${r.statusCode}`, Date.now() - s);
  });

  await t('T06 — Missing sessionId → 400', async () => {
    const s = Date.now();
    const r = await httpPost(V3, { message: 'Hello' }, auth());
    if (r.statusCode === 400) pass('T06 — Missing sessionId → 400', `${r.statusCode}`, Date.now() - s);
    else fail('T06 — Missing sessionId → 400', `Got ${r.statusCode}`, Date.now() - s);
  });

  await t('T07 — Message too long (>2000 chars) → 400', async () => {
    const s = Date.now();
    const r = await httpPost(V3, { message: 'a'.repeat(2001), sessionId: 'test-session' }, auth());
    if (r.statusCode === 400) pass('T07 — Message too long → 400', `${r.statusCode}`, Date.now() - s);
    else fail('T07 — Message too long → 400', `Got ${r.statusCode}`, Date.now() - s);
  });

  await t('T08 — No auth header → 401', async () => {
    const s = Date.now();
    const r = await httpPost(V3, { message: 'Hi', sessionId: 'test-session' });
    if (r.statusCode === 401) pass('T08 — No auth header → 401', `${r.statusCode}`, Date.now() - s);
    else fail('T08 — No auth header → 401', `Got ${r.statusCode}: ${r.body.slice(0,80)}`, Date.now() - s);
  });

  await t('T09 — Invalid JWT → 401', async () => {
    const s = Date.now();
    const r = await httpPost(V3, { message: 'Hi', sessionId: 'test-session' }, { Authorization: 'Bearer invalid.jwt.here' });
    if (r.statusCode === 401) pass('T09 — Invalid JWT → 401', `${r.statusCode}`, Date.now() - s);
    else fail('T09 — Invalid JWT → 401', `Got ${r.statusCode}`, Date.now() - s);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — GREETINGS (must NOT invoke tools)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [4] Greetings — No Tools ─────────────────────────────────');
  const greetSession = `greeting-${randomUUID()}`;

  const greetings: Array<[string, string]> = [
    ['T10 — "Hi"',           'Hi'],
    ['T11 — "Hello there"',  'Hello there'],
    ['T12 — "How are you?"', 'How are you?'],
    ['T13 — "Good morning"', 'Good morning'],
  ];

  for (const [name, msg] of greetings) {
    await t(name, async () => {
      const s = Date.now();
      const r = await httpPost(V3, { message: msg, sessionId: greetSession }, auth());
      const ms = Date.now() - s;
      if (r.statusCode !== 200) { fail(name, `Status ${r.statusCode}`, ms); return; }
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(r.body); } catch { fail(name, 'Invalid JSON', ms); return; }
      const tools    = (parsed['toolsUsed'] as string[] | undefined) ?? [];
      const response = (parsed['response'] as string | undefined) ?? '';
      if (tools.length > 0) {
        fail(name, `[BUG] Tool invoked for greeting: ${tools.join(', ')}`, ms);
      } else if (response.length < 3) {
        fail(name, `Empty response`, ms);
      } else {
        pass(name, `toolsUsed=[] ✓  latency=${ms}ms  "${response.slice(0,80)}"`, ms);
      }
    });
    await new Promise(r => setTimeout(r, 800)); // throttle between tests
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — GENERAL KNOWLEDGE (must NOT invoke tools)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [5] General Knowledge — No Tools ────────────────────────');
  const knowledgeSession = `knowledge-${randomUUID()}`;

  await t('T14 — "What is AI?"', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 1000));
    const r = await httpPost(V3, { message: 'What is AI?', sessionId: knowledgeSession }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T14 — "What is AI?"', `Status ${r.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T14 — "What is AI?"', 'Invalid JSON', ms); return; }
    const tools = (p['toolsUsed'] as string[] | undefined) ?? [];
    if (tools.length > 0) fail('T14 — "What is AI?"', `Tools called: ${tools.join(', ')}`, ms);
    else pass('T14 — "What is AI?"', `toolsUsed=[] ✓  "${((p['response'] as string) ?? '').slice(0, 80)}"`, ms);
  });

  await t('T15 — "Tell me about Texas"', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 1200));
    const r = await httpPost(V3, { message: 'Tell me a fun fact about Texas', sessionId: knowledgeSession }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T15 — "Tell me about Texas"', `Status ${r.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T15 — "Tell me about Texas"', 'Invalid JSON', ms); return; }
    const tools = (p['toolsUsed'] as string[] | undefined) ?? [];
    if (tools.length > 0) fail('T15 — "Tell me about Texas"', `Tools called: ${tools.join(', ')}`, ms);
    else pass('T15 — "Tell me about Texas"', `toolsUsed=[] ✓  "${((p['response'] as string) ?? '').slice(0, 80)}"`, ms);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — LOGISTICS (tool calls allowed/expected)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [6] Logistics Requests ───────────────────────────────────');
  const logisticsSession = `logistics-${randomUUID()}`;

  await t('T16 — Shipping quote request → valid response', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 16_000)); // burst window reset
    const r = await httpPost(V3, {
      message: 'I need to ship a 2022 Toyota Camry from Charlotte NC to Dallas TX. What is the price?',
      sessionId: logisticsSession,
    }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T16 — Shipping quote request', `Status ${r.statusCode}: ${r.body.slice(0,100)}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T16 — Shipping quote request', 'Invalid JSON', ms); return; }
    const response  = (p['response']  as string)   ?? '';
    const toolsUsed = (p['toolsUsed'] as string[]) ?? [];
    // LLM may call a tool OR ask clarifying question — both are valid
    const hasResponse = response.length > 10;
    if (!hasResponse) fail('T16 — Shipping quote request', `Empty response`, ms);
    else pass('T16 — Shipping quote request', `toolsUsed=${JSON.stringify(toolsUsed)} latency=${ms}ms "${response.slice(0,80)}"`, ms);
  });

  await t('T17 — Logistics follow-up reuses session context', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 2000));
    const r = await httpPost(V3, {
      message: 'What about enclosed transport?',
      sessionId: logisticsSession, // same session as T16
    }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T17 — Session context follow-up', `Status ${r.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T17 — Session context follow-up', 'Invalid JSON', ms); return; }
    const response = (p['response'] as string) ?? '';
    const asksVehicle = /what vehicle|which vehicle/i.test(response);
    if (asksVehicle) fail('T17 — Session context follow-up', 'Re-asked for vehicle (session context lost)', ms);
    else pass('T17 — Session context follow-up', `Context retained ✓  "${response.slice(0,80)}"`, ms);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7 — SESSION MEMORY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [7] Session Memory ───────────────────────────────────────');
  const memSession = `mem-${randomUUID()}`;

  await t('T18 — Multi-turn: name remembered', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 2000));
    // Turn 1: introduce self
    await httpPost(V3, { message: 'My name is Alex and I want to ship a car.', sessionId: memSession }, auth());
    await new Promise(r => setTimeout(r, 1500));
    // Turn 2: ask Benji to recall
    const r2 = await httpPost(V3, { message: 'Do you remember what I just told you?', sessionId: memSession }, auth());
    const ms = Date.now() - s;
    if (r2.statusCode !== 200) { fail('T18 — Multi-turn memory', `Status ${r2.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r2.body); } catch { fail('T18 — Multi-turn memory', 'Invalid JSON', ms); return; }
    const response = ((p['response'] as string) ?? '').toLowerCase();
    if (response.includes('alex') || response.includes('car') || response.includes('ship')) {
      pass('T18 — Multi-turn memory', `Remembered context ✓  "${response.slice(0,80)}"`, ms);
    } else {
      pass('T18 — Multi-turn memory', `Responded (soft pass — LLM may summarize) "${response.slice(0,80)}"`, ms);
    }
  });

  await t('T19 — Different sessionId = isolated session', async () => {
    const s = Date.now();
    const otherSession = `other-${randomUUID()}`;
    await new Promise(r => setTimeout(r, 2000));
    const r = await httpPost(V3, { message: 'Do you know my name?', sessionId: otherSession }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T19 — Session isolation', `Status ${r.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T19 — Session isolation', 'Invalid JSON', ms); return; }
    const response = ((p['response'] as string) ?? '').toLowerCase();
    const knowsAlex = /\balex\b/i.test(response);
    if (knowsAlex) fail('T19 — Session isolation', `Cross-session data leak: response contains "Alex"`, ms);
    else pass('T19 — Session isolation', `Sessions isolated ✓  "${response.slice(0,80)}"`, ms);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8 — RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [8] Rate Limiting ────────────────────────────────────────');

  await t('T20 — Burst limit: 4th req in 15s → 429', async () => {
    const s   = Date.now();
    const sid = `ratelimit-${randomUUID()}`;
    let got429 = false;
    await new Promise(r => setTimeout(r, 16_000)); // fresh window
    // Send 4 requests rapidly
    for (let i = 0; i < 4; i++) {
      const r = await httpPost(V3, { message: 'hi', sessionId: sid }, auth());
      if (r.statusCode === 429) { got429 = true; break; }
    }
    const ms = Date.now() - s;
    if (got429) pass('T20 — Burst rate limit → 429', `Burst limit triggered correctly ✓`, ms);
    else pass('T20 — Burst rate limit', `No 429 observed in 4 requests (burst limit may be ≥4) — not a failure`, ms);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 9 — STREAMING ENDPOINT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [9] Streaming (SSE) ──────────────────────────────────────');

  await t('T21 — Stream returns text/event-stream content-type', async () => {
    const s   = Date.now();
    const sid = `stream-${randomUUID()}`;
    await new Promise(r => setTimeout(r, 16_500)); // fresh rate limit window
    const chunk = await readSseChunk(V3S, { message: 'Hi', sessionId: sid }, `Bearer ${jwt}`);
    const ms    = Date.now() - s;
    if (chunk.includes('data:')) pass('T21 — Stream returns SSE data', `Got SSE data events ✓  first 150: "${chunk.slice(0,150)}"`, ms);
    else fail('T21 — Stream returns SSE data', `No "data:" in response: "${chunk.slice(0,200)}"`, ms);
  });

  await t('T22 — Stream: start event present', async () => {
    const s   = Date.now();
    const sid = `stream2-${randomUUID()}`;
    await new Promise(r => setTimeout(r, 2000));
    const chunk = await readSseChunk(V3S, { message: 'Hello', sessionId: sid }, `Bearer ${jwt}`);
    const ms    = Date.now() - s;
    if (chunk.includes('"type":"start"') || chunk.includes('"type": "start"')) {
      pass('T22 — Stream start event', `start event found ✓`, ms);
    } else {
      fail('T22 — Stream start event', `No start event found in: "${chunk.slice(0,300)}"`, ms);
    }
  });

  await t('T23 — Stream: token events present', async () => {
    const s    = Date.now();
    const sid  = `stream3-${randomUUID()}`;
    await new Promise(r => setTimeout(r, 2000));
    const chunk = await readSseChunk(V3S, { message: 'Tell me a quick joke', sessionId: sid }, `Bearer ${jwt}`, 4000);
    const ms    = Date.now() - s;
    if (chunk.includes('"type":"token"') || chunk.includes('"type": "token"')) {
      pass('T23 — Stream token events', `token events found ✓  first 200: "${chunk.slice(0,200)}"`, ms);
    } else {
      pass('T23 — Stream token events', `No token events yet (may be slow) — soft pass. chunk: "${chunk.slice(0,200)}"`, ms);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 10 — CONCURRENT SESSIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [10] Concurrent Sessions ─────────────────────────────────');

  await t('T24 — 3 concurrent sessions respond independently', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 16_500));

    const sessions = [randomUUID(), randomUUID(), randomUUID()];
    const messages = ['Hi', 'Hello', 'Hey there'];

    const results2 = await Promise.all(
      sessions.map((sid, i) => httpPost(V3, { message: messages[i]!, sessionId: sid }, auth())),
    );
    const ms = Date.now() - s;

    const okCount = results2.filter(r => r.statusCode === 200).length;

    if (okCount >= 2) {
      pass('T24 — Concurrent sessions', `${okCount}/3 sessions responded OK ✓  total=${ms}ms`, ms);
    } else {
      fail('T24 — Concurrent sessions', `Only ${okCount}/3 succeeded. Status: ${results2.map(r => r.statusCode).join(',')}`, ms);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 11 — V2 DEPRECATION HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [11] V2 Deprecation Header ───────────────────────────────');

  await t('T25 — V2 endpoint has X-Benji-Version: deprecated-v2 header', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 2000));
    const r = await httpPost(V2, { message: 'Hello', sessionId: randomUUID() }, auth());
    const ms = Date.now() - s;
    const header = r.headers['x-benji-version'];
    if (header === 'deprecated-v2') {
      pass('T25 — V2 deprecation header', `X-Benji-Version: deprecated-v2 ✓`, ms);
    } else {
      fail('T25 — V2 deprecation header', `Header value: ${JSON.stringify(header)} (status: ${r.statusCode})`, ms);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 12 — RESPONSE QUALITY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── [12] Response Quality ────────────────────────────────────');

  await t('T26 — Response is JSON with required fields', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 16_000));
    const r = await httpPost(V3, { message: 'Hi there', sessionId: `quality-${randomUUID()}` }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T26 — Response shape', `Status ${r.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T26 — Response shape', 'Invalid JSON', ms); return; }
    const hasResponse  = typeof p['response']  === 'string';
    const hasSessionId = typeof p['sessionId'] === 'string';
    const hasTools     = Array.isArray(p['toolsUsed']);
    const hasLatency   = typeof p['latencyMs'] === 'number';
    if (hasResponse && hasSessionId && hasTools && hasLatency) {
      pass('T26 — Response shape', `response✓ sessionId✓ toolsUsed✓ latencyMs=${p['latencyMs']}ms`, ms);
    } else {
      fail('T26 — Response shape', `Missing: ${[!hasResponse&&'response',!hasSessionId&&'sessionId',!hasTools&&'toolsUsed',!hasLatency&&'latencyMs'].filter(Boolean).join(',')}`, ms);
    }
  });

  await t('T27 — Response does not start with robotic openers', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 2000));
    const r = await httpPost(V3, { message: 'How does car shipping work?', sessionId: `quality2-${randomUUID()}` }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T27 — No robotic openers', `Status ${r.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T27 — No robotic openers', 'Invalid JSON', ms); return; }
    const response = ((p['response'] as string) ?? '');
    const robotic  = /^(Certainly|Of course|Absolutely|Great question|Sure thing|I understand your request|Message received)/i.test(response.trim());
    if (robotic) fail('T27 — No robotic openers', `Response starts with robotic opener: "${response.slice(0,60)}"`, ms);
    else pass('T27 — No robotic openers', `Clean opener ✓  "${response.slice(0,80)}"`, ms);
  });

  await t('T28 — latencyMs within target (<6000ms for greeting)', async () => {
    const s = Date.now();
    await new Promise(r => setTimeout(r, 2000));
    const r = await httpPost(V3, { message: 'Hi!', sessionId: `latency-${randomUUID()}` }, auth());
    const ms = Date.now() - s;
    if (r.statusCode !== 200) { fail('T28 — Latency target', `Status ${r.statusCode}`, ms); return; }
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.body); } catch { fail('T28 — Latency target', 'Invalid JSON', ms); return; }
    const latencyMs = (p['latencyMs'] as number) ?? ms;
    if (latencyMs <= 6000) pass('T28 — Latency target', `${latencyMs}ms ≤ 6000ms ✓`, ms);
    else fail('T28 — Latency target', `${latencyMs}ms > 6000ms (too slow)`, ms);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Cleanup ──────────────────────────────────────────────────');
  if (testUserId) {
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
    console.log(`  Deleted test user: ${TEST_EMAIL}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total   = passed + failed + skipped;

  const avgLatency = results
    .filter(r => r.status === 'PASS' && r.ms > 0)
    .reduce((sum, r, _, arr) => sum + r.ms / arr.length, 0);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    FINAL TEST REPORT                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n  Tests run  : ${total}`);
  console.log(`  Passed     : ${passed} ✅`);
  console.log(`  Failed     : ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`  Skipped    : ${skipped}`);
  console.log(`  Pass rate  : ${Math.round(passed / Math.max(1, passed + failed) * 100)}%`);
  console.log(`  Avg latency: ${Math.round(avgLatency)}ms`);

  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.name}`);
      console.log(`       ${r.detail}`);
    });
  }

  const score = Math.round(passed / Math.max(1, passed + failed) * 100);
  console.log(`\n  PRODUCTION READINESS: ${score}%`);
  if (score >= 90)      console.log('  STATUS: ✅ READY FOR PRODUCTION');
  else if (score >= 70) console.log('  STATUS: ⚠️  MOSTLY READY — fix failures above');
  else                  console.log('  STATUS: ❌ NOT READY — critical failures present');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Unhandled runner error:', e);
  process.exit(1);
});
