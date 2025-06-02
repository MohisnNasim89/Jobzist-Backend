const CryptoJS = require("crypto-js");
const logger = require("./logger");
require("dotenv").config();

const SERVER_SECRET = process.env.SERVER_SECRET;

if (!SERVER_SECRET) {
  throw new Error("SERVER_SECRET is not defined in environment variables");
}

const generateKey = () => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

const encrypt = (text, key) => {
  if (!text || !key) {
    throw new Error("Text and key are required for encryption");
  }
  return CryptoJS.AES.encrypt(text, key).toString();
};

const decrypt = (cipher, key) => {
  if (!cipher || !key) {
    throw new Error("Cipher and key are required for decryption");
  }
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error("Decryption failed: Invalid cipher or key");
    }
    return decrypted;
  } catch (error) {
    logger.error(`Decryption error: ${error.message}`);
    throw new Error("Decryption failed");
  }
};

const encryptKey = (key) => {
  if (!key) {
    throw new Error("Key is required for encryption");
  }
  return CryptoJS.AES.encrypt(key, SERVER_SECRET).toString();
};

const decryptKey = (encryptedKey) => {
  if (!encryptedKey) {
    throw new Error("Encrypted key is required for decryption");
  }
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, SERVER_SECRET);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error("Key decryption failed: Invalid encrypted key");
    }
    return decrypted;
  } catch (error) {
    logger.error(`Key decryption error: ${error.message}`);
    throw new Error("Key decryption failed");
  }
};

module.exports = { generateKey, encrypt, decrypt, encryptKey, decryptKey };