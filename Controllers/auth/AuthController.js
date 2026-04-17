const mongoose = require("mongoose");

const UsuarioService = require("../../services/domain/UsuarioService");
const { registrarAuditoria } = require("../../services/shared/auditService");
const { PERFIS } = require("../../config/roles");
const { resolvePermissionsForUserId } = require("../../services/shared/accessControlService");
const { resolveLandingRouteForUser } = require("../../services/shared/navigationService");
const { buildSessionUserPayload } = require("../../services/security/sessionSecurityService");
const { logSanitizedError } = require("../../services/security/logSanitizerService");
const {
  registerAdaptiveThrottleFailure,
  registerAdaptiveThrottleSuccess,
} = require("../../services/security/adaptiveThrottleService");
const {
  storeProtectedAssetForUser,
} = require("../../services/security/secureVolunteerAssetService");
const { deleteProtectedAssets } = require("../../services/admin/user/userProtectedAssetService");

function isHtmlRequest(req) {
  return !!req.accepts("html");
}

function buildCadastroFormData(source = {}) {
  const dadosCadastro = {};

  if (
    source?.dadosCadastro &&
    typeof source.dadosCadastro === "object" &&
    !Array.isArray(source.dadosCadastro)
  ) {
    Object.entries(source.dadosCadastro).forEach(([key, value]) => {
      dadosCadastro[String(key || "").trim()] = value;
    });
  }

  Object.entries(source || {}).forEach(([rawKey, value]) => {
    const key = String(rawKey || "").trim();
    const bracketMatch = key.match(/^dadosCadastro\[(.+)\]$/);
    if (bracketMatch && bracketMatch[1]) {
      dadosCadastro[String(bracketMatch[1]).trim()] = value;
      return;
    }

    if (key.startsWith("dadosCadastro_")) {
      const nestedKey = key.slice("dadosCadastro_".length).trim();
      if (nestedKey) {
        dadosCadastro[nestedKey] = value;
      }
    }
  });

  return {
    nome: String(source?.nome || ""),
    email: String(source?.email || ""),
    login: String(source?.login || ""),
    cpf: String(source?.cpf || ""),
    telefone: String(source?.telefone || ""),
    tipoCadastro: String(source?.tipoCadastro || ""),
    fluxoEtapa: String(source?.fluxoEtapa || ""),
    dadosCadastro,
  };
}

function createCadastroError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function extractUploadedFile(req, fieldName) {
  const files = req?.files?.[fieldName];
  if (!Array.isArray(files) || !files.length) return null;
  return files[0] || null;
}

function resolveCadastroUploadError(req) {
  const uploadError = req?.uploadError;
  if (!uploadError) return null;

  if (uploadError?.name === "MulterError" && uploadError?.code === "LIMIT_FILE_SIZE") {
    return createCadastroError(
      "Um dos arquivos enviados excede o limite permitido. Envie documento e foto mais leves.",
      400
    );
  }

  if (uploadError?.name === "MulterError") {
    return createCadastroError("Não foi possível receber os arquivos do cadastro.", 400);
  }

  return createCadastroError(
    uploadError?.message || "Não foi possível receber os arquivos do cadastro.",
    400
  );
}

function renderCadastroPage(req, res, options = {}) {
  const status = Number(options.status || 200);

  return res.status(status).render("pages/auth/cadastro", {
    title: "Criar conta no GESA",
    layout: "partials/login.ejs",
    pageClass: "page-auth page-auth-cadastro",
    metaDescription:
      "Solicite seu acesso ao GESA para acompanhar dados, atendimentos e processos da Fundação ORES como família, voluntário ou órgão público.",
    errorMessage: Array.isArray(options.errorMessage) ? options.errorMessage : req.flash("error"),
    successMessage: Array.isArray(options.successMessage) ? options.successMessage : req.flash("success"),
    formData: buildCadastroFormData(options.formData || req.query || {}),
    ambiente: process.env.AMBIENTE || process.env.NODE_ENV || "",
    extraJs: ["/js/auth-cadastro.js"],
  });
}

function resolveDuplicateCadastroMessage(error) {
  if (error?.code !== 11000) return null;

  const keys = Object.keys(error?.keyPattern || error?.keyValue || {});
  if (keys.includes("email")) return "Já existe um usuário cadastrado com este e-mail.";
  if (keys.includes("login")) return "Já existe um usuário cadastrado com este usuário de login.";
  if (keys.includes("cpf")) return "Já existe um usuário cadastrado com este CPF.";

  return "Já existe um usuário cadastrado com este e-mail, usuário ou CPF.";
}

class AuthController {
  static async loginPage(req, res) {
    if (req?.session?.user) {
      return res.redirect(resolveLandingRouteForUser(req.session.user));
    }

    const successMessage = req.flash("success");
    const errorMessage = req.flash("error");
    const reason = String(req.query?.reason || "").trim().toLowerCase();

    if (reason === "senha_alterada") {
      successMessage.push("Senha alterada com sucesso. Faca login novamente.");
    }

    if (reason === "sessao_revogada") {
      errorMessage.push(
        "Sua sessao anterior foi encerrada por mudanca de permissao, credencial ou estado da conta."
      );
    }

    return res.status(200).render("pages/auth/login", {
      title: "Login do GESA",
      layout: "partials/login.ejs",
      pageClass: "page-auth",
      metaDescription:
        "Acesse o GESA, sistema de gestão social da Fundação ORES para famílias, voluntários, atendimentos e agenda institucional.",
      errorMessage,
      successMessage,
    });
  }

  static async cadastroPage(req, res) {
    if (req?.session?.user) {
      return res.redirect(resolveLandingRouteForUser(req.session.user));
    }

    return renderCadastroPage(req, res);
  }

  static async cadastro(req, res) {
    const storedAssets = [];

    try {
      const uploadError = resolveCadastroUploadError(req);
      if (uploadError) {
        throw uploadError;
      }

      const formData = buildCadastroFormData(req.body || {});
      const nome = String(formData.nome || "").trim();
      const email = String(formData.email || "").trim();
      const login = String(formData.login || "").trim();
      const cpf = String(formData.cpf || "").trim();
      const telefone = String(formData.telefone || "").trim();
      const tipoCadastro = String(formData.tipoCadastro || "voluntario").trim().toLowerCase();
      const senha = String(req.body?.senha || "");
      const confirmarSenha = String(req.body?.confirmarSenha || "");

      if (!nome || !email || !login || !senha || !confirmarSenha) {
        throw createCadastroError(
          "Preencha os campos obrigatórios: nome, e-mail, usuário, senha e confirmar senha.",
          400
        );
      }

      if (tipoCadastro === "familia" && !cpf) {
        throw createCadastroError(
          "Informe o CPF do responsável para concluir o cadastro da família.",
          400
        );
      }

      if (senha !== confirmarSenha) {
        throw createCadastroError("As senhas informadas não conferem.", 400);
      }

      let predefinedUserId;
      let anexosProtegidos;

      if (tipoCadastro === "voluntario") {
        const documentoIdentidadeArquivo = extractUploadedFile(req, "documentoIdentidadeArquivo");
        const fotoPerfilArquivo = extractUploadedFile(req, "fotoPerfilArquivo");

        if (!documentoIdentidadeArquivo || !fotoPerfilArquivo) {
          throw createCadastroError(
            "Para cadastro de voluntário, envie o documento de identidade e a foto de perfil.",
            400
          );
        }

        predefinedUserId = new mongoose.Types.ObjectId().toString();

        const documentoIdentidade = await storeProtectedAssetForUser({
          kind: "documentoIdentidade",
          file: documentoIdentidadeArquivo,
          userId: predefinedUserId,
        });
        storedAssets.push(documentoIdentidade);

        const fotoPerfil = await storeProtectedAssetForUser({
          kind: "fotoPerfil",
          file: fotoPerfilArquivo,
          userId: predefinedUserId,
        });
        storedAssets.push(fotoPerfil);

        anexosProtegidos = {
          documentoIdentidade,
          fotoPerfil,
        };
      }

      const novoUsuario = await UsuarioService.criar({
        _id: predefinedUserId,
        nome,
        email,
        login,
        cpf,
        telefone,
        tipoCadastro,
        senha,
        dadosCadastro: formData.dadosCadastro,
        anexosProtegidos,
        perfil: PERFIS.USUARIO,
        statusAprovacao: "pendente",
        ativo: false,
      });

      await registrarAuditoria(req, {
        acao: "USUARIO_AUTO_CADASTRO",
        entidade: "usuario",
        entidadeId: String(novoUsuario?._id || ""),
        detalhes: {
          tipoCadastro,
          email,
        },
      });

      registerAdaptiveThrottleSuccess(req);

      if (isHtmlRequest(req)) {
        req.flash(
          "success",
          "Cadastro enviado com sucesso. A equipe da ORES já recebeu suas informações."
        );
        return res.redirect("/login");
      }

      return res.status(201).json({
        mensagem: "Cadastro realizado com sucesso.",
        usuario: novoUsuario,
      });
    } catch (error) {
      if (storedAssets.length) {
        await deleteProtectedAssets(storedAssets);
      }

      registerAdaptiveThrottleFailure(req);

      const duplicate =
        resolveDuplicateCadastroMessage(error) || error?.message || "Falha ao realizar o cadastro.";

      if (isHtmlRequest(req)) {
        return renderCadastroPage(req, res, {
          status: error?.status || 400,
          errorMessage: [duplicate],
          successMessage: [],
          formData: {
            ...req.body,
            dadosCadastro:
              req.body?.dadosCadastro && typeof req.body.dadosCadastro === "object"
                ? req.body.dadosCadastro
                : {},
          },
        });
      }

      return res.status(error?.status || 400).json({ erro: duplicate });
    }
  }

  static async login(req, res) {
    try {
      const identificador = String(req.body?.identificador || req.body?.email || "").trim();
      const senha = String(req.body?.senha || "");
      const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      const usuario = await UsuarioService.autenticar({ identificador, senha, ip });

      req.session.regenerate(async (err) => {
        if (err) {
          logSanitizedError("Falha ao regenerar sessao:", err, {
            route: req.originalUrl || req.url || "",
          });

          if (!res.headersSent) {
            return res.status(500).json({ erro: "Falha ao iniciar sessao." });
          }

          return;
        }

        try {
          req.session.user = buildSessionUserPayload(
            usuario,
            await resolvePermissionsForUserId(usuario._id, usuario.perfil)
          );

          registerAdaptiveThrottleSuccess(req);

          await registrarAuditoria(req, {
            acao: "LOGIN_OK",
            entidade: "auth",
            entidadeId: String(usuario._id),
          });

          if (isHtmlRequest(req)) {
            return res.redirect(resolveLandingRouteForUser(req.session.user));
          }

          return res.status(200).json({
            mensagem: "Login realizado com sucesso.",
            usuario: req.session.user,
          });
        } catch (internalError) {
          logSanitizedError("Erro ao finalizar login:", internalError, {
            route: req.originalUrl || req.url || "",
            userId: String(usuario?._id || ""),
          });

          if (!res.headersSent) {
            return res.status(500).json({ erro: "Falha ao finalizar login." });
          }
        }
      });
    } catch (error) {
      registerAdaptiveThrottleFailure(req);

      const message =
        error?.status === 423
          ? "Conta bloqueada temporariamente. Aguarde alguns minutos."
          : error?.code === "PENDING_APPROVAL"
            ? "Cadastro pendente de aprovação do administrador."
            : error?.code === "REJECTED_APPROVAL"
              ? "Cadastro rejeitado. Fale com a administração da ONG."
              : error?.code === "INACTIVE_ACCOUNT"
                ? "Conta inativa. Solicite liberação ao administrador."
                : "CPF, usuário ou e-mail inválidos.";

      await registrarAuditoria(req, {
        acao: "LOGIN_FALHA",
        entidade: "auth",
        detalhes: {
          motivo: error?.code || "INVALID_CREDENTIALS",
          identificador: String(
            req.body?.identificador || req.body?.email || ""
          ).toLowerCase().trim(),
        },
      });

      if (isHtmlRequest(req)) {
        req.flash("error", message);
        return res.redirect("/login");
      }

      return res.status(error?.status || 401).json({ erro: message });
    }
  }

  static async logout(req, res) {
    const userId = req?.session?.user?.id;

    req.session.destroy(async () => {
      try {
        res.clearCookie(process.env.SESSION_NAME || "ORES.sid");
        res.clearCookie("connect.sid");

        await registrarAuditoria(req, {
          acao: "LOGOUT",
          entidade: "auth",
          entidadeId: userId,
        });

        if (isHtmlRequest(req)) {
          return res.redirect("/login");
        }

        return res.status(200).json({ mensagem: "Logout realizado com sucesso." });
      } catch (error) {
        logSanitizedError("Erro ao finalizar logout:", error, {
          route: req.originalUrl || req.url || "",
          userId,
        });

        if (!res.headersSent) {
          return res.status(500).json({ erro: "Falha ao encerrar sessao." });
        }
      }
    });
  }

  static async me(req, res) {
    if (!req.session?.user) {
      return res.status(401).json({ erro: "Não autenticado." });
    }

    return res.status(200).json({ usuario: req.session.user });
  }
}

module.exports = AuthController;
