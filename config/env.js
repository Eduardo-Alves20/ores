
const path = require('path');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
const {
  loadOrCreateSecret,
  loadOrCreateEnvironment,
} = require('./config');

const secretKey = loadOrCreateSecret();
const AMBIENTE = (loadOrCreateEnvironment() || 'PROD').toUpperCase();

const PORT = process.env.PORT;
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || '27017';
const MONGO_FALLBACK = `mongodb://${DB_HOST}:${DB_PORT}/ALENTO`;
const RAW_MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || MONGO_FALLBACK;
const MAXAGE = 60 * 60 * 1000 * 8; // 8 horas
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_NAME = process.env.SESSION_NAME || 'alento.sid';

function normalizeMongoUri(uri) {
  try {
    const parsed = new URL(uri);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';

    if (isLocal && !parsed.searchParams.has('directConnection')) {
      parsed.searchParams.set('directConnection', 'true');
      return parsed.toString();
    }
  } catch (_) {
    return uri;
  }

  return uri;
}

const MONGODB_URI = normalizeMongoUri(RAW_MONGODB_URI);

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
}, (error) => {
  if (error) {
    console.warn('Session store startup error:', error?.message || error);
  }
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
  name: SESSION_NAME,
  secret: secretKey,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  unset: 'destroy',
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
