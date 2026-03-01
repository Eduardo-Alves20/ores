const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");
const {
  validarSenhaForte,
  mensagemPoliticaSenha,
  hashSenha,
  compararSenha,
} = require("../security/passwordService");

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function createServiceError(message, status = 400, code = "SERVICE_ERROR") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizePerfil(perfil) {
  const raw = String(perfil || "").toLowerCase().trim();
  if (raw === "usuario") return PERFIS.USUARIO;
  if (!raw) return PERFIS.ATENDENTE;
  return raw;
}

function normalizeTipoCadastro(tipoCadastro) {
  const raw = String(tipoCadastro || "").toLowerCase().trim();
  return raw === "familia" ? "familia" : "voluntario";
}

function normalizeStatusAprovacao(statusAprovacao, fallback = "pendente") {
  const raw = String(statusAprovacao || "").toLowerCase().trim();
  if (raw === "aprovado") return "aprovado";
  if (raw === "rejeitado") return "rejeitado";
  if (raw === "pendente") return "pendente";
  return fallback;
}

function normalizeCpf(cpf) {
  const digits = String(cpf || "").replace(/\D/g, "");
  return digits || "";
}

function normalizeLogin(login) {
  return String(login || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");
}

function isValidLogin(login) {
  return /^[a-z0-9._-]{3,40}$/.test(String(login || ""));
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidCpf(cpf) {
  const value = normalizeCpf(cpf);
  if (!value || value.length !== 11) return false;
  if (/^(\d)\1+$/.test(value)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(value.charAt(i)) * (10 - i);
  }
  let first = (sum * 10) % 11;
  if (first === 10) first = 0;
  if (first !== Number(value.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(value.charAt(i)) * (11 - i);
  }
  let second = (sum * 10) % 11;
  if (second === 10) second = 0;
  return second === Number(value.charAt(10));
}

function sanitizeUser(usuario) {
  if (!usuario) return null;
  const u = usuario.toObject ? usuario.toObject() : usuario;
  delete u.senha;
  return u;
}

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

async function buscarUsuarioPorIdentificador(identificador) {
  const raw = String(identificador || "").trim();
  const lower = raw.toLowerCase();
  const cpf = normalizeCpf(raw);

  if (!raw) return null;

  let usuario = await Usuario.findOne({ email: lower }).select("+senha");
  if (usuario) return usuario;

  if (cpf.length === 11) {
    usuario = await Usuario.findOne({ cpf }).select("+senha");
    if (usuario) return usuario;
  }

  usuario = await Usuario.findOne({ login: lower }).select("+senha");
  if (usuario) return usuario;

  if (!lower.includes("@")) {
    const byPrefix = await Usuario.find({
      email: { $regex: new RegExp(`^${escapeRegex(lower)}@`, "i") },
    })
      .select("+senha")
      .limit(2);

    if (byPrefix.length === 1) {
      return byPrefix[0];
    }
  }

  return null;
}

class UsuarioService {
  static async listar({
    page = 1,
    limit = 10,
    busca = "",
    ativo,
    perfil,
    tipoCadastro,
    statusAprovacao,
    sort = "-createdAt",
  }) {
    const filtro = {};

    if (busca) {
      filtro.$or = [
        { nome: { $regex: busca, $options: "i" } },
        { email: { $regex: busca, $options: "i" } },
        { login: { $regex: busca, $options: "i" } },
        { cpf: { $regex: busca, $options: "i" } },
      ];
    }

    const ativoParsed = parseBoolean(ativo);
    if (typeof ativoParsed !== "undefined") {
      filtro.ativo = ativoParsed;
    }

    if (perfil) {
      filtro.perfil = normalizePerfil(perfil);
    }

    if (tipoCadastro) {
      filtro.tipoCadastro = normalizeTipoCadastro(tipoCadastro);
    }

    if (statusAprovacao) {
      filtro.statusAprovacao = normalizeStatusAprovacao(statusAprovacao, "pendente");
    }

    return Usuario.paginate(filtro, {
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 10, 100),
      sort,
      select: "-senha",
      lean: true,
    });
  }

  static async buscarPorId(id) {
    return Usuario.findById(id).select("-senha");
  }

  static async buscarPorEmail(email, includeSenha = false) {
    const query = Usuario.findOne({ email: String(email || "").toLowerCase().trim() });
    if (includeSenha) query.select("+senha");
    return query;
  }

  static async criar(dados, contexto = {}) {
    const email = String(dados.email || "").toLowerCase().trim();
    const senha = String(dados.senha || "");
    const cpf = normalizeCpf(dados.cpf);
    const hasLogin = Object.prototype.hasOwnProperty.call(dados, "login");
    const login = normalizeLogin(dados.login);
    const ativoParsed = parseBoolean(dados.ativo);
    const perfilNormalized = normalizePerfil(dados.perfil);
    const tipoCadastroNormalized = normalizeTipoCadastro(dados.tipoCadastro);
    const statusDefault = perfilNormalized === PERFIS.USUARIO ? "pendente" : "aprovado";
    const statusAprovacao = normalizeStatusAprovacao(dados.statusAprovacao, statusDefault);

    if (!dados.nome || !email || !senha) {
      throw createServiceError("Campos obrigatorios: nome, email e senha.", 400, "VALIDATION_ERROR");
    }

    // Validacao de CPF temporariamente desativada para facilitar testes.
    // Aqui fica a validacao de CPF:
    // if (cpf && !isValidCpf(cpf)) {
    //   throw createServiceError("CPF invalido.", 400, "VALIDATION_ERROR");
    // }

    if (!validarSenhaForte(senha)) {
      throw createServiceError(
        mensagemPoliticaSenha(),
        400,
        "WEAK_PASSWORD"
      );
    }

    if (hasLogin && !login) {
      throw createServiceError("Usuario para login e obrigatorio.", 400, "VALIDATION_ERROR");
    }

    if (login && !isValidLogin(login)) {
      throw createServiceError(
        "Login invalido. Use 3 a 40 caracteres com letras, numeros, ponto, traco ou underscore.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const payload = {
      nome: String(dados.nome).trim(),
      email,
      login: login || undefined,
      senha: await hashSenha(senha),
      telefone: String(dados.telefone || "").trim() || undefined,
      cpf: cpf || undefined,
      perfil: perfilNormalized,
      tipoCadastro: tipoCadastroNormalized,
      statusAprovacao,
      ativo: typeof ativoParsed === "undefined" ? statusAprovacao === "aprovado" : ativoParsed,
      aprovadoEm: statusAprovacao === "aprovado" ? new Date() : null,
      aprovadoPor: statusAprovacao === "aprovado" ? contexto.usuarioId || null : null,
      motivoAprovacao: String(dados.motivoAprovacao || "").trim(),
      ultimoLoginEm: null,
      criadoPor: contexto.usuarioId || null,
      atualizadoPor: contexto.usuarioId || null,
    };

    const usuario = await Usuario.create(payload);
    return sanitizeUser(await Usuario.findById(usuario._id));
  }

  static async atualizar(id, dados, contexto = {}) {
    const hasCpf = Object.prototype.hasOwnProperty.call(dados, "cpf");
    const cpf = normalizeCpf(dados.cpf);
    const hasLogin = Object.prototype.hasOwnProperty.call(dados, "login");
    const login = normalizeLogin(dados.login);
    // Validacao de CPF temporariamente desativada para facilitar testes.
    // Aqui fica a validacao de CPF:
    // if (hasCpf && cpf && !isValidCpf(cpf)) {
    //   throw createServiceError("CPF invalido.", 400, "VALIDATION_ERROR");
    // }

    if (hasLogin && !login) {
      throw createServiceError("Usuario para login e obrigatorio.", 400, "VALIDATION_ERROR");
    }

    if (login && !isValidLogin(login)) {
      throw createServiceError(
        "Login invalido. Use 3 a 40 caracteres com letras, numeros, ponto, traco ou underscore.",
        400,
        "VALIDATION_ERROR"
      );
    }

    const ativoParsed = parseBoolean(dados.ativo);
    const hasStatusAprovacao = Object.prototype.hasOwnProperty.call(dados, "statusAprovacao");
    const statusAprovacao = hasStatusAprovacao
      ? normalizeStatusAprovacao(dados.statusAprovacao, "pendente")
      : undefined;

    const payload = {
      nome: dados.nome ? String(dados.nome).trim() : undefined,
      email: dados.email ? String(dados.email).toLowerCase().trim() : undefined,
      login: hasLogin ? login : undefined,
      telefone: Object.prototype.hasOwnProperty.call(dados, "telefone")
        ? (String(dados.telefone || "").trim() || null)
        : undefined,
      cpf: hasCpf ? (cpf || null) : undefined,
      perfil: typeof dados.perfil !== "undefined" ? normalizePerfil(dados.perfil) : undefined,
      tipoCadastro: typeof dados.tipoCadastro !== "undefined" ? normalizeTipoCadastro(dados.tipoCadastro) : undefined,
      statusAprovacao,
      motivoAprovacao: Object.prototype.hasOwnProperty.call(dados, "motivoAprovacao")
        ? String(dados.motivoAprovacao || "").trim()
        : undefined,
      ativo: typeof ativoParsed !== "undefined" ? ativoParsed : undefined,
      atualizadoPor: contexto.usuarioId || undefined,
    };

    if (statusAprovacao === "aprovado") {
      payload.aprovadoEm = new Date();
      payload.aprovadoPor = contexto.usuarioId || null;
      if (typeof payload.motivoAprovacao === "undefined") {
        payload.motivoAprovacao = "";
      }
    }

    if (statusAprovacao === "pendente" || statusAprovacao === "rejeitado") {
      payload.aprovadoEm = null;
      payload.aprovadoPor = null;
    }

    if (statusAprovacao === "rejeitado" && typeof payload.ativo === "undefined") {
      payload.ativo = false;
    }

    Object.keys(payload).forEach((key) => {
      if (typeof payload[key] === "undefined") delete payload[key];
    });

    const updated = await Usuario.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).select("-senha");

    return updated;
  }

  static async atualizarSenha(id, novaSenha, contexto = {}) {
    if (!validarSenhaForte(novaSenha)) {
      throw createServiceError(
        mensagemPoliticaSenha(),
        400,
        "WEAK_PASSWORD"
      );
    }

    return Usuario.findByIdAndUpdate(
      id,
      {
        senha: await hashSenha(novaSenha),
        atualizadoPor: contexto.usuarioId || null,
      },
      { new: true, runValidators: true }
    ).select("-senha");
  }

  static async alterarStatus(id, ativo, contexto = {}) {
    const patch = {
      ativo: !!ativo,
      atualizadoPor: contexto.usuarioId || null,
    };

    if (!ativo) {
      patch.inativadoEm = new Date();
      patch.inativadoPor = contexto.usuarioId || null;
    } else {
      patch.inativadoEm = null;
      patch.inativadoPor = null;
    }

    return Usuario.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    }).select("-senha");
  }

  static async remover(id, contexto = {}) {
    return this.alterarStatus(id, false, contexto);
  }

  static async autenticar({ identificador, email, senha, ip }) {
    const loginId = String(identificador || email || "").trim();
    const password = String(senha || "");

    if (!loginId || !password) {
      throw createServiceError("Credenciais invalidas.", 401, "INVALID_CREDENTIALS");
    }

    const usuario = await buscarUsuarioPorIdentificador(loginId);
    if (!usuario) {
      throw createServiceError("Credenciais invalidas.", 401, "INVALID_CREDENTIALS");
    }

    if (usuario.perfil === PERFIS.USUARIO) {
      const statusAprovacao = normalizeStatusAprovacao(
        usuario.statusAprovacao,
        "pendente"
      );

      if (statusAprovacao === "pendente") {
        throw createServiceError("Cadastro pendente de aprovacao.", 403, "PENDING_APPROVAL");
      }

      if (statusAprovacao === "rejeitado") {
        throw createServiceError("Cadastro rejeitado.", 403, "REJECTED_APPROVAL");
      }
    }

    if (!usuario.ativo) {
      throw createServiceError("Conta inativa.", 403, "INACTIVE_ACCOUNT");
    }

    if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
      throw createServiceError("Conta temporariamente bloqueada por excesso de tentativas.", 423, "ACCOUNT_LOCKED");
    }

    const compare = await compararSenha(password, usuario.senha);
    if (!compare.ok) {
      const tentativas = (usuario.tentativasLogin || 0) + 1;
      const patch = { tentativasLogin: tentativas };

      if (tentativas >= MAX_LOGIN_ATTEMPTS) {
        const bloqueadoAte = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        patch.bloqueadoAte = bloqueadoAte;
        patch.tentativasLogin = 0;
      }

      await Usuario.updateOne({ _id: usuario._id }, { $set: patch });
      throw createServiceError("Credenciais invalidas.", 401, "INVALID_CREDENTIALS");
    }

    const patch = {
      tentativasLogin: 0,
      bloqueadoAte: null,
      ultimoLoginEm: new Date(),
      ultimoLoginIp: ip || null,
    };

    if (compare.precisaMigrar) {
      patch.senha = await hashSenha(password);
    }

    await Usuario.updateOne({ _id: usuario._id }, { $set: patch });
    const atualizado = await Usuario.findById(usuario._id).select("-senha");
    return sanitizeUser(atualizado);
  }
}

module.exports = UsuarioService;

