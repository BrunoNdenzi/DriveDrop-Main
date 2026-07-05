/**
 * Benji V3 — Distance utilities
 *
 * Provides a haversine-based distance estimator as a fallback when
 * Google Maps is unavailable (API quota, key issue, or network error).
 *
 * Coverage: ~120 major US cities + all 50 state centroids + DC.
 * Accuracy: ±10–15% vs actual road distance (acceptable for quote estimates).
 */

// ─── Haversine core ───────────────────────────────────────────────────────────

const TO_RAD = Math.PI / 180;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * TO_RAD;
  const dLon = (lon2 - lon1) * TO_RAD;
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── City coordinate database ─────────────────────────────────────────────────
// Key format: "city state_abbr" (lowercase, no comma)

const CITY_COORDS: Record<string, readonly [number, number]> = {
  // Top metros
  'new york ny':           [40.7128,  -74.0060],
  'new york city ny':      [40.7128,  -74.0060],
  'nyc ny':                [40.7128,  -74.0060],
  'los angeles ca':        [34.0522, -118.2437],
  'la ca':                 [34.0522, -118.2437],
  'chicago il':            [41.8781,  -87.6298],
  'houston tx':            [29.7604,  -95.3698],
  'phoenix az':            [33.4484, -112.0740],
  'philadelphia pa':       [39.9526,  -75.1652],
  'san antonio tx':        [29.4241,  -98.4936],
  'san diego ca':          [32.7157, -117.1611],
  'dallas tx':             [32.7767,  -96.7970],
  'san jose ca':           [37.3382, -121.8863],
  'austin tx':             [30.2672,  -97.7431],
  'jacksonville fl':       [30.3322,  -81.6557],
  'fort worth tx':         [32.7555,  -97.3308],
  'columbus oh':           [39.9612,  -82.9988],
  'charlotte nc':          [35.2271,  -80.8431],
  'indianapolis in':       [39.7684,  -86.1581],
  'san francisco ca':      [37.7749, -122.4194],
  'sf ca':                 [37.7749, -122.4194],
  'seattle wa':            [47.6062, -122.3321],
  'denver co':             [39.7392, -104.9903],
  'washington dc':         [38.9072,  -77.0369],
  'dc dc':                 [38.9072,  -77.0369],
  'nashville tn':          [36.1627,  -86.7816],
  'oklahoma city ok':      [35.4676,  -97.5164],
  'el paso tx':            [31.7619, -106.4850],
  'boston ma':             [42.3601,  -71.0589],
  'portland or':           [45.5051, -122.6750],
  'las vegas nv':          [36.1699, -115.1398],
  'memphis tn':            [35.1495,  -90.0490],
  'louisville ky':         [38.2527,  -85.7585],
  'baltimore md':          [39.2904,  -76.6122],
  'milwaukee wi':          [43.0389,  -87.9065],
  'albuquerque nm':        [35.0844, -106.6504],
  'tucson az':             [32.2226, -110.9747],
  'fresno ca':             [36.7378, -119.7871],
  'sacramento ca':         [38.5816, -121.4944],
  'kansas city mo':        [39.0997,  -94.5786],
  'atlanta ga':            [33.7490,  -84.3880],
  'omaha ne':              [41.2565,  -95.9345],
  'colorado springs co':   [38.8339, -104.8214],
  'raleigh nc':            [35.7796,  -78.6382],
  'minneapolis mn':        [44.9778,  -93.2650],
  'tampa fl':              [27.9506,  -82.4572],
  'new orleans la':        [29.9511,  -90.0715],
  'cleveland oh':          [41.4993,  -81.6944],
  'miami fl':              [25.7617,  -80.1918],
  'st. louis mo':          [38.6270,  -90.1994],
  'st louis mo':           [38.6270,  -90.1994],
  'salt lake city ut':     [40.7608, -111.8910],
  'richmond va':           [37.5407,  -77.4360],
  'boise id':              [43.6150, -116.2023],
  'des moines ia':         [41.5868,  -93.6250],
  'birmingham al':         [33.5207,  -86.8025],
  'buffalo ny':            [42.8864,  -78.8784],
  'fort lauderdale fl':    [26.1224,  -80.1373],
  'orlando fl':            [28.5383,  -81.3792],
  'knoxville tn':          [35.9606,  -83.9207],
  'grand rapids mi':       [42.9634,  -85.6681],
  'tallahassee fl':        [30.4518,  -84.2807],
  'columbia sc':           [34.0007,  -81.0348],
  'charleston sc':         [32.7765,  -79.9311],
  'savannah ga':           [32.0835,  -81.0998],
  'newark nj':             [40.7357,  -74.1724],
  'reno nv':               [39.5296, -119.7527],
  'durham nc':             [35.9940,  -78.8986],
  'greensboro nc':         [36.0726,  -79.7920],
  'plano tx':              [33.0198,  -96.6989],
  'corpus christi tx':     [27.8006,  -97.3964],
  'lubbock tx':            [33.5779, -101.8552],
  'garland tx':            [32.9126,  -96.6389],
  'laredo tx':             [27.5064,  -99.5075],
  'tacoma wa':             [47.2529, -122.4443],
  'detroit mi':            [42.3314,  -83.0458],
  'virginia beach va':     [36.8529,  -75.9780],
  'norfolk va':            [36.8468,  -76.2852],
  'chesapeake va':         [36.7682,  -76.2875],
  'pittsburgh pa':         [40.4406,  -79.9959],
  'st. paul mn':           [44.9537,  -93.0900],
  'st paul mn':            [44.9537,  -93.0900],
  'toledo oh':             [41.6639,  -83.5552],
  'akron oh':              [41.0814,  -81.5190],
  'dayton oh':             [39.7589,  -84.1916],
  'wichita ks':            [37.6872,  -97.3301],
  'little rock ar':        [34.7465,  -92.2896],
  'baton rouge la':        [30.4583,  -91.1403],
  'shreveport la':         [32.5252,  -93.7502],
  'jackson ms':            [32.2988,  -90.1848],
  'chattanooga tn':        [35.0456,  -85.3097],
  'lexington ky':          [38.0406,  -84.5037],
  'madison wi':            [43.0731,  -89.4012],
  'aurora co':             [39.7294, -104.8319],
  'springfield mo':        [37.2090,  -93.2923],
  'fayetteville nc':       [35.0527,  -78.8784],
  'huntsville al':         [34.7304,  -86.5861],
  'montgomery al':         [32.3617,  -86.2792],
  'mobile al':             [30.6954,  -88.0399],
  'sioux falls sd':        [43.5446,  -96.7311],
  'spokane wa':            [47.6588, -117.4260],
  'augusta ga':            [33.4735,  -82.0105],
  'macon ga':              [32.8407,  -83.6324],
  'anchorage ak':          [61.2181, -149.9003],
  'honolulu hi':           [21.3069, -157.8583],
  'long beach ca':         [33.7701, -118.1937],
  'anaheim ca':            [33.8366, -117.9143],
  'irvine ca':             [33.6846, -117.8265],
  'riverside ca':          [33.9806, -117.3755],
  'stockton ca':           [37.9577, -121.2908],
  'bakersfield ca':        [35.3733, -119.0187],
  'modesto ca':            [37.6391, -120.9969],
  'henderson nv':          [36.0397, -114.9817],
  'north las vegas nv':    [36.1989, -115.1175],
  'scottsdale az':         [33.4942, -111.9261],
  'tempe az':              [33.4255, -111.9400],
  'chandler az':           [33.3062, -111.8413],
  'mesa az':               [33.4152, -111.8315],
  'gilbert az':            [33.3528, -111.7890],
  'glendale az':           [33.5387, -112.1860],
  'surprise az':           [33.6292, -112.3679],
  'flagstaff az':          [35.1983, -111.6513],
  'eugene or':             [44.0521, -123.0868],
  'provo ut':              [40.2338, -111.6585],
  'fort collins co':       [40.5853, -105.0844],
  'pueblo co':             [38.2544, -104.6091],
  'frisco tx':             [33.1507,  -96.8236],
  'mckinney tx':           [33.1972,  -96.6397],
  'mesquite tx':           [32.7668,  -96.5992],
  'denton tx':             [33.2148,  -97.1331],
  'amarillo tx':           [35.2219, -101.8313],
  'waco tx':               [31.5493,  -97.1467],
  'midland tx':            [31.9973, -102.0779],
  'odessa tx':             [31.8457, -102.3676],
  'beaumont tx':           [30.0802,  -94.1266],
  'tyler tx':              [32.3513,  -95.3011],
  'killeen tx':            [31.1171,  -97.7278],
  'mcallen tx':            [26.2034,  -98.2300],
  'pasadena tx':           [29.6911,  -95.2091],
  'springfield il':        [39.7817,  -89.6501],
  'peoria il':             [40.6936,  -89.5890],
  'rockford il':           [42.2711,  -89.0940],
  'fort wayne in':         [41.1289,  -85.1286],
  'evansville in':         [37.9716,  -87.5711],
  'south bend in':         [41.6764,  -86.2520],
  'overland park ks':      [38.9822,  -94.6708],
  'topeka ks':             [39.0558,  -95.6890],
  'lincoln ne':            [40.8136,  -96.7026],
  'fargo nd':              [46.8772,  -96.7898],
  'bismarck nd':           [46.8083, -100.7837],
  'billings mt':           [45.7833, -108.5007],
  'bozeman mt':            [45.6770, -111.0429],
  'missoula mt':           [46.8721, -113.9940],
  'cheyenne wy':           [41.1400, -104.8202],
  'casper wy':             [42.8666, -106.3131],
  'rapid city sd':         [44.0805, -103.2310],
  'green bay wi':          [44.5133,  -88.0133],
  'ann arbor mi':          [42.2808,  -83.7430],
  'lansing mi':            [42.7325,  -84.5555],
  'flint mi':              [43.0125,  -83.6875],
  'warren mi':             [42.4775,  -83.0277],
  'sterling heights mi':   [42.5803,  -83.0302],
  'bowling green ky':      [36.9903,  -86.4436],
  'tuscaloosa al':         [33.2098,  -87.5692],
  'gulfport ms':           [30.3674,  -89.0928],
  'biloxi ms':             [30.3960,  -88.8853],
  'columbus ga':           [32.4610,  -84.9877],
  'athens ga':             [33.9519,  -83.3576],
  'greenville sc':         [34.8526,  -82.3940],
  'spartanburg sc':        [34.9496,  -81.9321],
  'charleston wv':         [38.3498,  -81.6326],
  'huntington wv':         [38.4193,  -82.4452],
  'asheville nc':          [35.5951,  -82.5515],
  'wilmington nc':         [34.2257,  -77.9447],
  'roanoke va':            [37.2710,  -79.9414],
  'alexandria va':         [38.8048,  -77.0469],
  'myrtle beach sc':       [33.6891,  -78.8867],
  'naples fl':             [26.1420,  -81.7948],
  'fort myers fl':         [26.6406,  -81.8723],
  'gainesville fl':        [29.6516,  -82.3248],
  'pensacola fl':          [30.4213,  -87.2169],
  'west palm beach fl':    [26.7153,  -80.0534],
  'clearwater fl':         [27.9659,  -82.8001],
  'st. petersburg fl':     [27.7676,  -82.6403],
  'st petersburg fl':      [27.7676,  -82.6403],
  'cape coral fl':         [26.5629,  -81.9495],
  'daytona beach fl':      [29.2108,  -81.0228],
  'panama city fl':        [30.1588,  -85.6602],
  'hartford ct':           [41.7658,  -72.6851],
  'bridgeport ct':         [41.1670,  -73.2048],
  'new haven ct':          [41.3082,  -72.9282],
  'stamford ct':           [41.0534,  -73.5387],
  'worcester ma':          [42.2626,  -71.8023],
  'springfield ma':        [42.1015,  -72.5898],
  'albany ny':             [42.6526,  -73.7562],
  'syracuse ny':           [43.0481,  -76.1474],
  'rochester ny':          [43.1566,  -77.6088],
  'yonkers ny':            [40.9312,  -73.8988],
  'providence ri':         [41.8240,  -71.4128],
  'jersey city nj':        [40.7178,  -74.0431],
  'manchester nh':         [42.9956,  -71.4548],
  'portland me':           [43.6591,  -70.2568],
  'burlington vt':         [44.4759,  -73.2121],
  'dover de':              [39.1582,  -75.5244],
  'annapolis md':          [38.9784,  -76.4922],
};

// ─── State centroids — fallback when city not found ───────────────────────────

const STATE_CENTROIDS: Record<string, readonly [number, number]> = {
  AL: [32.81,  -86.79], AK: [61.37, -152.40], AZ: [33.73, -111.43],
  AR: [34.97,  -92.37], CA: [36.12, -119.68], CO: [39.06, -105.31],
  CT: [41.60,  -72.76], DE: [39.32,  -75.51], FL: [27.77,  -81.69],
  GA: [33.04,  -83.64], HI: [21.09, -157.50], ID: [44.24, -114.48],
  IL: [40.35,  -88.99], IN: [39.85,  -86.26], IA: [42.01,  -93.21],
  KS: [38.53,  -96.73], KY: [37.67,  -84.67], LA: [31.17,  -91.87],
  ME: [44.69,  -69.38], MD: [39.06,  -76.80], MA: [42.23,  -71.53],
  MI: [43.33,  -84.54], MN: [45.69,  -93.90], MS: [32.74,  -89.68],
  MO: [38.46,  -92.29], MT: [46.92, -110.45], NE: [41.13,  -98.27],
  NV: [38.31, -117.06], NH: [43.45,  -71.56], NJ: [40.30,  -74.52],
  NM: [34.84, -106.25], NY: [42.17,  -74.95], NC: [35.63,  -79.81],
  ND: [47.53,  -99.78], OH: [40.39,  -82.76], OK: [35.57,  -96.93],
  OR: [44.57, -122.07], PA: [40.59,  -77.21], RI: [41.68,  -71.51],
  SC: [33.86,  -80.95], SD: [44.30,  -99.44], TN: [35.75,  -86.69],
  TX: [31.05,  -97.56], UT: [40.15, -111.86], VT: [44.05,  -72.71],
  VA: [37.77,  -78.17], WA: [47.40, -121.49], WV: [38.49,  -80.95],
  WI: [44.27,  -89.62], WY: [42.76, -107.30], DC: [38.90,  -77.03],
};

// ─── Coordinate resolver ──────────────────────────────────────────────────────

/**
 * Resolve a US location string to [lat, lng].
 * Tries: exact city match → city+state match → state centroid.
 */
function resolveCoords(location: string): readonly [number, number] | null {
  // Normalize: lowercase, collapse whitespace, strip commas
  const norm = location.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Direct match (e.g. "charlotte nc", "los angeles ca")
  if (CITY_COORDS[norm]) return CITY_COORDS[norm]!;

  // 2. Try stripping trailing state abbr and re-matching with just state centroid
  //    e.g. "some city TX" → extract "TX" → use TX centroid
  const trailingState = norm.match(/\b([a-z]{2})\s*$/);
  if (trailingState) {
    const abbr = trailingState[1]!.toUpperCase();
    // Try city + state key first
    const cityWithState = `${norm} ${abbr.toLowerCase()}`;
    if (CITY_COORDS[norm]) return CITY_COORDS[norm]!;         // exact match already tried
    if (CITY_COORDS[cityWithState]) return CITY_COORDS[cityWithState]!;
    // State centroid fallback
    if (STATE_CENTROIDS[abbr]) return STATE_CENTROIDS[abbr]!;
  }

  // 3. Full state name fallback (e.g. "Texas", "California")
  const STATE_NAMES: Record<string, string> = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
    hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
    kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA',
    michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
    nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
    ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
    'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX',
    utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
    wisconsin: 'WI', wyoming: 'WY',
  };
  for (const [stateName, abbr] of Object.entries(STATE_NAMES)) {
    if (norm.includes(stateName) && STATE_CENTROIDS[abbr]) return STATE_CENTROIDS[abbr]!;
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Estimate driving distance between two US location strings.
 *
 * Uses haversine straight-line distance × 1.30 road factor.
 * Returns miles, or null if either location cannot be resolved.
 * Accuracy: ±10–15% for most US inter-city routes.
 */
export function estimateDistanceMiles(origin: string, destination: string): number | null {
  const c1 = resolveCoords(origin);
  const c2 = resolveCoords(destination);
  if (!c1 || !c2) return null;

  const straightKm    = haversineKm(c1[0], c1[1], c2[0], c2[1]);
  const roadFactor    = 1.30;  // typical US road-to-straight-line ratio
  const distanceMiles = (straightKm * roadFactor) / 1.60934;
  return Math.round(distanceMiles);
}
