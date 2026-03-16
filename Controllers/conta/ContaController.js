const UsuarioService = require("../../services/domain/UsuarioService");
const AuditTrail = require("../../schemas/core/AuditTrail");
const { PERFIS, PERFIS_LIST, getProfileLabel } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { registrarAuditoria } = require("../../services/auditService");
const Usuario = require("../../schemas/core/Usuario");
const { compararSenha } = require("../../services/security/passwordService");
const {
  hasAnyPermission,
  resolvePermissionsForUserId,
} = require("../../services/accessControlService");

function mapTipoCadastroLabel(tipoCadastro) {
  if (tipoCadastro === "familia") return "Familia";
  return "Voluntario";
}

function mapPerfilLabel(perfil) {
  return getProfileLabel(perfil);
}

function mapActionLabel(acao) {
  return String(acao || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapEntityLabel(entidade) {
  const value = String(entidade || "").toLowerCase();
  if (value === "auth") return "Autenticacao";
  if (value === "usuario") return "Usuario";
  if (value === "familia") return "Familia";
  if (value === "agenda_evento") return "Agenda";
  if (value === "paciente") return "Paciente";
  if (value === "atendimento") return "Atendimento";
  return value || "Sistema";
}

function parseNotificacaoTipo(tipo) {
  const value = String(tipo || "").trim().toLowerCase();
  if (value === "alert" || value === "info") return value;
  return "todos";
}

function parseNotificacaoLimit(limit, fallback = 40) {
  const allowed = new Set([10, 20, 40, 60, 100]);
  const parsed = Number.parseInt(String(limit || ""), 10);
  if (allowed.has(parsed)) return parsed;
  return fallback;
}

function buildNotificacaoTipoFiltro(tipo) {
  if (tipo === "alert") {
    return { acao: /FALHA/i };
  }

  if (tipo === "info") {
    return { acao: { $not: /FALHA/i } };
  }

  return {};
}

function getCurrentUserId(req) {
  return req?.session?.user?.id || null;
}

function isAdmin(req) {
  const user = req?.session?.user || {};
  const perfil = String(user.perfil || "").toLowerCase();
  if (perfil === PERFIS.SUPERADMIN) return true;
  if (perfil === PERFIS.ADMIN) {
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (!permissions.length) return true;
    if (hasAnyPermission(permissions, [PERMISSIONS.CONTA_EDIT_ALL])) return true;
  }
  return false;
}

function isSuperAdmin(req) {
  return String(req?.session?.user?.perfil || "").toLowerCase() === PERFIS.SUPERADMIN;
}

function buildPerfilViewModel(usuario, flash = {}) {
  const senhaQuery = String(flash.senhaQuery || "").trim().toLowerCase();
  const openSenhaModal = senhaQuery === "1" || senhaQuery === "true";

  return {
    title: "Perfil",
    sectionTitle: "Perfil",
    navKey: "perfil",
    layout: "partials/app.ejs",
    pageClass: "page-conta-perfil",
    usuario,
    perfilLabel: mapPerfilLabel(usuario?.perfil),
    tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
    successMessage: flash.success || [],
    errorMessage: flash.error || [],
    senhaErrorMessage: flash.senhaError || [],
    openSenhaModal,
  };
}

class ContaController {
  static async perfil(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.redirect("/login");
      }

      const usuario = await UsuarioService.buscarPorId(userId);
      if (!usuario) {
        return res.redirect("/login");
      }

      return res.status(200).render(
        "pages/conta/perfil",
        buildPerfilViewModel(usuario, {
          success: req.flash("success"),
          error: req.flash("error"),
          senhaError: req.flash("senhaError"),
          senhaQuery: req.query?.senha,
        })
      );
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar perfil.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async editarPerfilPage(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.redirect("/login");
      }

      const usuario = await UsuarioService.buscarPorId(userId);
      if (!usuario) {
        return res.redirect("/login");
      }

      return res.status(200).render("pages/conta/perfil-editar", {
        title: "Editar Perfil",
        sectionTitle: "Editar Perfil",
        navKey: "perfil",
        layout: "partials/app.ejs",
        pageClass: "page-conta-perfil-editar",
        isAdmin: isAdmin(req),
        isSuperAdmin: isSuperAdmin(req),
        usuario,
        perfisDisponiveis: PERFIS_LIST,
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar formulario de perfil.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async editarPerfil(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.redirect("/login");
      }

      const admin = isAdmin(req);
      const superAdmin = isSuperAdmin(req);
      const payload = admin
        ? {
            nome: String(req.body?.nome || "").trim(),
            email: String(req.body?.email || "").trim(),
            login: String(req.body?.login || "").trim(),
            telefone: String(req.body?.telefone || "").trim(),
            cpf: String(req.body?.cpf || "").trim(),
            ...(superAdmin ? { perfil: String(req.body?.perfil || "").trim() } : {}),
            ...(superAdmin ? { tipoCadastro: String(req.body?.tipoCadastro || "").trim() } : {}),
            ...(superAdmin ? { ativo: String(req.body?.ativo || "").trim() === "true" } : {}),
          }
        : {
            email: String(req.body?.email || "").trim(),
            telefone: String(req.body?.telefone || "").trim(),
          };

      if (!payload.email) {
        req.flash("error", "Email e obrigatorio.");
        return res.redirect("/perfil/editar");
      }

      if (admin && !payload.nome) {
        req.flash("error", "Nome e obrigatorio para administrador.");
        return res.redirect("/perfil/editar");
      }

      const usuario = await UsuarioService.atualizar(userId, payload, { usuarioId: userId });
      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect("/perfil");
      }

      req.session.user = {
        id: String(usuario._id),
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        tipoCadastro: usuario.tipoCadastro || "",
        permissions: await resolvePermissionsForUserId(usuario._id, usuario.perfil),
      };

      await registrarAuditoria(req, {
        acao: "PERFIL_ATUALIZADO",
        entidade: "usuario",
        entidadeId: String(usuario._id),
      });

      req.flash("success", "Perfil atualizado com sucesso.");
      return res.redirect("/perfil");
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      if (error?.code === 11000) {
        req.flash("error", "Email, usuario de login ou CPF ja cadastrado.");
        return res.redirect("/perfil/editar");
      }
      req.flash("error", error?.message || "Erro ao atualizar perfil.");
      return res.redirect("/perfil/editar");
    }
  }

  static async alterarSenha(req, res) {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.redirect("/login");
      }

      const senhaAtual = String(req.body?.senhaAtual || "");
      const senhaNova = String(req.body?.senhaNova || "");
      const senhaNovaConfirmacao = String(req.body?.senhaNovaConfirmacao || "");

      if (!senhaAtual) {
        throw new Error("Informe a senha atual.");
      }

      if (!senhaNova) {
        throw new Error("Informe a nova senha.");
      }

      if (senhaNova !== senhaNovaConfirmacao) {
        throw new Error("A confirmacao da nova senha nao confere.");
      }

      const usuarioComSenha = await Usuario.findById(userId).select("+senha ativo");
      if (!usuarioComSenha || !usuarioComSenha.ativo) {
        throw new Error("Usuario nao encontrado ou inativo.");
      }

      const senhaAtualOk = await compararSenha(senhaAtual, usuarioComSenha.senha);
      if (!senhaAtualOk?.ok) {
        throw new Error("Senha atual incorreta.");
      }

      await UsuarioService.atualizarSenha(userId, senhaNova, { usuarioId: userId });

      await registrarAuditoria(req, {
        acao: "PERFIL_SENHA_ATUALIZADA",
        entidade: "usuario",
        entidadeId: String(userId),
      });

      req.session.destroy(() => {
        res.clearCookie(process.env.SESSION_NAME || "alento.sid");
        res.clearCookie("connect.sid");
        return res.redirect("/login?reason=senha_alterada");
      });
    } catch (error) {
      console.error("Erro ao alterar senha do perfil:", error);
      req.flash("senhaError", error?.message || "Nao foi possivel alterar a senha.");
      return res.redirect("/perfil?senha=1");
    }
  }

  static async notificacoes(req, res) {
    try {
      const userId = getCurrentUserId(req);
      const perfil = req?.session?.user?.perfil;
      if (!userId) {
        return res.redirect("/login");
      }

      const filtroBase =
        perfil === PERFIS.ADMIN || perfil === PERFIS.SUPERADMIN
          ? {}
          : {
              $or: [
                { atorId: userId },
                { entidade: "usuario", entidadeId: String(userId) },
              ],
            };

      const defaultLimit = perfil === PERFIS.ADMIN || perfil === PERFIS.SUPERADMIN ? 60 : 40;
      const tipoAtual = parseNotificacaoTipo(req.query?.tipo);
      const limitAtual = parseNotificacaoLimit(req.query?.limit, defaultLimit);
      const filtroTipo = buildNotificacaoTipoFiltro(tipoAtual);
      const filtroLista = { ...filtroBase, ...filtroTipo };

      const [docs, totalGeral, totalAlertas] = await Promise.all([
        AuditTrail.find(filtroLista).sort({ createdAt: -1 }).limit(limitAtual).lean(),
        AuditTrail.countDocuments(filtroBase),
        AuditTrail.countDocuments({ ...filtroBase, acao: /FALHA/i }),
      ]);

      const notificacoes = docs.map((item) => {
        const tipo = String(item?.acao || "").includes("FALHA") ? "alert" : "info";
        const resumo = item?.atorNome
          ? `Por ${item.atorNome}`
          : "Evento do sistema";

        return {
          _id: String(item?._id || ""),
          tipo,
          tipoLabel: tipo === "alert" ? "Alerta" : "Informativa",
          titulo: mapActionLabel(item?.acao),
          mensagem: `${resumo} em ${mapEntityLabel(item?.entidade)}${item?.entidadeId ? ` (${String(item.entidadeId).slice(-6)})` : ""}`,
          criadoEm: item?.createdAt || null,
          criadoEmIso: item?.createdAt ? new Date(item.createdAt).toISOString() : "",
          entidadeLabel: mapEntityLabel(item?.entidade),
        };
      });

      const totais = {
        total: totalGeral,
        alertas: totalAlertas,
        informativas: Math.max(totalGeral - totalAlertas, 0),
        listadas: notificacoes.length,
      };

      return res.status(200).render("pages/conta/notificacoes", {
        title: "Notificacoes",
        sectionTitle: "Notificacoes",
        navKey: "notificacoes",
        layout: "partials/app.ejs",
        pageClass: "page-conta-notificacoes",
        notificacoes,
        totais,
        filtros: {
          tipo: tipoAtual,
          limit: limitAtual,
          limitOptions: [10, 20, 40, 60, 100],
        },
      });
    } catch (error) {
      console.error("Erro ao carregar notificacoes:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar notificacoes.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }
}

module.exports = ContaController;


