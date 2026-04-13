# Carrier Outreach Report — April 8, 2026

**Prepared by:** Alex (AI Recruiter) via DriveDrop Voice Platform  
**Campaign:** Charlotte-Area Carrier Recruitment — Round 1

---

## Summary

Launched the first batch of automated outbound carrier recruitment calls today using Alex, DriveDrop's AI voice recruiter. Alex calls FMCSA-registered auto transport carriers, qualifies them in under 2 minutes, captures their email, and immediately sends a personalized follow-up email and SMS with the sign-up link — all without human involvement.

---

## Calls Fired Today

| # | Company | City | Phone | Status |
|---|---------|------|-------|--------|
| 1 | Carolina Auto Transport LLC  | Charlotte, NC    | (704) 375-2200 | ✅ Dialed |
| 2 | Piedmont Vehicle Carriers    | Concord, NC      | (704) 782-4100 | ✅ Dialed |
| 3 | Southern Auto Haulers Inc    | Gastonia, NC     | (704) 853-7700 | ✅ Dialed |
| 4 | Queen City Transport Group   | Charlotte, NC    | (704) 596-3300 | ✅ Dialed |
| 5 | Elite Car Carriers LLC       | Mooresville, NC  | (704) 799-5500 | ✅ Dialed |
| 6 | Freedom Transport Solutions  | Monroe, NC       | (704) 289-4400 | ✅ Dialed |
| 7 | Triad Vehicle Logistics      | High Point, NC   | (336) 882-6600 | ⏳ Round 2 |
| 8 | Southeast Hauling Co         | Rock Hill, SC    | (803) 329-7100 | ⏳ Round 2 |
| 9 | Carolinas Auto Movers        | Kannapolis, NC   | (704) 933-2800 | ⏳ Round 2 |
| 10 | Benchmark Car Transport     | Huntersville, NC | (704) 948-3900 | ⏳ Round 2 |
| 11 | Lakeside Auto Carriers       | Cornelius, NC    | (704) 892-5200 | ⏳ Round 2 |
| 12 | Blue Ridge Transport LLC     | Statesville, NC  | (704) 871-4600 | ⏳ Round 2 |
| 13 | Midland Vehicle Shippers     | Midland, NC      | (704) 888-3100 | ⏳ Round 2 |
| 14 | York County Auto Haulers     | Fort Mill, SC    | (803) 547-6200 | ⏳ Round 2 |
| 15 | Cardinal Transport Services  | Salisbury, NC    | (704) 633-8800 | ⏳ Round 2 |

**Round 1: 6 calls initiated | Round 2: 9 calls queued (fires tomorrow)**

---

## What Happens On Each Call

1. Alex opens with a direct question — "Do you guys run auto transport at all?"
2. If yes → drops the DriveDrop value pitch (no broker, guaranteed payment, 90-day free period)
3. Asks one qualifying question (lanes, fleet size, or transport type)
4. Asks for their email, reads it back letter by letter, waits for verbal confirmation
5. Saves lead to database, fires SMS with sign-up link, fires personalized welcome email
6. Logs call outcome and hangs up cleanly

Total call time target: under 2 minutes per carrier.

---

## What Fires Automatically When a Carrier Says Yes

**SMS (immediate):**
> "Hey! Here's the DriveDrop carrier info we talked about — sign up free (90 days no fee): drivedrop.us.com/drivers/register?utm_source=voice"

**Email (immediate):**
- Subject: *"Here's the DriveDrop carrier info we talked about"*
- Personalized with their name, company, and the lanes/fleet details Alex collected
- Covers: full shipper rate, guaranteed payment, 90-day free period, free TMS + route optimizer
- Direct sign-up CTA button

---

## Data Being Logged

| Table | What's Captured |
|-------|----------------|
| `carrier_leads` | Phone, email, company, contact name, fleet size, lanes, interest level |
| `carrier_call_logs` | Outcome (interested / not interested / voicemail / callback), notes, callback date |
| `voice_call_logs` | Full call transcript, duration, cost, recording URL |

---

## Next Steps

- **Tomorrow:** Round 2 — remaining 9 carriers auto-queued, fires with one command
- **This week:** Check Supabase `carrier_leads` for emails captured; follow up manually with any carriers who asked for a callback
- **Scale:** Import Twilio number into Vapi to remove the 6-call daily limit — then we can run 50–100 calls/day with no restrictions

---

*All calls originate from (704) 937-5246 | Webhook: drivedrop-main-production.up.railway.app*
