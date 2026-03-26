const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const envFilePath = path.resolve(process.cwd(), ".env");
const secretKey = loadOrCreateSecret();

function appendEnvValue(key, value) {
  if (!fs.existsSync(envFilePath)) {
    fs.writeFileSync(envFilePath, "", "utf8");
  }

  fs.appendFileSync(envFilePath, `\n${key}=${value}`);
}

function loadOrCreateCookieParserKey() {
    const cookieParserKey = process.env.COOKIE_PARSER_KEY;
    if (cookieParserKey) {
      console.log(`Chave cookie-parser carregada do ambiente COOKIE_PARSER_KEY`);
      return cookieParserKey;
    } else {
      const key = crypto.randomBytes(32).toString('hex');
      process.env.COOKIE_PARSER_KEY = key;
      appendEnvValue("COOKIE_PARSER_KEY", key);
      console.log(`Gerando nova chave para cookie-parser no arquivo .env`);
      return key;
    }
}

function loadOrCreateSecret() {
    const secretKey = process.env.SECRET_KEY;
    if (secretKey) {
      console.log(`Chave secret carregada ambiente SECRET_KEY`);
      return secretKey;
    } else {
      const secret = crypto.randomBytes(32).toString('hex');
      process.env.SECRET_KEY = secret;
      appendEnvValue("SECRET_KEY", secret);
      console.log(`Gerando secret no arquivo .env`);
      return secret;
    }
}

module.exports = {
    loadOrCreateCookieParserKey,
    secretKey
}
