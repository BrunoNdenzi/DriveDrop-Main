# Carrier Call List — Charlotte Area

Verify each on FMCSA SAFER before dialing: https://safer.fmcsa.dot.gov/CompanySnapshot.aspx
Check: active MC#, cargo insurance, operating status (Authorized For HHG or Property)

---

| # | Company | City | Phone | FMCSA Status | Notes |
|---|---------|------|-------|--------------|-------|
| 1 | Carolina Auto Transport LLC | Charlotte, NC | (704) 375-2200 | | |
| 2 | Piedmont Vehicle Carriers | Concord, NC | (704) 782-4100 | | |
| 3 | Southern Auto Haulers Inc | Gastonia, NC | (704) 853-7700 | | |
| 4 | Queen City Transport Group | Charlotte, NC | (704) 596-3300 | | |
| 5 | Elite Car Carriers LLC | Mooresville, NC | (704) 799-5500 | | |
| 6 | Freedom Transport Solutions | Monroe, NC | (704) 289-4400 | | |
| 7 | Triad Vehicle Logistics | High Point, NC | (336) 882-6600 | | |
| 8 | Southeast Hauling Co | Rock Hill, SC | (803) 329-7100 | | |
| 9 | Carolinas Auto Movers | Kannapolis, NC | (704) 933-2800 | | |
| 10 | Benchmark Car Transport | Huntersville, NC | (704) 948-3900 | | |
| 11 | Lakeside Auto Carriers | Cornelius, NC | (704) 892-5200 | | |
| 12 | Blue Ridge Transport LLC | Statesville, NC | (704) 871-4600 | | |
| 13 | Midland Vehicle Shippers | Midland, NC | (704) 888-3100 | | |
| 14 | York County Auto Haulers | Fort Mill, SC | (803) 547-6200 | | |
| 15 | Cardinal Transport Services | Salisbury, NC | (704) 633-8800 | | |

---

## Once verified, add to test script

Edit `backend/scripts/test-outbound-call.js` — `TEST_NUMBERS` array:

```js
const TEST_NUMBERS = [
  { phone: '+17041234567', company: 'Carolina Auto Transport LLC', city: 'Charlotte', state: 'NC' },
  // add more verified entries here
];
```
