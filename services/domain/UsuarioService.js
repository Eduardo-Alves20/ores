const Usuario = require("../../schemas/Usuario");
const { PERFIS } = require("../../config/roles");
const {
  validarSenhaForte,
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
  if (raw === "usuario") return PERFIS.ATENDENTE;
  if (!raw) return PERFIS.ATENDENTE;
  return raw;
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

class UsuarioService {
  static async listar({ page = 1, limit = 10, busca = "", ativo, perfil, sort = "-createdAt" }) {
    const filtro = {};

    if (busca) {
      filtro.$or = [
        { nome: { $regex: busca, $options: "i" } },
        { email: { $regex: busca, $options: "i" } },
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

    if (!dados.nome || !email || !senha) {
      throw createServiceError("Campos obrigatorios: nome, email e senha.", 400, "VALIDATION_ERROR");
    }

    if (!validarSenhaForte(senha)) {
      throw createServiceError(
        "Senha fraca. Use ao menos 10 caracteres com letras maiusculas, minusculas e numeros.",
        400,
        "WEAK_PASSWORD"
      );
    }

    const payload = {
      nome: String(dados.nome).trim(),
      email,
      senha: await hashSenha(senha),
      telefone: dados.telefone,
      cpf: dados.cpf,
      perfil: normalizePerfil(dados.perfil),
      ativo: typeof dados.ativo === "undefined" ? true : !!dados.ativo,
      ultimoLoginEm: null,
      criadoPor: contexto.usuarioId || null,
      atualizadoPor: contexto.usuarioId || null,
    };

    const usuario = await Usuario.create(payload);
    return sanitizeUser(await Usuario.findById(usuario._id));
  }

  static async atualizar(id, dados, contexto = {}) {
    const payload = {
      nome: dados.nome ? String(dados.nome).trim() : undefined,
      email: dados.email ? String(dados.email).toLowerCase().trim() : undefined,
      telefone: dados.telefone,
      cpf: dados.cpf,
      perfil: typeof dados.perfil !== "undefined" ? normalizePerfil(dados.perfil) : undefined,
      ativo: typeof dados.ativo !== "undefined" ? !!dados.ativo : undefined,
      atualizadoPor: contexto.usuarioId || undefined,
    };

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
        "Senha fraca. Use ao menos 10 caracteres com letras maiusculas, minusculas e numeros.",
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

  static async autenticar({ email, senha, ip }) {
    const emailNorm = String(email || "").toLowerCase().trim();
    const password = String(senha || "");

    if (!emailNorm || !password) {
      throw createServiceError("Credenciais invalidas.", 401, "INVALID_CREDENTIALS");
    }

    const usuario = await Usuario.findOne({ email: emailNorm }).select("+senha");
    if (!usuario || !usuario.ativo) {
      throw createServiceError("Credenciais invalidas.", 401, "INVALID_CREDENTIALS");
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

