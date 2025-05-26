const axios = require("axios");
const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 3600 });

const fallbackSynonyms = {
  javascript: ["js", "ecmascript"],
  python: ["py"],
  java: ["jvm"],
  "c++": ["cpp"],
  react: ["reactjs"],
  node: ["nodejs"],
  sql: ["structured query language"],
};

exports.fetchSynonyms = async (skill) => {
  const key = skill.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  if (fallbackSynonyms[key]) {
    cache.set(key, fallbackSynonyms[key]);
    return fallbackSynonyms[key];
  }

  try {
    const res = await axios.get(`https://api.datamuse.com/words?ml=${encodeURIComponent(skill)}&max=5`);
    const synonyms = res.data.map((item) => item.word.toLowerCase());
    cache.set(key, synonyms);
    return synonyms;
  } catch (err) {
    console.error(`Failed fetching synonyms for ${skill}:`, err.message);
    return fallbackSynonyms[key] || [];
  }
};