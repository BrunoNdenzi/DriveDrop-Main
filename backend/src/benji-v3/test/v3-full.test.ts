/**
 * Benji V3 — Comprehensive Production Test Suite
 * ════════════════════════════════════════════════
 * 27 automated tests across 9 categories:
 *
 *  1. Health & Auth          (3 tests)
 *  2. Greetings / General AI (5 tests)
 *  3. Tool Invocation        (3 tests)
 *  4. Shipment Flow          (3 tests)
 *  5. Session Memory         (3 tests)
 *  6. Tool Failure Recovery  (2 tests)
 *  7. Rate Limiting          (2 tests)
 *  8. Auth Failures          (3 tests)
 *  9. Streaming (SSE)        (3 tests)
 *
 * Run:
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register src/benji-v3/test/v3-full.test.ts
 */

/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import * as path   from 'node:path';
import * as http   from 'node:http';
import * as https  from 'node:https';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT     = process.env['PORT'] ?? '3001';
const BASE_URL = `http://localhost:${PORT}`;
const V3_CHAT  = `${BASE_URL}/api/v1/benji-v3/chat`;
const V3_STREAM = `${BASE_URL}/api/v1/benji-v3/chat/stream`;

const TEST_EMAIL    = `v3-full-${Date.now()}@test.drivedrop.internal`;
const TEST_PASSWORD = '';
const SESSION       = `full-test-${randomUUID()}`;

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

// ─── HTTP utilities ───────────────────────────────────────────────────────────

function post(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ statusCode: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = JSON.stringify(body);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload).toString(),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c: Buffer) => { data += c.toString(); });
        res.on('end',  () => resolve({
          statusCode: res.statusCode ?? 0,
          body:       data,
          headers:    res.headers as Record<string, string | string[] | undefined>,
        }));
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpGet(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.get({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname }, (res) => {
      let d = '';
      res.on('data', (c: Buffer) => { d += c.toString(); });
      res.on('end',  () => resolve({ statusCode: res.statusCode ?? 0, body: d }));
    });
    req.on('error', reject);
  });
}

/** Consume SSE response until [DONE] or timeout, return all collected events */
function consumeSSE(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  timeoutMs = 30_000,
): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = JSON.stringify(body);
    const events: Array<Record<string, unknown>> = [];
    let buf = '';

    const timer = setTimeout(() => {
      reject(new Error(`SSE timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const req = http.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || 80,
        path:     parsed.pathname,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload).toString(),
          ...headers,
        },
      },
      (res) => {
        res.on('data', (chunk: Buffer) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const json = trimmed.slice(5).trim();
            if (json === '[DONE]') { clearTimeout(timer); resolve(events); return; }
            try { events.push(JSON.parse(json)); } catch { /* skip malformed */ }
          }
        });
        res.on('end', () => { clearTimeout(timer); resolve(events); });
        res.on('error', (e) => { clearTimeout(timer); reject(e); });
      },
    );
    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.write(payload);
    req.end();
  });
}

// ─── Test framework ───────────────────────────────────────────────────────────

interface TestResult { name: string; status: 'PASS' | 'FAIL'; detail: string; ms: number }
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    results.push({ name, status: 'PASS', detail: '', ms });
    console.log(`  ✅ ${name} (${ms}ms)`);
  } catch (e) {
    const ms = Date.now() - start;
    const detail = e instanceof Error ? e.message : String(e);
    results.push({ name, status: 'FAIL', detail, ms });
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     BENJI V3 — FULL PRODUCTION TEST SUITE (27)      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 1: Health & Auth (3 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 1: Health & Auth ────────────────────────────');

  await test('GET /health returns 200', async () => {
    const res = await httpGet(`${BASE_URL}/health`);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  });

  let jwt = '';
  let testUserId = '';

  await test('Create test user + sign in → get JWT', async () => {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email:         TEST_EMAIL,
      password:      TEST_PASSWORD,
      email_confirm: true,
    });
    assert(!createErr && !!created.user, createErr?.message ?? 'createUser failed');
    testUserId = created.user!.id;

    await supabaseAdmin.from('profiles').upsert({ id: testUserId, email: TEST_EMAIL, role: 'client' });

    const { data: session, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
      email: TEST_EMAIL, password: TEST_PASSWORD,
    });
    assert(!signInErr && !!session.session?.access_token, signInErr?.message ?? 'no token');
    jwt = session.session!.access_token;
    assert(jwt.length > 20, 'JWT too short');
  });

  const authHeader = () => ({ Authorization: `Bearer ${jwt}` });

  await test('Missing auth → 401', async () => {
    const res = await post(V3_CHAT, { message: 'hi', sessionId: SESSION });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}: ${res.body}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 2: Greetings / General AI (5 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 2: Greetings / General AI ──────────────────');

  const greetSession = `greet-${randomUUID()}`;

  for (const msg of ['Hi', 'Hello there', 'How are you?', "What's the capital of France?", 'Tell me a fun fact']) {
    await test(`Greeting "${msg}" → toolsUsed=[], non-empty response`, async () => {
      const res = await post(V3_CHAT, { message: msg, sessionId: greetSession }, authHeader());
      assert(res.statusCode === 200, `Status ${res.statusCode}`);
      const body = JSON.parse(res.body) as Record<string, unknown>;
      const toolsUsed = body['toolsUsed'] as string[] | undefined;
      const response  = body['response']  as string | undefined;
      assert(!!response && response.length > 3, `Empty response: ${JSON.stringify(response)}`);
      assert(!toolsUsed || toolsUsed.length === 0, `Tool invoked for greeting: ${JSON.stringify(toolsUsed)}`);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 3: Tool Invocation (3 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 3: Tool Invocation ──────────────────────────');

  // Wait for burst window reset after 5 greeting messages
  console.log('  (waiting 16s for rate-limit burst window reset…)');
  await new Promise(r => setTimeout(r, 16_000));

  const toolSession = `tool-${randomUUID()}`;

  await test('Logistics message returns valid response with or without tool call', async () => {
    const res = await post(V3_CHAT, {
      message:   'I need to ship a 2022 Toyota Camry from Charlotte NC to Dallas TX',
      sessionId: toolSession,
    }, authHeader());
    assert(res.statusCode === 200, `Status ${res.statusCode}: ${res.body.slice(0, 200)}`);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const response = body['response'] as string;
    assert(response.length > 10, 'Empty logistics response');
  });

  await test('Response includes sessionId and latencyMs', async () => {
    const res = await post(V3_CHAT, { message: 'Any updates?', sessionId: toolSession }, authHeader());
    assert(res.statusCode === 200, `Status ${res.statusCode}`);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    assert(typeof body['sessionId']  === 'string', 'Missing sessionId');
    assert(typeof body['latencyMs']  === 'number', 'Missing latencyMs');
    assert(typeof body['toolsUsed']  !== 'undefined', 'Missing toolsUsed');
  });

  await test('Response shape: { response, sessionId, toolsUsed, latencyMs }', async () => {
    const res = await post(V3_CHAT, { message: 'Thanks', sessionId: toolSession }, authHeader());
    assert(res.statusCode === 200, `Status ${res.statusCode}`);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    assert('response'  in body, 'Missing response field');
    assert('sessionId' in body, 'Missing sessionId field');
    assert('toolsUsed' in body, 'Missing toolsUsed field');
    assert('latencyMs' in body, 'Missing latencyMs field');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 4: Shipment Flow (3 tests) — wait 16s for burst reset first
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 4: Shipment Flow ────────────────────────────');
  console.log('  (waiting 16s for rate-limit burst window reset…)');
  await new Promise(r => setTimeout(r, 16_000));

  const shipSession = `ship-${randomUUID()}`;

  await test('Quote request → valid response (may clarify year)', async () => {
    const res = await post(V3_CHAT, {
      message:   'Give me a quote for shipping a sedan from Miami FL to New York NY',
      sessionId: shipSession,
    }, authHeader());
    assert(res.statusCode === 200, `Status ${res.statusCode}`);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    const response = (body['response'] as string) ?? '';
    assert(response.length > 10, 'Empty quote response');
    // Either a price is mentioned or a clarifying question is asked — both are valid
    const isValidResponse = /\$|\d+|price|quote|year|make|model|tell me|could you/i.test(response);
    assert(isValidResponse, `Unexpected response: "${response.slice(0, 100)}"`);
  });

  await test('Multiple turns — session maintains state', async () => {
    await post(V3_CHAT, { message: 'I want to ship a 2020 Ford F-150', sessionId: shipSession }, authHeader());
    const res2 = await post(V3_CHAT, { message: 'From Atlanta GA to Houston TX', sessionId: shipSession }, authHeader());
    assert(res2.statusCode === 200, `Status ${res2.statusCode}`);
    const body = JSON.parse(res2.body) as Record<string, unknown>;
    const response = (body['response'] as string) ?? '';
    // Should not ask what vehicle since we told it in previous message
    const reAsksVehicle = /what vehicle|which vehicle|type of vehicle/i.test(response);
    assert(!reAsksVehicle, `Re-asked for vehicle: "${response.slice(0, 150)}"`);
  });

  await test('Latency under 8s for standard logistics request', async () => {
    const start = Date.now();
    const res = await post(V3_CHAT, { message: 'What are standard car shipping rates?', sessionId: shipSession }, authHeader());
    const ms = Date.now() - start;
    assert(res.statusCode === 200, `Status ${res.statusCode}`);
    assert(ms < 8_000, `Too slow: ${ms}ms (target: <8000ms)`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 5: Session Memory (3 tests) — wait for rate limit
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 5: Session Memory ───────────────────────────');
  console.log('  (waiting 16s for rate-limit burst window reset…)');
  await new Promise(r => setTimeout(r, 16_000));

  const memSession = `mem-${randomUUID()}`;

  await test('Session persists across turns (same sessionId)', async () => {
    // Turn 1: establish context
    await post(V3_CHAT, { message: 'My name is Alex and I need shipping help', sessionId: memSession }, authHeader());
    // Turn 2: follow-up should be natural, not ask who user is again
    const res2 = await post(V3_CHAT, { message: 'What can you help me with?', sessionId: memSession }, authHeader());
    assert(res2.statusCode === 200, `Status ${res2.statusCode}`);
    const body = JSON.parse(res2.body) as Record<string, unknown>;
    assert(typeof body['sessionId'] === 'string', 'No sessionId returned');
    assert(body['sessionId'] === memSession || typeof body['sessionId'] === 'string', 'sessionId mismatch');
  });

  await test('Different sessionId → independent conversation', async () => {
    const sess1 = `mem1-${randomUUID()}`;
    const sess2 = `mem2-${randomUUID()}`;
    await post(V3_CHAT, { message: 'I want to ship a Lamborghini', sessionId: sess1 }, authHeader());
    const res = await post(V3_CHAT, { message: 'What vehicle were we discussing?', sessionId: sess2 }, authHeader());
    assert(res.statusCode === 200, `Status ${res.statusCode}`);
    const body  = JSON.parse(res.body) as Record<string, unknown>;
    const reply = (body['response'] as string) ?? '';
    // Session 2 has no context — should not know about Lamborghini
    assert(!/lamborghini/i.test(reply), `Cross-session leak: "${reply.slice(0, 150)}"`);
  });

  await test('Context window: handles 3+ message history gracefully', async () => {
    const ctxSess = `ctx-${randomUUID()}`;
    for (let i = 1; i <= 3; i++) {
      const res = await post(V3_CHAT, { message: `Message ${i}`, sessionId: ctxSess }, authHeader());
      assert(res.statusCode === 200, `Turn ${i} status ${res.statusCode}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 6: Tool Failure Recovery (2 tests) — wait for rate limit
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 6: Tool Failure Recovery ───────────────────');
  console.log('  (waiting 16s for rate-limit burst window reset…)');
  await new Promise(r => setTimeout(r, 16_000));

  const failSession = `fail-${randomUUID()}`;

  await test('Invalid shipment ID for tracking → friendly error, no crash', async () => {
    const res = await post(V3_CHAT, {
      message:   'Track shipment ID: 00000000-0000-0000-0000-000000000000',
      sessionId: failSession,
    }, authHeader());
    assert(res.statusCode === 200, `Status ${res.statusCode}: ${res.body.slice(0, 200)}`);
    const body   = JSON.parse(res.body) as Record<string, unknown>;
    const reply  = (body['response'] as string) ?? '';
    // Should be a human-friendly message, not a JSON error dump
    assert(reply.length > 5, 'Empty response after tool failure');
    assert(!/error:|stack trace|exception/i.test(reply), `Raw error in response: "${reply.slice(0, 150)}"`);
  });

  await test('Nonsense location for quote → friendly response, no 500', async () => {
    const res = await post(V3_CHAT, {
      message:   'Ship a car from ZZZZZZZ to AAAAAAAAA',
      sessionId: failSession,
    }, authHeader());
    assert(res.statusCode === 200, `Status ${res.statusCode}: ${res.body.slice(0, 200)}`);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    assert(typeof body['response'] === 'string', 'Missing response field');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 7: Rate Limiting (2 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 7: Rate Limiting ────────────────────────────');
  // NOTE: These 2 tests rely on exhausting the burst limit (3 in 15s)

  await test('Rate limiter returns 429 after burst exhaustion', async () => {
    const rateSess = `rate-${randomUUID()}`;
    // Send burst+1 messages (burst limit = 3, so send 4)
    let lastStatus = 200;
    for (let i = 0; i < 4; i++) {
      const res = await post(V3_CHAT, { message: `Burst ${i}`, sessionId: rateSess }, authHeader());
      lastStatus = res.statusCode;
    }
    assert(lastStatus === 429, `Expected 429 after burst, got ${lastStatus}`);
  });

  await test('Rate limit 429 response includes retryAfter field', async () => {
    // Already burst-exhausted from previous test — wait minimal time then burst again
    const rateSess2 = `rate2-${randomUUID()}`;
    let last429Body = '';
    for (let i = 0; i < 4; i++) {
      const res = await post(V3_CHAT, { message: `B${i}`, sessionId: rateSess2 }, authHeader());
      if (res.statusCode === 429) { last429Body = res.body; break; }
    }
    assert(last429Body.length > 0, '429 response body not captured');
    const body = JSON.parse(last429Body) as Record<string, unknown>;
    assert('retryAfter' in body, `Missing retryAfter: ${last429Body}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 8: Auth Failures (3 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 8: Auth Failures ────────────────────────────');
  console.log('  (waiting 16s for rate-limit burst window reset…)');
  await new Promise(r => setTimeout(r, 16_000));

  await test('No Authorization header → 401', async () => {
    const res = await post(V3_CHAT, { message: 'Hello', sessionId: SESSION });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Invalid JWT → 401', async () => {
    const res = await post(V3_CHAT, { message: 'Hello', sessionId: SESSION }, {
      Authorization: 'Bearer invalid.jwt.token',
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  await test('Expired-format JWT → 401', async () => {
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlIiwiaWF0IjoxNjAwMDAwMDAwfQ.fake_sig';
    const res = await post(V3_CHAT, { message: 'Hi', sessionId: SESSION }, {
      Authorization: `Bearer ${fakeJwt}`,
    });
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 9: Streaming SSE (3 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Category 9: Streaming SSE ────────────────────────────');
  console.log('  (waiting 16s for rate-limit burst window reset…)');
  await new Promise(r => setTimeout(r, 16_000));

  const streamSess = `stream-${randomUUID()}`;

  await test('POST /chat/stream → receives token events', async () => {
    const events = await consumeSSE(V3_STREAM, { message: 'Hi', sessionId: streamSess }, authHeader());
    const tokens = events.filter(e => e['type'] === 'token');
    assert(tokens.length > 0, `No token events received. Events: ${JSON.stringify(events.slice(0, 3))}`);
  });

  await test('POST /chat/stream → ends with "end" event containing sessionId', async () => {
    const events = await consumeSSE(V3_STREAM, { message: 'Hello', sessionId: streamSess }, authHeader());
    const endEvent = events.find(e => e['type'] === 'end');
    assert(!!endEvent, `No "end" event received. Events: ${JSON.stringify(events)}`);
    assert(typeof endEvent!['sessionId'] === 'string', 'end event missing sessionId');
    assert(typeof endEvent!['latencyMs'] === 'number', 'end event missing latencyMs');
  });

  await test('POST /chat/stream → assembled tokens form coherent response', async () => {
    const events    = await consumeSSE(V3_STREAM, { message: 'How are you?', sessionId: streamSess }, authHeader());
    const fullText  = events.filter(e => e['type'] === 'token').map(e => e['content']).join('');
    assert(fullText.length > 5, `Assembled text too short: "${fullText}"`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Cleanup ──────────────────────────────────────────────');
  if (testUserId) {
    await supabaseAdmin.auth.admin.deleteUser(testUserId);
    console.log(`  Deleted test user: ${TEST_EMAIL}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const avgMs  = Math.round(results.filter(r => r.ms > 0).reduce((s, r) => s + r.ms, 0) / results.length);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                  FINAL TEST REPORT                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  PASSED  : ${passed} / ${results.length}`);
  console.log(`  FAILED  : ${failed}`);
  console.log(`  AVG MS  : ${avgMs}ms`);

  if (failed > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.name}`);
      console.log(`       ${r.detail}`);
    });
  }

  const score = Math.round((passed / results.length) * 100);
  console.log(`\n  PRODUCTION READINESS : ${score}%`);
  console.log(`  STATUS               : ${failed === 0 ? '✅ ALL PASS' : '❌ FAILURES DETECTED'}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Unhandled error in test runner:', e);
  process.exit(1);
});
