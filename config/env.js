
const path = require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const {
  loadOrCreateSecret,
  loadOrCreateEnvironment,
} = require('./config');
const { load } = require('mime');

const secretKey = loadOrCreateEnvironment();
const AMBIENTE = (loadOrCreateEnvironment() || 'PROD').toUpperCase();

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const MAXAGE = 60 * 60 * 1000 * 8; // 8 horas
const HOST = process.env.HOST || '0.0.0.0';

/* ========= ambiente helpers ========= */
const PROD_LIKE = ['PROD', 'PRODUCAO', 'HOMOLOG', 'HOMOLOGACAO', 'DESATIVA_HOMOLOG'];
const isProdLike = PROD_LIKE.includes(AMBIENTE);

// para URLs locais: 0.0.0.0 não é navegável, usa localhost
const hostForUrl =
  (HOST === '0.0.0.0' || HOST === '::') ? 'localhost' : HOST;

/* ========= session store ========= */
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions',
});

store.on('error', (err) => {
  console.warn('⚠️  Session store error:', err?.message || err);
});

/**
 * Cookies:
 * - PROD/HOMOLOG: geralmente precisa SameSite=None + Secure=true (p/ SSO/iframes/redirects cross-site)
 * - DEV/LOCAL: SameSite=Lax + Secure=false, e NÃO setar domain (senão quebra localhost)
 */
const sessionParser = session({
  secret: secretKey,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store,

  // importante quando roda atrás de proxy (e quando você usa app.set('trust proxy', 1))
  proxy: true,

  cookie: {
    maxAge: MAXAGE,
    httpOnly: true,

    sameSite: isProdLike ? 'none' : 'lax',
    secure: isProdLike, // DEV/LOCAL precisa false (senão não salva cookie no http)
    domain: isProdLike ? '.alento.org' : undefined,
  },
});

module.exports = {
  PORT,
  HOST,
  hostForUrl,
  AMBIENTE,
  isProdLike,
  sessionParser,
};