/**
 * Parse carriers CSV and extract 50 fresh carriers with own-domain emails.
 * Run: node backend/scripts/parse-carriers-csv.js
 */
const fs = require('fs');
const path = require('path');

const CSV_PATH = 'C:/Users/HP/Downloads/carriers.csv';

function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/\r/, ''));
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = [];
    let cur = '', inQ = false;
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '"') { inQ = !inQ; }
      else if (line[c] === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += line[c];
    }
    cols.push(cur.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').replace(/"/g, '').trim(); });
    rows.push(row);
  }
  return rows;
}

const alreadySent = new Set([
  'corry@sterlingautocarriers.com',
  'info@usa-autotransport.com',
  'jason@onlineautoconnection.com',
  'mike.scenna@preownedautologistics.com',
  'info@eagleautotransport.com',
  'wmcanally@millertransgroup.com',
  'tom@cargoautotransport.com',
  'support@superautotransport.com',
  'dispatch@luxuryautocarriers.com',
  'dispatch@aplusautotransport.com',
]);

// Third-party aggregator / free mail / competitor domains only — keep company-specific ones
const badDomains = new Set([
  'carshipio.com', 'safer.fmcsa.dot.gov',
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'comcast.net', 'att.net',
  'verizon.net', 'msn.com', 'live.com', 'ymail.com', 'sbcglobal.net',
  'earthlink.net', 'cox.net', 'charter.net', 'protonmail.com',
  'carriersource.io', 'transportreviews.com',
  'mapquest.com', 'yelp.com', 'autonation.com', 'loadconnect.io',
  'centraldispatch.com', 'newbizbot.ai', 'reddit.com', 'bubba.ai',
  'sciencedirect.com', 'stmdiecast.com',
]);

const raw = fs.readFileSync(CSV_PATH, 'utf8');
const rows = parseCSV(raw);
console.log('Total CSV rows:', rows.length);

const seen = new Set();
const results = [];

for (const row of rows) {
  if (results.length >= 50) break;
  const emailsField = row.emails || '';
  if (!emailsField) continue;

  const email = emailsField.split(/[;,]/)[0].trim().toLowerCase();
  if (!email || !email.includes('@')) continue;

  const domain = email.split('@')[1];
  if (!domain || badDomains.has(domain)) continue;
  if (alreadySent.has(email) || seen.has(email)) continue;

  seen.add(email);
  results.push({
    companyName: row.legal_name ? row.legal_name.trim() : '',
    city:  row.phy_city  ? row.phy_city.trim()  : '',
    state: row.phy_state ? row.phy_state.trim()  : '',
    email,
  });
}

console.log('Clean carriers found:', results.length);
console.log(JSON.stringify(results, null, 2));
