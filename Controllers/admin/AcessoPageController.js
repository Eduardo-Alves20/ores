const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../../services/domain/UsuarioService");
const { PERFIS } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { registrarAuditoria } = require("../../services/auditService");
const { hasAnyPermission } = require("../../services/accessControlService");

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function escapeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseStatus(value, fallback = "todos") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "pendente" || raw === "aprovado" || raw === "rejeitado") return raw;
  return fallback;
}

function parseTipo(value, fallback = "todos") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "familia" || raw === "voluntario") return raw;
  return fallback;
}

function parsePage(value, fallback = 1) {
  return Math.max(Number.parseInt(String(value || ""), 10) || fallback, 1);
}

function parseLimit(value, fallback = 20) {
  const allowed = new Set([10, 20, 50, 100]);
  const parsed = Number.parseInt(String(value || ""), 10);
  if (allowed.has(parsed)) return parsed;
  return fallback;
}

function isAdmin(req) {
  const user = req?.session?.user || {};
  const perfil = String(user.perfil || "").toLowerCase();
  if (perfil === PERFIS.SUPERADMIN) return true;
  return hasAnyPermission(user.permissions || [], [PERMISSIONS.ACESSOS_APPROVE]);
}

function resolveReturnTo(rawValue, fallbackPath) {
  const raw = String(rawValue || "").trim();
  if (!raw) return fallbackPath;
  if (!raw.startsWith("/")) return fallbackPath;
  if (raw.startsWith("//")) return fallbackPath;
  if (!raw.startsWith("/acessos/")) return fallbackPath;
  return raw;
}

function statusLabel(statusAprovacao) {
  const value = String(statusAprovacao || "aprovado").toLowerCase();
  if (value === "aprovado") return "Aprovado";
  if (value === "rejeitado") return "Rejeitado";
  return "Pendente";
}

function statusClass(statusAprovacao) {
  const value = String(statusAprovacao || "aprovado").toLowerCase();
  if (value === "aprovado") return "status-active";
  if (value === "rejeitado") return "status-inactive";
  return "status-pending";
}

function tipoLabel(tipoCadastro) {
  return String(tipoCadastro || "").toLowerCase() === "familia" ? "Familia" : "Voluntario";
}

function buildPageBase({ title, sectionTitle, navKey }) {
  return {
    title,
    sectionTitle,
    navKey,
    layout: "partials/app.ejs",
    pageClass: "page-acessos",
    extraCss: ["/css/acessos.css"],
    extraJs: ["/js/acessos.js"],
  };
}

async function buildResumoByTipo(tipoCadastro) {
  const base = {
    tipoCadastro,
    perfil: PERFIS.USUARIO,
  };

  const [total, pendentes, aprovados, ativos] = await Promise.all([
    Usuario.countDocuments(base),
    Usuario.countDocuments({ ...base, statusAprovacao: "pendente" }),
    Usuario.countDocuments({
      ...base,
      $or: [{ statusAprovacao: "aprovado" }, { statusAprovacao: { $exists: false } }],
    }),
    Usuario.countDocuments({ ...base, ativo: true }),
  ]);

  return { total, pendentes, aprovados, ativos };
}

class AcessoPageController {
  static async usuariosFamilia(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "familia",
      title: "Usuarios Familia",
      sectionTitle: "Usuarios Familia",
      navKey: "usuarios-familia",
      subtitle: "Familiares cadastrados para eventual acesso ao sistema.",
      basePath: "/acessos/familias",
    });
  }

  static async usuariosVoluntario(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "voluntario",
      title: "Usuarios Voluntario",
      sectionTitle: "Usuarios Voluntario",
      navKey: "usuarios-voluntario",
      subtitle: "Voluntarios com conta e acesso controlado por aprovacao.",
      basePath: "/acessos/voluntarios",
    });
  }

  static async listarPorTipo(req, res, config) {
    try {
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, 20);
      const busca = String(req.query.busca || "").trim().slice(0, 100);
      const status = parseStatus(req.query.status, "todos");
      const ativo = parseBoolean(req.query.ativo);

      const filtro = {
        tipoCadastro: config.tipoCadastro,
        perfil: PERFIS.USUARIO,
      };

      if (busca) {
        const rx = new RegExp(escapeRegex(busca), "i");
        filtro.$or = [
          { nome: rx },
          { email: rx },
          { cpf: rx },
          { telefone: rx },
        ];
      }

      if (status === "pendente") {
        filtro.statusAprovacao = "pendente";
      } else if (status === "rejeitado") {
        filtro.statusAprovacao = "rejeitado";
      } else if (status === "aprovado") {
        filtro.$and = filtro.$and || [];
        filtro.$and.push({
          $or: [{ statusAprovacao: "aprovado" }, { statusAprovacao: { $exists: false } }],
        });
      }

      if (typeof ativo !== "undefined") {
        filtro.ativo = ativo;
      }

      const [resultado, resumo] = await Promise.all([
        Usuario.paginate(filtro, {
          page,
          limit,
          sort: { createdAt: -1 },
          select: "-senha",
          lean: true,
        }),
        buildResumoByTipo(config.tipoCadastro),
      ]);

      const usuarios = (resultado.docs || []).map((doc) => ({
        statusAprovacaoNormalized: String(doc.statusAprovacao || "aprovado").toLowerCase(),
        ...doc,
        statusAprovacaoLabel: statusLabel(doc.statusAprovacao),
        statusAprovacaoClass: statusClass(doc.statusAprovacao),
        tipoCadastroLabel: tipoLabel(doc.tipoCadastro),
      }));

      return res.status(200).render("pages/acessos/lista-tipo", {
        ...buildPageBase({
          title: config.title,
          sectionTitle: config.sectionTitle,
          navKey: config.navKey,
        }),
        subtitle: config.subtitle,
        basePath: config.basePath,
        tipoCadastro: config.tipoCadastro,
        resumo,
        usuarios,
        paginacao: {
          page: resultado.page || 1,
          totalPages: resultado.totalPages || 1,
          totalDocs: resultado.totalDocs || 0,
          hasPrevPage: !!resultado.hasPrevPage,
          hasNextPage: !!resultado.hasNextPage,
          prevPage: resultado.prevPage || 1,
          nextPage: resultado.nextPage || 1,
        },
        filtros: {
          busca,
          status,
          ativo: typeof ativo === "undefined" ? "" : String(ativo),
          limit,
          limitOptions: [10, 20, 50, 100],
        },
        isAdmin: isAdmin(req),
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      console.error("Erro ao carregar tela de usuarios por tipo:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar tela de usuarios.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async aprovacoes(req, res) {
    try {
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, 20);
      const busca = String(req.query.busca || "").trim().slice(0, 100);
      const tipo = parseTipo(req.query.tipo, "todos");

      const filtro = {
        perfil: PERFIS.USUARIO,
        statusAprovacao: "pendente",
      };

      if (tipo !== "todos") {
        filtro.tipoCadastro = tipo;
      }

      if (busca) {
        const rx = new RegExp(escapeRegex(busca), "i");
        filtro.$or = [
          { nome: rx },
          { email: rx },
          { cpf: rx },
          { telefone: rx },
        ];
      }

      const [resultado, totalPendente] = await Promise.all([
        Usuario.paginate(filtro, {
          page,
          limit,
          sort: { createdAt: -1 },
          select: "-senha",
          lean: true,
        }),
        Usuario.countDocuments({ perfil: PERFIS.USUARIO, statusAprovacao: "pendente" }),
      ]);

      const usuarios = (resultado.docs || []).map((doc) => ({
        ...doc,
        tipoCadastroLabel: tipoLabel(doc.tipoCadastro),
      }));

      return res.status(200).render("pages/acessos/aprovacoes", {
        ...buildPageBase({
          title: "Aprovacoes",
          sectionTitle: "Aprovacoes",
          navKey: "aprovacoes",
        }),
        subtitle: "Fila de cadastro pendente para aprovacao do administrador.",
        usuarios,
        totalPendente,
        paginacao: {
          page: resultado.page || 1,
          totalPages: resultado.totalPages || 1,
          totalDocs: resultado.totalDocs || 0,
          hasPrevPage: !!resultado.hasPrevPage,
          hasNextPage: !!resultado.hasNextPage,
          prevPage: resultado.prevPage || 1,
          nextPage: resultado.nextPage || 1,
        },
        filtros: {
          busca,
          tipo,
          limit,
          limitOptions: [10, 20, 50, 100],
        },
        isAdmin: isAdmin(req),
        successMessage: req.flash("success"),
        errorMessage: req.flash("error"),
      });
    } catch (error) {
      console.error("Erro ao carregar tela de aprovacoes:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar aprovacoes.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async aprovar(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const usuarioAtual = await Usuario.findById(id).select("_id tipoCadastro statusAprovacao").lean();
      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      const payload = {
        statusAprovacao: "aprovado",
        motivoAprovacao: "",
      };

      const ativoBody = parseBoolean(req.body?.ativo);
      if (typeof ativoBody !== "undefined") {
        payload.ativo = ativoBody;
      } else if (usuarioAtual.tipoCadastro === "voluntario") {
        payload.ativo = true;
      }

      const usuario = await UsuarioService.atualizar(id, payload, { usuarioId: actorId });
      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: "USUARIO_APROVADO",
        entidade: "usuario",
        entidadeId: id,
        detalhes: {
          tipoCadastro: usuario.tipoCadastro,
          ativo: usuario.ativo,
        },
      });

      req.flash("success", "Cadastro aprovado com sucesso.");
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao aprovar usuario:", error);
      req.flash("error", error?.message || "Erro ao aprovar cadastro.");
      return res.redirect(returnTo);
    }
  }

  static async rejeitar(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const motivo = String(req.body?.motivo || "").trim();
      const usuario = await UsuarioService.atualizar(
        id,
        {
          statusAprovacao: "rejeitado",
          motivoAprovacao: motivo,
          ativo: false,
        },
        { usuarioId: actorId }
      );

      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: "USUARIO_REJEITADO",
        entidade: "usuario",
        entidadeId: id,
        detalhes: {
          motivo: motivo || "",
        },
      });

      req.flash("success", "Cadastro rejeitado e acesso bloqueado.");
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao rejeitar usuario:", error);
      req.flash("error", error?.message || "Erro ao rejeitar cadastro.");
      return res.redirect(returnTo);
    }
  }

  static async alterarStatus(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const ativo = parseBoolean(req.body?.ativo);
      if (typeof ativo === "undefined") {
        req.flash("error", "Campo ativo e obrigatorio.");
        return res.redirect(returnTo);
      }

      const usuario = await UsuarioService.alterarStatus(id, ativo, { usuarioId: actorId });
      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: ativo ? "USUARIO_REATIVADO" : "USUARIO_INATIVADO",
        entidade: "usuario",
        entidadeId: id,
      });

      req.flash("success", ativo ? "Acesso ativado com sucesso." : "Acesso inativado com sucesso.");
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao alterar status de usuario:", error);
      req.flash("error", error?.message || "Erro ao alterar status do usuario.");
      return res.redirect(returnTo);
    }
  }
}

module.exports = AcessoPageController;


