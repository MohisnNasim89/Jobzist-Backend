const CryptoJS = require("crypto-js");
require("dotenv").config();

const SERVER_SECRET = process.env.SERVER_SECRET; 

const generateKey = () => {
    return CryptoJS.lib.WordArray.random(32).toString();
};

const encrypt = (text, key) => {
    return CryptoJS.AES.encrypt(text, key).toString();
};

const decrypt = (cipher, key) => {
    const bytes = CryptoJS.AES.decrypt(cipher, key);
    return bytes.toString(CryptoJS.enc.Utf8);
};

const encryptKey = (key) => {
    return CryptoJS.AES.encrypt(key, SERVER_SECRET).toString();
};

const decryptKey = (encryptedKey) => {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, SERVER_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = { generateKey, encrypt, decrypt, encryptKey, decryptKey };