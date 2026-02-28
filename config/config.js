const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

function loadOrCreateEnvironment() {
  const v = process.env.AMBIENTE;
  if (v) {
    console.log(`Variável de ambiente AMBIENTE carregada: ${v}`);
    return v;
  }
  process.env.AMBIENTE = 'PROD';
  fs.appendFileSync(path.join(__dirname, '..', '.env'), '\nAMBIENTE=PROD');
  console.log('Definindo valor padrão para AMBIENTE');
  return 'PROD';
}

function loadOrCreateSecret() {
  let v = process.env.SECRET;
  if (v) {
    console.log('Chave SECRET carregada do ambiente');
    return v;
  }
  v = crypto.randomBytes(32).toString('hex');
  process.env.SECRET = v;
  fs.appendFileSync(path.join(__dirname, '..', '.env'), `\nSECRET=${v}`);
  console.log('Gerando SECRET no arquivo .env');
  return v;
}

function loadOrCreateCookieParserKey() {
  let v = process.env.COOKIE_PARSER_KEY;
  if (v) {
    console.log('Chave COOKIE_PARSER_KEY carregada do ambiente');
    return v;
  }
  v = crypto.randomBytes(32).toString('hex');
  process.env.COOKIE_PARSER_KEY = v;
  fs.appendFileSync(path.join(__dirname, '..', '.env'), `\nCOOKIE_PARSER_KEY=${v}`);
  console.log('Gerando COOKIE_PARSER_KEY no arquivo .env');
  return v;
}

module.exports = {
  loadOrCreateCookieParserKey,
  loadOrCreateSecret,
  loadOrCreateEnvironment,
};
