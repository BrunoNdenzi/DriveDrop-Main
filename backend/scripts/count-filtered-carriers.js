/**
 * Dry-run filter counter — no API calls, no DB writes.
 * Just counts how many carriers survive each filter stage.
 *
 *   node scripts/count-filtered-carriers.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── Auto-locate the census file ───────────────────────────────────────────────
const CENSUS_FILE = (() => {
  const searchDirs = [
    path.join(__dirname, '..', '..', 'scripts'),
    __dirname,
    path.join(__dirname, '..'),
  ];
  for (const dir of searchDirs) {
    try {
      const match = fs.readdirSync(dir)
        .find(f => /FMCSA_CENSUS1/i.test(f) && /\.(csv|txt)$/i.test(f));
      if (match) return path.join(dir, match);
    } catch (_) {}
  }
  throw new Error('FMCSA_CENSUS1.csv not found. Place it in scripts/');
})();

const TARGET_STATES = ['NC', 'SC'];
const MIN_POWER_UNITS = 3;

const EXCLUDE_PATTERNS = [
  // Food & agriculture
  /\bfood\b/, /\bfarms?\b/, /\bfarming\b/, /\bdairy\b/, /\bmeat\b/, /\bpoultry\b/,
  /\bchicken\b/, /\bproduce\b/, /\bgrains?\b/, /\bcattle\b/, /\blivestock\b/,
  /\bhogs?\b/, /\bpigs?\b/, /\bagricult/,
  // Fuel & chemicals
  /\bpetroleum\b/, /\bpropane\b/, /\bfuel\b/, /\bgasoline\b/, /\bchemicals?\b/,
  // Construction & bulk
  /\bconcrete\b/, /\bcement\b/, /\blumber\b/, /\btimber\b/,
  /\bsand\b/, /\bgravel\b/, /\bmining\b/, /\bexcavat/,
  // Medical & passenger
  /\bambulance\b/, /\bmedical\b/, /\bhealthcare\b/,
  /\bbuses?\b/, /\bcoaches?\b/, /\bschool\b/, /\bchurch\b/, /\bministry\b/,
  /\bcharter\b/, /\btransit\b/, /\bshuttle\b/,
  // Waste & utilities
  /\bwaste\b/, /\bgarbage\b/, /\brefuse\b/, /\bsanitation\b/, /\brecycl/,
];

function parseLine(line, delim) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      fields.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

let lineNum = 0;
let colIdx = {};
const counts = {
  total_file: 0,
  wrong_state: 0,
  not_authorized: 0,
  private_fleet: 0,
  government: 0,
  bus_passenger: 0,
  too_small: 0,
  excluded_name: 0,
  kept: 0,
};

const rl = readline.createInterface({ input: fs.createReadStream(CENSUS_FILE), crlfDelay: Infinity });

rl.on('line', (line) => {
  lineNum++;
  if (lineNum === 1) {
    const headers = parseLine(line, ',').map(h => h.toLowerCase().trim());
    headers.forEach((h, i) => { colIdx[h] = i; });
    console.log(`  File: ${path.basename(CENSUS_FILE)}`);
    console.log(`  Columns detected: ${headers.length}\n`);
    return;
  }

  const cols = parseLine(line, ',');
  const get = (name) => (cols[colIdx[name]] || '').trim();

  counts.total_file++;

  const state = get('phy_state');
  if (!TARGET_STATES.includes(state)) { counts.wrong_state++; return; }

  if (get('carrier_operation') === 'N') { counts.not_authorized++; return; }

  if (get('authorized_for_hire') === 'false' || get('private_only') === 'true') {
    counts.private_fleet++; return;
  }

  if (
    get('state_government') === 'true' ||
    get('federal_government') === 'true' ||
    get('local_government') === 'true' ||
    get('us_mail') === 'true'
  ) { counts.government++; return; }

  if (get('pc_flag') === 'Y') { counts.bus_passenger++; return; }

  const pu = parseInt(get('nbr_power_unit') || '0', 10) || 0;
  if (pu < MIN_POWER_UNITS) { counts.too_small++; return; }

  const name = (get('dba_name') || get('legal_name')).toLowerCase();
  if (EXCLUDE_PATTERNS.some(re => re.test(name))) { counts.excluded_name++; return; }

  counts.kept++;
});

rl.on('close', () => {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Filter breakdown (NC + SC):');
  console.log('═══════════════════════════════════════════════════');
  console.log(` Total rows in file       : ${counts.total_file.toLocaleString()}`);
  console.log(` ✗ Wrong state (not NC/SC) : ${counts.wrong_state.toLocaleString()}`);
  console.log(` ✗ Not authorized to operate: ${counts.not_authorized.toLocaleString()}`);
  console.log(` ✗ Private fleet only      : ${counts.private_fleet.toLocaleString()}`);
  console.log(` ✗ Gov / postal            : ${counts.government.toLocaleString()}`);
  console.log(` ✗ Bus / passenger carrier : ${counts.bus_passenger.toLocaleString()}`);
  console.log(` ✗ < ${MIN_POWER_UNITS} power units (too small): ${counts.too_small.toLocaleString()}`);
  console.log(` ✗ Excluded by name        : ${counts.excluded_name.toLocaleString()}`);
  console.log('───────────────────────────────────────────────────');
  console.log(` ✅ KEPT (ready to enrich) : ${counts.kept.toLocaleString()}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('\n These are trucking-for-hire companies with 3+ trucks,');
  console.log(' not buses, not private fleets, not food/fuel/construction.');
  console.log(` First run cap (MAX_CARRIERS=500): will queue 500 of ${Math.min(counts.kept, 500)}.`);
});
