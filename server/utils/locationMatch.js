// locationMatch.js
// Normalizes and fuzzy-matches Nominatim's free-text state/district names
// against the exact names used in the historical crop dataset.
//
// The dataset is old (1997-2015) and uses pre-rename official names in
// several places. This alias map is a STARTING POINT — add to it as you
// discover mismatches while testing with real device locations.

const ALIASES = {
  'BENGALURU': 'BANGALORE',
  'BENGALURU URBAN': 'BANGALORE',
  'BENGALURU RURAL': 'BANGALORE RURAL',
  'MYSURU': 'MYSORE',
  'PRAYAGRAJ': 'ALLAHABAD',
  'GURUGRAM': 'GURGAON',
  'PUDUCHERRY': 'PONDICHERRY',
  'THIRUVANANTHAPURAM': 'TRIVANDRUM',
  'KOCHI': 'ERNAKULAM',
  'VADODARA': 'BARODA',
  // Add more here as testing turns up mismatches
};

function normalize(str) {
  return String(str || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z ]/g, ''); // strip punctuation Nominatim sometimes adds
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Finds the best match for rawName among candidates (array of already-normalized names).
// Returns { match, distance } or null if nothing is close enough.
function findClosest(rawName, candidates, maxDistance = 3) {
  const target = ALIASES[normalize(rawName)] || normalize(rawName);
  if (candidates.includes(target)) return { match: target, distance: 0 };

  let best = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = levenshtein(target, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  if (best && bestDist <= maxDistance) return { match: best, distance: bestDist };
  return null;
}

module.exports = { normalize, findClosest, ALIASES };
