// cropRecommendation.js
// Runtime lookup: given a raw state/district string (from Nominatim) and a
// date, returns ranked historical crop recommendations. No Gemini, no ML —
// pure lookup into the precomputed cropLookup.json (see preprocessCropData.js).

const fs = require('fs');
const path = require('path');
const { findClosest } = require('./locationMatch');
const { getCurrentSeasons } = require('./seasonUtils');

// Adjust these paths to wherever preprocessCropData.js wrote its output in your repo.
const lookup = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/cropLookup.json'), 'utf8')
);
const districtIndex = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/districtIndex.json'), 'utf8')
);

const allStates = Object.keys(lookup);

function mergeSeasonCrops(districtSeasons, seasons) {
  const merged = new Map();
  for (const season of seasons) {
    const crops = districtSeasons[season];
    if (!crops) continue;
    for (const c of crops) {
      if (!merged.has(c.crop)) {
        merged.set(c.crop, { crop: c.crop, totalArea: 0, totalProduction: 0, yearsGrown: 0 });
      }
      const m = merged.get(c.crop);
      m.totalArea += c.totalArea;
      m.totalProduction += c.totalProduction;
      m.yearsGrown = Math.max(m.yearsGrown, c.yearsGrown);
    }
  }
  return finalizeAndSort(merged);
}

function aggregateStateLevel(stateName, seasons) {
  const stateData = lookup[stateName];
  if (!stateData) return [];
  const merged = new Map();
  for (const district of Object.values(stateData)) {
    for (const season of seasons) {
      const crops = district[season];
      if (!crops) continue;
      for (const c of crops) {
        if (!merged.has(c.crop)) {
          merged.set(c.crop, { crop: c.crop, totalArea: 0, totalProduction: 0, yearsGrown: 0 });
        }
        const m = merged.get(c.crop);
        m.totalArea += c.totalArea;
        m.totalProduction += c.totalProduction;
        m.yearsGrown = Math.max(m.yearsGrown, c.yearsGrown);
      }
    }
  }
  return finalizeAndSort(merged);
}

function finalizeAndSort(mergedMap) {
  return [...mergedMap.values()]
    .map((c) => ({
      ...c,
      avgYieldPerArea: c.totalArea > 0 ? Number((c.totalProduction / c.totalArea).toFixed(3)) : 0,
    }))
    .sort((a, b) => b.totalArea - a.totalArea || b.yearsGrown - a.yearsGrown);
}

/**
 * @param {string} rawState - e.g. from Nominatim's address.state
 * @param {string} rawDistrict - e.g. from Nominatim's address.county / state_district
 * @param {Date} [date]
 * @returns {{ crops: Array, matchLevel: 'district'|'state'|'none', matchedState: string|null, matchedDistrict: string|null }}
 */
function getCropRecommendations(rawState, rawDistrict, date = new Date()) {
  const seasons = getCurrentSeasons(date);

  const stateMatch = findClosest(rawState, allStates, 4);
  if (!stateMatch) {
    return { crops: [], matchLevel: 'none', matchedState: null, matchedDistrict: null };
  }
  const matchedState = stateMatch.match;

  const districtCandidates = districtIndex[matchedState] || [];
  const districtMatch = findClosest(rawDistrict, districtCandidates, 3);

  if (districtMatch) {
    const crops = mergeSeasonCrops(lookup[matchedState][districtMatch.match], seasons);
    if (crops.length > 0) {
      return { crops: crops.slice(0, 5), matchLevel: 'district', matchedState, matchedDistrict: districtMatch.match };
    }
  }

  // Fallback: no district match, or district matched but had no data for these seasons
  const stateCrops = aggregateStateLevel(matchedState, seasons);
  return {
    crops: stateCrops.slice(0, 5),
    matchLevel: stateCrops.length > 0 ? 'state' : 'none',
    matchedState,
    matchedDistrict: districtMatch ? districtMatch.match : null,
  };
}

module.exports = { getCropRecommendations };
