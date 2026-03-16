/**
 * FMCSA Carolina Carrier Importer
 * ─────────────────────────────────────────────────────────────────
 * Reads the FMCSA CENSUS1 CSV file, filters for NC/SC active carriers,
 * and bulk-enriches them via the backend API (Apollo → Snov → Hunter).
 *
 * HOW TO USE:
 * 1. Download the FMCSA census file:
 *    https://ai.fmcsa.dot.gov/SMS/Tools/Downloads.aspx
 *    → "FMCSA_CENSUS1_YYYYMMDD.zip" → extract the file inside
 * 2. Place the file in this directory (supports both .csv and pipe-delimited .txt)
 * 3. Run:
 *    node scripts/import-fmcsa-carolina.js
 *
 * The script:
 *  - Auto-detects CSV (,) vs pipe-delimited (|) format from the file header
 *  - Filters: PHY_STATE = NC or SC, CARRIER_OPERATION ≠ 'N' (active)
 *  - Sends batches of 25 to POST /carriers/enrich/bulk (async, non-blocking)
 *  - Prints a summary at the end
 *  - Skips carriers already in carrier_contacts (deduped by DOT number)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────

// Auto-detect file — scan this directory AND the repo-root scripts/ folder
// Also accepts a file path as the first command-line argument:
//   node scripts/import-fmcsa-carolina.js "C:\path\to\FMCSA_CENSUS1.csv"
const CENSUS_FILE = (() => {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const searchDirs = [
    __dirname,                                           // backend/scripts/
    path.join(__dirname, '..', '..', 'scripts'),        // repo-root scripts/
    path.join(__dirname, '..'),                          // backend/
  ];
  for (const dir of searchDirs) {
    try {
      const match = fs.readdirSync(dir)
        .find(f => /FMCSA_CENSUS1/i.test(f) && /\.(csv|txt)$/i.test(f));
      if (match) return path.join(dir, match);
    } catch (_) {}
  }
  return path.join(__dirname, 'FMCSA_CENSUS1.csv'); // fallback (will error with a clear message)
})();
const TARGET_STATES = ['NC', 'SC'];
const MIN_POWER_UNITS = 3;      // skip tiny 1-2 truck ops — too small to be in email DBs
const BATCH_SIZE = 25;          // carriers per bulk enrich request
const BATCH_DELAY_MS = 2000;    // ms between batches (respect API rate limits)
const MAX_CARRIERS = 500;       // safety cap per run — increase once quotas confirmed
const API_BASE = `http://localhost:${process.env.PORT || 3001}/api/v1`;
const ADMIN_EMAIL = 'infos@calkons.com';
const ADMIN_PASSWORD = 'TestAdmin2026!';

// ── Keyword filters ───────────────────────────────────────────────────────────
// CENSUS1 has no cargo/commodity column — we use name-based heuristics.
// The goal is vehicle/auto transport companies. We can't perfectly match them
// but we can exclude industries that definitely don't haul cars.

// Companies matching ANY of these words are excluded (case-insensitive)
const EXCLUDE_NAME_PATTERNS = [
  // Food & agriculture
  /\bfood\b/, /\bfarm(s|ing)?\b/, /\bdairy\b/, /\bmeat\b/, /\bpoultry\b/,
  /\bchicken\b/, /\bproduce\b/, /\bgrains?\b/, /\bcattle\b/, /\blivestock\b/,
  /\bhog(s)?\b/, /\bpig(s)?\b/, /\bagricult/,
  // Fuel & chemicals
  /\bpetroleum\b/, /\bpropane\b/, /\bfuel\b/, /\bgas(oline)?\b/, /\boil\b/,
  /\bchemical(s)?\b/, /\bhazmat\b/,
  // Construction & bulk
  /\bconcrete\b/, /\bcement\b/, /\blumber\b/, /\btimber\b/,
  /\bsand\b/, /\bgravel\b/, /\bmining\b/, /\bexcavat/,
  // Medical & passenger
  /\bambulance\b/, /\bmedical\b/, /\bhealthcare\b/,
  /\bbus(es)?\b/, /\bcoach(es)?\b/, /\bschool\b/, /\bchurch\b/, /\bministry\b/,
  /\bcharter\b/, /\btransit\b/, /\bshuttle\b/,
  // Waste & utilities
  /\bwaste\b/, /\bgarbage\b/, /\brefuse\b/, /\bsanitation\b/, /\brecycl/,
  /\belectric\b/, /\butility\b/, /\bpower\b/,
];


// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error || !data?.session?.access_token) throw new Error('Login failed: ' + (error?.message || 'no token'));
  console.log('✅ Authenticated as', ADMIN_EMAIL);
  return data.session.access_token;
}

// ── Parse FMCSA CENSUS1 file ──────────────────────────────────────────────────
// Supports both CSV (,) and pipe-delimited (|) formats — auto-detected from header.
// Column positions (same for both formats):
// 0=DOT_NUMBER  1=LEGAL_NAME  2=DBA_NAME  3=CARRIER_OPERATION
// 6=PHY_STREET  7=PHY_CITY  8=PHY_STATE  9=PHY_ZIP
// 16=TELEPHONE  24=NBR_POWER_UNIT  25=DRIVER_TOTAL

/**
 * Parse a single CSV line respecting RFC-4180 quoting.
 * Returns array of field values with surrounding quotes stripped.
 */
function parseCsvLine(line, delimiter) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // peek ahead — two double-quotes = escaped quote inside field
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  fields.push(cur.trim());
  return fields;
}

async function parseCensus(filePath) {
  return new Promise((resolve, reject) => {
    const carriers = [];
    let stream;
    try {
      stream = fs.createReadStream(filePath);
    } catch (openErr) {
      reject(new Error(`Cannot open census file: ${filePath}\n${openErr.message}`));
      return;
    }
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let lineNum = 0;
    let delimiter = '|'; // default — will be overridden by header detection
    let colIdx = null;   // header name → column index map

    stream.on('error', reject);

    rl.on('line', (line) => {
      lineNum++;
      if (lineNum === 1) {
        // Auto-detect delimiter from header
        const commaCount = (line.match(/,/g) || []).length;
        const pipeCount  = (line.match(/\|/g) || []).length;
        delimiter = commaCount > pipeCount ? ',' : '|';
        console.log(`   Delimiter detected: "${delimiter === ',' ? 'comma (CSV)' : 'pipe (TXT)'}"`);
        // Build header → index map (lowercase, trim)
        const headers = parseCsvLine(line, delimiter).map(h => h.toLowerCase().trim());
        colIdx = {};
        headers.forEach((h, i) => { colIdx[h] = i; });
        return;
      }

      const cols = parseCsvLine(line, delimiter);
      const get = (name) => (cols[colIdx[name]] || '').trim();

      const dotNumber       = get('dot_number');
      const legalName       = get('legal_name');
      const dbaName         = get('dba_name');
      const operation       = get('carrier_operation');
      const phyState        = get('phy_state');
      const phyCity         = get('phy_city');
      const phyStreet       = get('phy_street');
      const phyZip          = get('phy_zip');
      const telephone       = get('telephone');
      const powerUnits      = parseInt(get('nbr_power_unit') || '0', 10) || 0;
      const drivers         = parseInt(get('driver_total') || '0', 10) || 0;
      const authorizedHire  = get('authorized_for_hire');   // 'true'/'false'
      const privateOnly     = get('private_only');          // 'true'/'false'
      const stateGov        = get('state_government');
      const fedGov          = get('federal_government');
      const localGov        = get('local_government');
      const usMail          = get('us_mail');

      const pcFlag         = get('pc_flag');               // Y = passenger carrier (bus)

      // ── Filters ────────────────────────────────────────────────────────────
      if (!TARGET_STATES.includes(phyState)) return;
      if (operation === 'N') return;                    // not authorized to operate
      if (authorizedHire === 'false') return;           // private fleet
      if (privateOnly === 'true') return;               // same reason
      if (stateGov === 'true' || fedGov === 'true') return; // government fleets
      if (localGov === 'true' || usMail === 'true') return; // city/postal trucks
      if (pcFlag === 'Y') return;                       // bus / passenger carrier
      if (powerUnits < MIN_POWER_UNITS) return;         // too small — not in email DBs
      if (!dotNumber || !legalName) return;

      // Name-based exclusion — skip non-auto industries
      const nameUpper = (dbaName || legalName).toLowerCase();
      if (EXCLUDE_NAME_PATTERNS.some(re => re.test(nameUpper))) return;

      carriers.push({
        dotNumber,
        companyName: dbaName || legalName,
        address: phyStreet,
        city: phyCity,
        state: phyState,
        zip: phyZip,
        phone: telephone || undefined,
        powerUnits: powerUnits || undefined,
        drivers: drivers || undefined,
        operatingStatus: 'AUTHORIZED',
      });
    });

    rl.on('close', () => resolve(carriers));
  });
}

// ── Already-enriched DOT numbers ─────────────────────────────────────────────

async function getExistingDotNumbers() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await sb.from('carrier_contacts').select('dot_number');
  return new Set((data || []).map((r) => r.dot_number));
}

// ── Bulk enrich one batch ─────────────────────────────────────────────────────

async function enrichBatch(carriers, token) {
  const res = await fetch(`${API_BASE}/carriers/enrich/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ carriers }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bulk enrich failed (${res.status}): ${JSON.stringify(body)}`);
  return body;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log(' FMCSA Carolina Carrier Importer');
  console.log(`  Source file   : ${path.basename(CENSUS_FILE)}`);
  console.log(`  Target states : ${TARGET_STATES.join(', ')}`);
  console.log(`  Min power units: ${MIN_POWER_UNITS}`);
  console.log(`  Batch size    : ${BATCH_SIZE}`);
  console.log(`  Max carriers  : ${MAX_CARRIERS}`);
  console.log('═══════════════════════════════════════════════════\n');

  // 1 — Auth
  const token = await getToken();

  // 2 — Parse census file
  console.log('📂 Parsing FMCSA census file…');
  const all = await parseCensus(CENSUS_FILE);
  console.log(`   Found ${all.length} active carriers in ${TARGET_STATES.join('/')}`);

  // 3 — Deduplicate against existing DB records
  console.log('🔍 Checking existing carrier_contacts…');
  const existing = await getExistingDotNumbers();
  const fresh = all.filter((c) => !existing.has(c.dotNumber));
  console.log(`   ${existing.size} already in DB → ${fresh.length} new to enrich`);

  // 4 — Apply cap for first run
  const toProcess = fresh.slice(0, MAX_CARRIERS);
  console.log(`   Processing first ${toProcess.length} (cap = ${MAX_CARRIERS})\n`);

  if (toProcess.length === 0) {
    console.log('ℹ️  Nothing new to enrich. Done.');
    return;
  }

  // 5 — Enrich in batches
  const batches = Math.ceil(toProcess.length / BATCH_SIZE);
  let sent = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`  Batch ${batchNum}/${batches} (${batch.length} carriers)… `);

    try {
      const result = await enrichBatch(batch, token);
      const queued = result?.data?.queued ?? batch.length;
      process.stdout.write(`queued ${queued} ✅\n`);
      sent += queued;
    } catch (err) {
      process.stdout.write(`ERROR: ${err.message} ❌\n`);
    }

    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(` Import complete: ${sent} carriers queued for enrichment`);
  console.log(` Check carrier_contacts table — enrichment runs async in background`);
  console.log(` Next: POST /api/v1/campaigns/:id/start to begin outreach`);
  console.log('═══════════════════════════════════════════════════\n');
})();
