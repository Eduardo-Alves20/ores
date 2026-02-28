const UsuarioService = require("../services/domain/UsuarioService");
const { registrarAuditoria } = require("../services/auditService");

function isHtmlRequest(req) {
  return !!req.accepts("html");
}

class AuthController {
  static async loginPage(req, res) {
    if (req?.session?.user) {
      return res.redirect("/painel");
    }

    return res.status(200).render("pages/auth/login", {
      title: "Login",
      layout: "partials/login.ejs",
      pageClass: "page-auth",
      errorMessage: req.flash("error"),
    });
  }

  static async login(req, res) {
    try {
      const { email, senha } = req.body;
      const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      const usuario = await UsuarioService.autenticar({ email, senha, ip });

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
          };

          await registrarAuditoria(req, {
            acao: "LOGIN_OK",
            entidade: "auth",
            entidadeId: String(usuario._id),
          });

          if (isHtmlRequest(req)) {
            return res.redirect("/painel");
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
        : "Email ou senha invalidos.";

      await registrarAuditoria(req, {
        acao: "LOGIN_FALHA",
        entidade: "auth",
        detalhes: {
          motivo: error?.code || "INVALID_CREDENTIALS",
          email: String(req.body?.email || "").toLowerCase().trim(),
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
