const axios = require("axios");
const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 3600 });

exports.fetchSynonyms = async (skill) => {
  const key = skill.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await axios.get(`https://api.datamuse.com/words?ml=${encodeURIComponent(skill)}&max=5`);
    const synonyms = res.data.map((item) => item.word.toLowerCase());
    cache.set(key, synonyms);
    return synonyms;
  } catch (err) {
    console.error(`Failed fetching synonyms for ${skill}:`, err.message);
    return [];
  }
};
