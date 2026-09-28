const { getCropRecommendations } = require('./utils/cropRecommendation');

console.log(JSON.stringify(getCropRecommendations('Odisha', 'AMA'), null, 2)); // missing 'h'