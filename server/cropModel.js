const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data', 'crop_recommendation.csv');
const raw = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');

const rows = raw.slice(1).map((line) => {
  const values = line.split(',');
  return {
    temperature: parseFloat(values[3]),
    humidity: parseFloat(values[4]),
    rainfall: parseFloat(values[6]),
    label: values[7].trim(),
  };
});

// Only weather-based features now — no fabricated soil values
const featureKeys = ['temperature', 'humidity', 'rainfall'];

const stats = {};
featureKeys.forEach((key) => {
  const vals = rows.map((r) => r[key]);
  stats[key] = { min: Math.min(...vals), max: Math.max(...vals) };
});

function normalize(value, key) {
  const { min, max } = stats[key];
  return (value - min) / (max - min);
}

function predictCrop({ temperature, humidity, rainfall }, k = 5) {
  const input = { temperature, humidity, rainfall };

  const distances = rows.map((row) => {
    let sum = 0;
    featureKeys.forEach((key) => {
      const a = normalize(input[key], key);
      const b = normalize(row[key], key);
      sum += (a - b) ** 2;
    });
    return { label: row.label, dist: Math.sqrt(sum) };
  });

  distances.sort((a, b) => a.dist - b.dist);
  const nearest = distances.slice(0, k);
  const avgDist = nearest.reduce((s, n) => s + n.dist, 0) / nearest.length;

  const counts = {};
  nearest.forEach((n) => { counts[n.label] = (counts[n.label] || 0) + 1; });
  const sortedCrops = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return {
    topCrop: sortedCrops[0][0],
    alternatives: sortedCrops.slice(1, 3).map((c) => c[0]),
    // If even the nearest matches are far away, these conditions are outside the dataset's range
    lowConfidence: avgDist > 0.35,
  };
}

module.exports = { predictCrop };