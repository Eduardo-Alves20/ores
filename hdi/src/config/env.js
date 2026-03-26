const fs = require('fs');
const path = require('path');
const session = require('express-session');
const MongoStore = require("connect-mongo");
const { secretKey } = require('./config');

// Carrega .env se existir, mas não deve ser obrigatório (containers podem usar env vars diretamente).
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

var DB_HOST = process.env.DB_HOST; // Host do banco de dados
var DB_PORT = process.env.DB_PORT; // Porta do banco de dados
var HOST = process.env.HOST; // Host do servidor
var SERVER_PORT = process.env.SERVER_PORT; // Porta do servidor
var LDAP_AUTH = process.env.LDAP_AUTH; // Autenticação LDAP
var LDAP_AUTH_TOKEN = process.env.LDAP_AUTH_TOKEN
var EMAIL_HELPDESK = process.env.EMAIL_HELPDESK; // Email do helpdesk
var AMBIENTE = (process.env.AMBIENTE || 'LOCAL').toUpperCase(); // Ambiente de desenvolvimento
var MAXAGE = 60 * 60 * 1000 * 8 // 8 horas
var SSO_MAXAGE = 60 * 60 * 1000 * 1 // 1 hora
let DOMINIO;

let DB_URI = process.env.DB_URI;
if (!DB_URI) {
    DB_URI = `mongodb://${DB_HOST}:${DB_PORT}/HDI`;
}


const store = MongoStore.MongoStore.create({
    mongoUrl: DB_URI,
    collectionName: 'sessions'
}); 

const sessionParser = session({
    secret: secretKey,
    name: 'hdi.sid',
    cookie: {
        maxAge: MAXAGE,
        httpOnly: true,
        sameSite: AMBIENTE === 'LOCAL' ? 'lax' : 'strict',
        secure: AMBIENTE !== 'LOCAL'
    },
    proxy: AMBIENTE !== 'LOCAL',
    resave: false,
    saveUninitialized: false,
    store: store
});

module.exports = {
    DB_HOST,
    DB_PORT,
    DB_URI,
    HOST,
    SERVER_PORT,
    LDAP_AUTH,
    LDAP_AUTH_TOKEN,
    EMAIL_HELPDESK,
    AMBIENTE,
    DOMINIO,
    MAXAGE,
    SSO_MAXAGE,
    sessionParser,
    store
};
