const axios = require("axios");
const NodeCache = require("node-cache");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const logger = require("./logger");

const cache = new NodeCache({ stdTTL: 3600 });

const rateLimiter = new RateLimiterMemory({
  points: 50, // 50 requests
  duration: 60, // Per 60 seconds (1 minute)
});

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
    await rateLimiter.consume("datamuse_api", 1);
    
    const res = await axios.get(`https://api.datamuse.com/words?ml=${encodeURIComponent(skill)}&max=3`, {
      timeout: 5000, // 5 seconds timeout
    });
    const synonyms = res.data.map((item) => item.word.toLowerCase());
    logger.info(`Fetched synonyms for ${skill}: ${synonyms}`);
    cache.set(key, synonyms);
    return synonyms;
  } catch (err) {
    if (err instanceof Error && err.message.includes("RateLimiter")) {
      logger.warn(`Rate limit exceeded for Datamuse API: ${err.message}`);
      throw new Error("Too many API requests to Datamuse, please try again later.");
    }
    if (err.code === "ECONNABORTED" && err.message.includes("timeout")) {
      logger.warn(`Datamuse API call for ${skill} timed out after 5 seconds`);
      return fallbackSynonyms[key] || [];
    }
    logger.error(`Failed fetching synonyms for ${skill}: ${err.message}`);
    return fallbackSynonyms[key] || [];
  }
};