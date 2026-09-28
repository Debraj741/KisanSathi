// seasonUtils.js
// Maps the current date to the dataset's Season labels.
// The IndiaAgriculture dataset uses: Kharif, Rabi, Autumn, Winter, Summer, Whole Year.
// These are approximate calendar windows — actual sowing dates vary by region —
// so we return ALL plausible current seasons and let the caller merge results,
// plus "WHOLE YEAR" which always applies (perennial/plantation crops).
//
// Tune the month ranges below if you find they don't match farmer expectations
// during testing (e.g. Rabi timing shifts a bit by state).

function getCurrentSeasons(date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  const seasons = ['WHOLE YEAR'];

  if (month >= 6 && month <= 10) {
    seasons.push('KHARIF', 'AUTUMN');
  }
  if (month === 10 || month === 11 || month === 12 || month <= 3) {
    seasons.push('RABI', 'WINTER');
  }
  if (month >= 3 && month <= 6) {
    seasons.push('SUMMER');
  }

  return [...new Set(seasons)];
}

module.exports = { getCurrentSeasons };
