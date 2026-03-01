const UsuarioService = require("../../services/domain/UsuarioService");
const { registrarAuditoria } = require("../../services/auditService");
const { PERFIS } = require("../../config/roles");
const { resolvePermissionsForUserId } = require("../../services/accessControlService");

function isHtmlRequest(req) {
  return !!req.accepts("html");
}

function resolveLandingRoute(perfil, tipoCadastro) {
  if (perfil === PERFIS.USUARIO) {
    if (String(tipoCadastro || "").toLowerCase() === "familia") return "/minha-familia";
    return "/meus-dados";
  }
  return "/painel";
}

class AuthController {
  static async loginPage(req, res) {
    if (req?.session?.user) {
      return res.redirect(resolveLandingRoute(req.session.user.perfil, req.session.user.tipoCadastro));
    }

    const successMessage = req.flash("success");
    const reason = String(req.query?.reason || "").trim().toLowerCase();
    if (reason === "senha_alterada") {
      successMessage.push("Senha alterada com sucesso. FaÃ§a login novamente.");
    }

    return res.status(200).render("pages/auth/login", {
      title: "Login",
      layout: "partials/login.ejs",
      pageClass: "page-auth",
      errorMessage: req.flash("error"),
      successMessage,
    });
  }

  static async cadastroPage(req, res) {
    if (req?.session?.user) {
      return res.redirect(resolveLandingRoute(req.session.user.perfil, req.session.user.tipoCadastro));
    }

    return res.status(200).render("pages/auth/cadastro", {
      title: "Criar Conta",
      layout: "partials/login.ejs",
      pageClass: "page-auth",
      errorMessage: req.flash("error"),
      successMessage: req.flash("success"),
      formData: {
        nome: String(req.query.nome || ""),
        email: String(req.query.email || ""),
        login: String(req.query.login || ""),
        cpf: String(req.query.cpf || ""),
        telefone: String(req.query.telefone || ""),
        tipoCadastro: String(req.query.tipoCadastro || "voluntario"),
      },
    });
  }

  static async cadastro(req, res) {
    try {
      const nome = String(req.body?.nome || "").trim();
      const email = String(req.body?.email || "").trim();
      const login = String(req.body?.login || "").trim();
      const cpf = String(req.body?.cpf || "").trim();
      const telefone = String(req.body?.telefone || "").trim();
      const tipoCadastro = String(req.body?.tipoCadastro || "voluntario").trim();
      const senha = String(req.body?.senha || "");
      const confirmarSenha = String(req.body?.confirmarSenha || "");

      if (!nome || !email || !login || !cpf || !senha || !confirmarSenha) {
        throw Object.assign(new Error("Preencha os campos obrigatorios: nome, email, usuario, cpf, senha e confirmar senha."), {
          status: 400,
        });
      }

      if (senha !== confirmarSenha) {
        throw Object.assign(new Error("As senhas informadas nao conferem."), { status: 400 });
      }

      const novoUsuario = await UsuarioService.criar({
        nome,
        email,
        login,
        cpf,
        telefone,
        tipoCadastro,
        senha,
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

      if (isHtmlRequest(req)) {
        req.flash("success", "Cadastro enviado com sucesso. O administrador ja recebeu as informacoes.");
        return res.redirect("/login");
      }

      return res.status(201).json({
        mensagem: "Cadastro realizado com sucesso.",
        usuario: novoUsuario,
      });
    } catch (error) {
      const duplicate =
        error?.code === 11000
          ? "Ja existe um usuario cadastrado com este email, usuario ou CPF."
          : error?.message || "Falha ao realizar cadastro.";

      if (isHtmlRequest(req)) {
        req.flash("error", duplicate);

        const nextQuery = new URLSearchParams({
          nome: String(req.body?.nome || ""),
          email: String(req.body?.email || ""),
          login: String(req.body?.login || ""),
          cpf: String(req.body?.cpf || ""),
          telefone: String(req.body?.telefone || ""),
          tipoCadastro: String(req.body?.tipoCadastro || "voluntario"),
        });

        return res.redirect(`/cadastro?${nextQuery.toString()}`);
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
          console.error("Falha ao regenerar sessao:", err);
          if (!res.headersSent) {
            return res.status(500).json({ erro: "Falha ao iniciar sessao." });
          }
          return;
        }

        try {
          req.session.user = {
            id: String(usuario._id),
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil,
            tipoCadastro: usuario.tipoCadastro || "",
            permissions: await resolvePermissionsForUserId(usuario._id, usuario.perfil),
          };

          await registrarAuditoria(req, {
            acao: "LOGIN_OK",
            entidade: "auth",
            entidadeId: String(usuario._id),
          });

          if (isHtmlRequest(req)) {
            return res.redirect(resolveLandingRoute(usuario.perfil, usuario.tipoCadastro));
          }

          return res.status(200).json({
            mensagem: "Login realizado com sucesso.",
            usuario: req.session.user,
          });
        } catch (internalError) {
          console.error("Erro ao finalizar login:", internalError);
          if (!res.headersSent) {
            return res.status(500).json({ erro: "Falha ao finalizar login." });
          }
        }
      });
    } catch (error) {
      const message = error?.status === 423
        ? "Conta bloqueada temporariamente. Aguarde alguns minutos."
        : error?.code === "PENDING_APPROVAL"
          ? "Cadastro pendente de aprovacao do administrador."
          : error?.code === "REJECTED_APPROVAL"
            ? "Cadastro rejeitado. Fale com a administracao da ONG."
            : error?.code === "INACTIVE_ACCOUNT"
              ? "Conta inativa. Solicite liberacao ao administrador."
              : "CPF, usuario ou email invalidos.";

      await registrarAuditoria(req, {
        acao: "LOGIN_FALHA",
        entidade: "auth",
        detalhes: {
          motivo: error?.code || "INVALID_CREDENTIALS",
          identificador: String(req.body?.identificador || req.body?.email || "").toLowerCase().trim(),
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
        res.clearCookie(process.env.SESSION_NAME || "alento.sid");
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
        console.error("Erro ao finalizar logout:", error);
        if (!res.headersSent) {
          return res.status(500).json({ erro: "Falha ao encerrar sessao." });
        }
      }
    });
  }

  static async me(req, res) {
    if (!req.session?.user) {
      return res.status(401).json({ erro: "Nao autenticado." });
    }

    return res.status(200).json({ usuario: req.session.user });
  }
}

module.exports = AuthController;

