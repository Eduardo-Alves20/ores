const crypto = require("crypto");
const util = require("util");

const scryptAsync = util.promisify(crypto.scrypt);

const HASH_PREFIX = "scrypt.v1";
const KEY_LENGTH = 64;

function validarSenhaForte(senha) {
  const senhaStr = String(senha || "");

  if (senhaStr.length < 10) return false;
  if (!/[a-z]/.test(senhaStr)) return false;
  if (!/[A-Z]/.test(senhaStr)) return false;
  if (!/[0-9]/.test(senhaStr)) return false;

  return true;
}

async function hashSenha(senha) {
  const plain = String(senha || "");
  const pepper = process.env.PASSWORD_PEPPER || "";
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(`${plain}${pepper}`, salt, KEY_LENGTH);
  const hashHex = Buffer.from(derived).toString("hex");

  return `${HASH_PREFIX}$${salt}$${hashHex}`;
}

async function compararSenha(senha, hashArmazenado) {
  const plain = String(senha || "");
  const stored = String(hashArmazenado || "");
  const pepper = process.env.PASSWORD_PEPPER || "";

  if (!stored.startsWith(`${HASH_PREFIX}$`)) {
    return { ok: stored === plain, precisaMigrar: stored === plain };
  }

  const [, salt, hashHex] = stored.split("$");
  if (!salt || !hashHex) return { ok: false, precisaMigrar: false };

  const derived = await scryptAsync(`${plain}${pepper}`, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(hashHex, "hex");
  const derivedBuffer = Buffer.from(derived);

  if (storedBuffer.length !== derivedBuffer.length) {
    return { ok: false, precisaMigrar: false };
  }

  const ok = crypto.timingSafeEqual(storedBuffer, derivedBuffer);
  return { ok, precisaMigrar: false };
}

module.exports = {
  validarSenhaForte,
  hashSenha,
  compararSenha,
};

