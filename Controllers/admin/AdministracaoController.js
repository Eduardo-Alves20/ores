const { AgendaSala } = require("../../schemas/social/AgendaSala");
const { registrarAuditoria } = require("../../services/auditService");
const {
  buildAdministrationSnapshot,
  getAdministrationOptions,
  savePresenceReason,
  togglePresenceReasonStatus,
  saveCustomField,
  toggleCustomFieldStatus,
  saveQuickFilter,
  toggleQuickFilterStatus,
} = require("../../services/systemConfigService");

function getActorId(req) {
  return req?.session?.user?.id || null;
}

function parseBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function mapSala(doc) {
  return {
    _id: String(doc?._id || ""),
    nome: String(doc?.nome || ""),
    descricao: String(doc?.descricao || ""),
    ativo: doc?.ativo !== false,
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
  };
}

async function loadPageContext() {
  const [snapshot, salas] = await Promise.all([
    buildAdministrationSnapshot(),
    AgendaSala.find({})
      .sort({ ativo: -1, nome: 1 })
      .lean(),
  ]);

  return {
    snapshot,
    salas: (salas || []).map(mapSala),
    options: getAdministrationOptions(),
  };
}

class AdministracaoController {
  static async page(req, res) {
    try {
      const context = await loadPageContext();

      return res.status(200).render("pages/admin/administracao", {
        title: "Administracao",
        sectionTitle: "Administracao",
        navKey: "admin",
        layout: "partials/app.ejs",
        pageClass: "page-administracao",
        extraCss: ["/css/administracao.css"],
        extraJs: ["/js/administracao.js"],
        adminSnapshot: context,
      });
    } catch (error) {
      console.error("Erro ao carregar central de administracao:", error);
      return res.status(500).send("Erro ao carregar a central de administracao.");
    }
  }

  static async config(req, res) {
    try {
      const context = await loadPageContext();
      return res.status(200).json(context);
    } catch (error) {
      console.error("Erro ao carregar configuracoes administrativas:", error);
      return res.status(500).json({ erro: "Erro interno ao carregar configuracoes." });
    }
  }

  static async criarJustificativa(req, res) {
    try {
      const justificativa = await savePresenceReason(req.body || {}, getActorId(req));

      await registrarAuditoria(req, {
        acao: "ADMIN_JUSTIFICATIVA_PRESENCA_CRIADA",
        entidade: "configuracao_sistema",
        entidadeId: justificativa._id,
      });

      return res.status(201).json({
        mensagem: "Justificativa de presenca criada com sucesso.",
        justificativa,
      });
    } catch (error) {
      console.error("Erro ao criar justificativa de presenca:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao criar justificativa." });
    }
  }

  static async atualizarJustificativa(req, res) {
    try {
      const justificativa = await savePresenceReason(req.body || {}, getActorId(req), req.params.id);

      await registrarAuditoria(req, {
        acao: "ADMIN_JUSTIFICATIVA_PRESENCA_ATUALIZADA",
        entidade: "configuracao_sistema",
        entidadeId: justificativa._id,
      });

      return res.status(200).json({
        mensagem: "Justificativa de presenca atualizada com sucesso.",
        justificativa,
      });
    } catch (error) {
      console.error("Erro ao atualizar justificativa de presenca:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao atualizar justificativa." });
    }
  }

  static async alterarStatusJustificativa(req, res) {
    try {
      const ativo = parseBoolean(req.body?.ativo);
      if (typeof ativo === "undefined") {
        return res.status(400).json({ erro: "Campo ativo e obrigatorio." });
      }

      const justificativa = await togglePresenceReasonStatus(req.params.id, ativo, getActorId(req));

      await registrarAuditoria(req, {
        acao: ativo ? "ADMIN_JUSTIFICATIVA_PRESENCA_REATIVADA" : "ADMIN_JUSTIFICATIVA_PRESENCA_INATIVADA",
        entidade: "configuracao_sistema",
        entidadeId: justificativa._id,
      });

      return res.status(200).json({
        mensagem: "Status da justificativa atualizado com sucesso.",
        justificativa,
      });
    } catch (error) {
      console.error("Erro ao alterar status da justificativa de presenca:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao alterar justificativa." });
    }
  }

  static async criarCampo(req, res) {
    try {
      const campo = await saveCustomField(req.body || {}, getActorId(req));

      await registrarAuditoria(req, {
        acao: "ADMIN_CAMPO_EXTRA_CRIADO",
        entidade: "configuracao_sistema",
        entidadeId: campo._id,
      });

      return res.status(201).json({
        mensagem: "Campo extra criado com sucesso.",
        campo,
      });
    } catch (error) {
      console.error("Erro ao criar campo extra:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao criar campo extra." });
    }
  }

  static async atualizarCampo(req, res) {
    try {
      const campo = await saveCustomField(req.body || {}, getActorId(req), req.params.id);

      await registrarAuditoria(req, {
        acao: "ADMIN_CAMPO_EXTRA_ATUALIZADO",
        entidade: "configuracao_sistema",
        entidadeId: campo._id,
      });

      return res.status(200).json({
        mensagem: "Campo extra atualizado com sucesso.",
        campo,
      });
    } catch (error) {
      console.error("Erro ao atualizar campo extra:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao atualizar campo extra." });
    }
  }

  static async alterarStatusCampo(req, res) {
    try {
      const ativo = parseBoolean(req.body?.ativo);
      if (typeof ativo === "undefined") {
        return res.status(400).json({ erro: "Campo ativo e obrigatorio." });
      }

      const campo = await toggleCustomFieldStatus(req.params.id, ativo, getActorId(req));

      await registrarAuditoria(req, {
        acao: ativo ? "ADMIN_CAMPO_EXTRA_REATIVADO" : "ADMIN_CAMPO_EXTRA_INATIVADO",
        entidade: "configuracao_sistema",
        entidadeId: campo._id,
      });

      return res.status(200).json({
        mensagem: "Status do campo extra atualizado com sucesso.",
        campo,
      });
    } catch (error) {
      console.error("Erro ao alterar status do campo extra:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao alterar campo extra." });
    }
  }

  static async criarFiltro(req, res) {
    try {
      const filtro = await saveQuickFilter(req.body || {}, getActorId(req));

      await registrarAuditoria(req, {
        acao: "ADMIN_FILTRO_RAPIDO_CRIADO",
        entidade: "configuracao_sistema",
        entidadeId: filtro._id,
      });

      return res.status(201).json({
        mensagem: "Filtro rapido criado com sucesso.",
        filtro,
      });
    } catch (error) {
      console.error("Erro ao criar filtro rapido:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao criar filtro rapido." });
    }
  }

  static async atualizarFiltro(req, res) {
    try {
      const filtro = await saveQuickFilter(req.body || {}, getActorId(req), req.params.id);

      await registrarAuditoria(req, {
        acao: "ADMIN_FILTRO_RAPIDO_ATUALIZADO",
        entidade: "configuracao_sistema",
        entidadeId: filtro._id,
      });

      return res.status(200).json({
        mensagem: "Filtro rapido atualizado com sucesso.",
        filtro,
      });
    } catch (error) {
      console.error("Erro ao atualizar filtro rapido:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao atualizar filtro rapido." });
    }
  }

  static async alterarStatusFiltro(req, res) {
    try {
      const ativo = parseBoolean(req.body?.ativo);
      if (typeof ativo === "undefined") {
        return res.status(400).json({ erro: "Campo ativo e obrigatorio." });
      }

      const filtro = await toggleQuickFilterStatus(req.params.id, ativo, getActorId(req));

      await registrarAuditoria(req, {
        acao: ativo ? "ADMIN_FILTRO_RAPIDO_REATIVADO" : "ADMIN_FILTRO_RAPIDO_INATIVADO",
        entidade: "configuracao_sistema",
        entidadeId: filtro._id,
      });

      return res.status(200).json({
        mensagem: "Status do filtro rapido atualizado com sucesso.",
        filtro,
      });
    } catch (error) {
      console.error("Erro ao alterar status do filtro rapido:", error);
      return res.status(error.status || 500).json({ erro: error.message || "Erro interno ao alterar filtro rapido." });
    }
  }
}

module.exports = AdministracaoController;
