const Usuario = require("../../schemas/core/Usuario");
const UsuarioService = require("../../services/domain/UsuarioService");
const { PERFIS } = require("../../config/roles");
const {
  VOLUNTARIO_ACCESS_OPTIONS,
  normalizeVolunteerAccessLevel,
  getVolunteerAccessLabel,
} = require("../../config/volunteerAccess");
const { getApprovalRoleLabel } = require("../../config/approvalRoles");
const { registrarAuditoria } = require("../../services/auditService");
const {
  listCustomFields,
  listQuickFilters,
} = require("../../services/systemConfigService");
const {
  buildApprovalRoleOptions,
  buildApprovalWorkflowSummary,
  buildCreateProfileOptions,
  buildPageBase,
  buildResumo,
  canManageTargetUser,
  canManageUsers,
  escapeRegex,
  isAdmin,
  mapApprovalDetail,
  normalizeApprovalVotes,
  parseBoolean,
  parseLimit,
  parsePage,
  parseStatus,
  parseTipo,
  perfilLabel,
  resolveApprovalElectorate,
  resolveReturnTo,
  shouldUseVotingFlow,
  statusClass,
  statusLabel,
  summarizeApprovalVotes,
  tipoLabel,
  tryFinalizeApprovalDecision,
  upsertApprovalVote,
} = require("../../services/admin/acessoPageService");
class AcessoPageController {
  static async usuariosFamilia(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "familia",
      defaultLimit: 10,
      title: "Familias",
      sectionTitle: "Familias",
      navKey: "usuarios-familia",
      subtitle: "Familiares cadastrados para eventual acesso ao sistema.",
      basePath: "/acessos/familias",
    });
  }

  static async usuariosVoluntario(req, res) {
    return AcessoPageController.listarPorTipo(req, res, {
      tipoCadastro: "voluntario",
      showAllUsers: true,
      defaultLimit: 10,
      title: "Voluntarios",
      sectionTitle: "Voluntarios",
      navKey: "usuarios-voluntario",
      subtitle: "Todos os acessos do sistema, inclusive portal, equipe interna e administradores.",
      basePath: "/acessos/voluntarios",
    });
  }

  static async listarPorTipo(req, res, config) {
    try {
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, config.defaultLimit || 20);
      const busca = String(req.query.busca || "").trim().slice(0, 100);
      const status = parseStatus(req.query.status, "todos");
      const ativo = parseBoolean(req.query.ativo);
      const perfilFiltro = String(req.query.perfil || "").trim().toLowerCase();

      const filtro = config.showAllUsers
        ? {}
        : {
            tipoCadastro: config.tipoCadastro,
            perfil: PERFIS.USUARIO,
          };

      if (busca) {
        const rx = new RegExp(escapeRegex(busca), "i");
        filtro.$or = [
          { nome: rx },
          { email: rx },
          { login: rx },
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

      if (perfilFiltro) {
        filtro.perfil = perfilFiltro;
      }

      const quickFilterArea = config.navKey === "usuarios-familia" ? "acessos_familias" : "acessos_voluntarios";
      const [resultado, resumo, customFields, quickFilters] = await Promise.all([
        Usuario.paginate(filtro, {
          page,
          limit,
          sort: { createdAt: -1 },
          select: "-senha",
          lean: true,
        }),
        buildResumo(config),
        listCustomFields("usuario", { includeInactive: false }),
        listQuickFilters(quickFilterArea, { includeInactive: false }),
      ]);

      const usuarios = (resultado.docs || []).map((doc) => ({
        statusAprovacaoNormalized: String(doc.statusAprovacao || "aprovado").toLowerCase(),
        ...doc,
        perfilLabel: perfilLabel(doc.perfil),
        papelAprovacaoLabel: getApprovalRoleLabel(doc.papelAprovacao),
        statusAprovacaoLabel: statusLabel(doc.statusAprovacao),
        statusAprovacaoClass: statusClass(doc.statusAprovacao),
        tipoCadastroLabel: tipoLabel(doc.tipoCadastro),
        nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(doc.nivelAcessoVoluntario),
        canEdit: canManageUsers(req) && canManageTargetUser(req, doc),
        canAdminister: isAdmin(req) && canManageTargetUser(req, doc),
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
        tipoTabs: [
          {
            key: "usuarios-familia",
            label: "Familias",
            href: "/acessos/familias",
            isActive: config.navKey === "usuarios-familia",
          },
          {
            key: "usuarios-voluntario",
            label: "Voluntarios",
            href: "/acessos/voluntarios",
            isActive: config.navKey === "usuarios-voluntario",
          },
        ],
        resumo,
        quickFilters,
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
        canManageUsers: canManageUsers(req),
        createProfileOptions: buildCreateProfileOptions(req),
        volunteerAccessOptions: VOLUNTARIO_ACCESS_OPTIONS,
        customFields,
        approvalRoleOptions: buildApprovalRoleOptions(),
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
      const actorId = req?.session?.user?.id || null;
      const electorate = await resolveApprovalElectorate();
      const page = parsePage(req.query.page, 1);
      const limit = parseLimit(req.query.limit, 10);
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
        nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(doc.nivelAcessoVoluntario),
        votosResumo: summarizeApprovalVotes(doc.votosAprovacao, actorId, electorate.presidentId),
        workflowResumo: buildApprovalWorkflowSummary(doc, electorate),
      }));

      const totalVotos = usuarios.reduce(
        (acc, item) => acc + Number(item?.votosResumo?.total || 0),
        0
      );

      return res.status(200).render("pages/acessos/aprovacoes", {
        ...buildPageBase({
          title: "Aprovacoes",
          sectionTitle: "Aprovacoes",
          navKey: "aprovacoes",
        }),
        subtitle: "Fila de cadastro pendente para aprovacao do admin_alento.",
        usuarios,
        totalPendente,
        totalVotos,
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
        volunteerAccessOptions: VOLUNTARIO_ACCESS_OPTIONS,
        approvalRoleOptions: buildApprovalRoleOptions(),
        approvalElectorate: electorate,
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

  static async detalhe(req, res) {
    try {
      const { id } = req.params;
      const actorId = req?.session?.user?.id || null;
      const electorate = await resolveApprovalElectorate();
      const usuario = await UsuarioService.buscarPorId(id);

      if (!usuario) {
        return res.status(404).json({ erro: "Usuario nao encontrado." });
      }

      return res.status(200).json(await mapApprovalDetail(usuario, actorId, electorate));
    } catch (error) {
      console.error("Erro ao carregar detalhe de aprovacao:", error);
      return res.status(500).json({ erro: "Erro ao carregar a ficha de aprovacao." });
    }
  }

  static async aprovar(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const usuarioAtual = await Usuario.findById(id)
        .select("_id nome perfil tipoCadastro statusAprovacao votosAprovacao nivelAcessoVoluntario")
        .lean();
      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (shouldUseVotingFlow(usuarioAtual)) {
        req.flash("error", "Esse cadastro deve ser decidido pela fila de votacao em Aprovações.");
        return res.redirect(returnTo);
      }

      const nivelAcessoVoluntario = usuarioAtual.tipoCadastro === "voluntario"
        ? normalizeVolunteerAccessLevel(
            req.body?.nivelAcessoVoluntario || usuarioAtual.nivelAcessoVoluntario,
            null
          )
        : null;

      if (usuarioAtual.tipoCadastro === "voluntario" && !nivelAcessoVoluntario) {
        req.flash("error", "Selecione o nivel de acesso do voluntario antes de aprovar.");
        return res.redirect(returnTo);
      }

      const payload = {
        statusAprovacao: "aprovado",
        motivoAprovacao: "",
        votosAprovacao: upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, "aprovar", {
          nivelAcessoVoluntario,
        }),
      };

      if (usuarioAtual.tipoCadastro === "voluntario") {
        payload.nivelAcessoVoluntario = nivelAcessoVoluntario;
      }

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
          nivelAcessoVoluntario: usuario.nivelAcessoVoluntario || "",
        },
      });

      req.flash(
        "success",
        usuario.tipoCadastro === "voluntario"
          ? `Cadastro aprovado com sucesso como ${getVolunteerAccessLabel(usuario.nivelAcessoVoluntario)}.`
          : "Cadastro aprovado com sucesso."
      );
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
      const usuarioAtual = await Usuario.findById(id)
        .select("_id nome perfil statusAprovacao votosAprovacao")
        .lean();
      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (shouldUseVotingFlow(usuarioAtual)) {
        req.flash("error", "Esse cadastro deve ser decidido pela fila de votacao em Aprovações.");
        return res.redirect(returnTo);
      }

      const usuario = await UsuarioService.atualizar(
        id,
        {
          statusAprovacao: "rejeitado",
          motivoAprovacao: motivo,
          ativo: false,
          nivelAcessoVoluntario: null,
          votosAprovacao: upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, "rejeitar", { motivo }),
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

      const usuarioAtual = await Usuario.findById(id).select("_id perfil").lean();
      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (!canManageTargetUser(req, usuarioAtual)) {
        req.flash("error", "Somente superadmin pode alterar status de outro superadmin.");
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

  static async votar(req, res) {
    const { id } = req.params;
    const actorId = req?.session?.user?.id || null;
    const fallback = "/acessos/aprovacoes";
    const returnTo = resolveReturnTo(req.body?.returnTo, fallback);

    try {
      const decisao = String(req.body?.decisao || "").trim().toLowerCase();
      if (!["aprovar", "rejeitar"].includes(decisao)) {
        req.flash("error", "Vote em aprovar ou rejeitar.");
        return res.redirect(returnTo);
      }

      const motivo = String(req.body?.motivo || "").trim();
      const electorate = await resolveApprovalElectorate();

      const usuarioAtual = await Usuario.findById(id)
        .select("_id nome statusAprovacao votosAprovacao tipoCadastro nivelAcessoVoluntario")
        .lean();

      if (!usuarioAtual) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      if (String(usuarioAtual.statusAprovacao || "").toLowerCase() !== "pendente") {
        req.flash("error", "Somente cadastros pendentes podem receber votos.");
        return res.redirect(returnTo);
      }

      const votosAtuais = normalizeApprovalVotes(usuarioAtual.votosAprovacao);
      const votoAtualDoAtor = votosAtuais.find((item) => String(item.adminId) === String(actorId || ""));

      const payload = {
        votosAprovacao: [],
      };

      if (decisao === "aprovar" && usuarioAtual.tipoCadastro === "voluntario") {
        const nivelAcessoVoluntario = normalizeVolunteerAccessLevel(
          req.body?.nivelAcessoVoluntario || votoAtualDoAtor?.nivelAcessoVoluntario,
          null
        );

        if (!nivelAcessoVoluntario) {
          req.flash("error", "Abra a ficha do voluntario e escolha o nivel de acesso antes de votar para aprovar.");
          return res.redirect(returnTo);
        }

        payload.votosAprovacao = upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, decisao, {
          motivo,
          nivelAcessoVoluntario,
        });
      } else {
        payload.votosAprovacao = upsertApprovalVote(usuarioAtual.votosAprovacao, actorId, decisao, {
          motivo,
        });
      }

      const usuario = await UsuarioService.atualizar(
        id,
        payload,
        { usuarioId: actorId }
      );

      if (!usuario) {
        req.flash("error", "Usuario nao encontrado.");
        return res.redirect(returnTo);
      }

      const finalizeResult = await tryFinalizeApprovalDecision(id, actorId, electorate);

      if (finalizeResult.finalized && finalizeResult.usuario) {
        await registrarAuditoria(req, {
          acao:
            finalizeResult.workflowResumo?.finalDecision === "aprovar"
              ? "USUARIO_APROVACAO_AUTOMATICA"
              : "USUARIO_REJEICAO_AUTOMATICA",
          entidade: "usuario",
          entidadeId: id,
          detalhes: {
            nivelAcessoVoluntario: finalizeResult.workflowResumo?.finalLevel || "",
            stateLabel: finalizeResult.workflowResumo?.stateLabel || "",
          },
        });

        req.flash(
          "success",
          finalizeResult.workflowResumo?.finalDecision === "aprovar"
            ? `Voto registrado e cadastro aprovado automaticamente${finalizeResult.workflowResumo?.finalLevel ? ` como ${getVolunteerAccessLabel(finalizeResult.workflowResumo.finalLevel)}` : ""}.`
            : "Voto registrado e cadastro rejeitado automaticamente."
        );
        return res.redirect(returnTo);
      }

      await registrarAuditoria(req, {
        acao: decisao === "aprovar" ? "USUARIO_VOTO_APROVACAO" : "USUARIO_VOTO_REJEICAO",
        entidade: "usuario",
        entidadeId: id,
        detalhes: {
          decisao,
          totalVotos: payload.votosAprovacao.length,
          motivo: motivo || "",
          nivelAcessoVoluntario:
            payload.votosAprovacao.find((item) => String(item.adminId) === String(actorId || ""))?.nivelAcessoVoluntario || "",
        },
      });

      const workflowResumo = buildApprovalWorkflowSummary(usuario, electorate);
      req.flash("success", `Voto registrado. ${workflowResumo.stateLabel}.`);
      return res.redirect(returnTo);
    } catch (error) {
      console.error("Erro ao votar em cadastro:", error);
      req.flash("error", error?.message || "Erro ao registrar voto.");
      return res.redirect(returnTo);
    }
  }
}

module.exports = AcessoPageController;


