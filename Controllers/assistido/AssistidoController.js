const { registrarAuditoria } = require("../../services/shared/auditService");
const { lookupAddressByCep } = require("../../services/shared/cepLookupService");
const {
  getActorId,
  getSessionUser,

  criarAssistido,
  salvarDadosPessoais,
  salvarEndereco,
  confirmarCadastro,
  alterarStatusAssistido,
  uploadAnexosAssistido,
  abrirAnexoAssistido,

  listarAssistidos,
  detalharAssistido,
  listarVersionsAnamnese,
  listarVersionsEntrevista,

  criarAnamnese,
  buscarAnamneseAtual,
  buscarAnamnese,

  criarEntrevista,
  buscarEntrevistaAtual,
  buscarEntrevista,
} = require("../../services/assistido/assistidoApiService");
const {
  createAttendanceForAssistido,
  listAttendancesByAssistido,
  updateAttendance,
  changeAttendanceStatus,
} = require("../../services/assistido/api/atendimentoAssistidoService");

function respondError(res, logMsg, fallback, error) {
  console.error(logMsg, error);
  return res.status(error?.status || 500).json({ erro: error?.message || fallback });
}

function respondNotFound(res) {
  return res.status(404).json({ erro: "Assistido não encontrado." });
}

async function respondWithAudit(req, res, statusCode, result, key = "assistido") {
  if (!result?.[key]) return respondNotFound(res);
  if (result.audit) await registrarAuditoria(req, result.audit);
  const doc = result[key]?.toObject ? result[key].toObject({ flattenMaps: true }) : result[key];
  return res.status(statusCode).json({ mensagem: result.mensagem, [key]: doc });
}

class AssistidoController {
  // ── Utilitário ─────────────────────────────────────────────────────────

  static async buscarCep(req, res) {
    try {
      return res.status(200).json(await lookupAddressByCep(req.params?.cep));
    } catch (error) {
      return respondError(res, "Erro ao consultar CEP:", "Erro interno ao consultar CEP.", error);
    }
  }

  // ── Listagem e detalhe ─────────────────────────────────────────────────

  static async listar(req, res) {
    try {
      return res.status(200).json(await listarAssistidos({ query: req.query || {} }));
    } catch (error) {
      return respondError(res, "Erro ao listar assistidos:", "Erro interno ao listar assistidos.", error);
    }
  }

  static async detalhar(req, res) {
    try {
      const resultado = await detalharAssistido({ assistidoId: req.params?.id });
      if (!resultado?.assistido) return respondNotFound(res);
      const assistido = resultado.assistido.toObject?.({ flattenMaps: true }) ?? resultado.assistido;
      return res.status(200).json({
        assistido,
        anamneseAtual: resultado.anamneseAtual,
        entrevistaAtual: resultado.entrevistaAtual,
      });
    } catch (error) {
      return respondError(res, "Erro ao detalhar assistido:", "Erro interno ao detalhar assistido.", error);
    }
  }

  // ── Fluxo do wizard ────────────────────────────────────────────────────

  static async iniciarCadastro(req, res) {
    try {
      const result = await criarAssistido({ actorId: getActorId(req) });
      await respondWithAudit(req, res, 201, result);
    } catch (error) {
      return respondError(res, "Erro ao criar rascunho:", "Erro interno ao iniciar cadastro.", error);
    }
  }

  static async salvarDadosPessoais(req, res) {
    try {
      const result = await salvarDadosPessoais({
        actorId: getActorId(req),
        assistidoId: req.params?.id,
        body: req.body || {},
      });
      await respondWithAudit(req, res, 200, result);
    } catch (error) {
      return respondError(res, "Erro ao salvar dados pessoais:", "Erro interno.", error);
    }
  }

  static async salvarEndereco(req, res) {
    try {
      const result = await salvarEndereco({
        actorId: getActorId(req),
        assistidoId: req.params?.id,
        body: req.body || {},
      });
      await respondWithAudit(req, res, 200, result);
    } catch (error) {
      return respondError(res, "Erro ao salvar endereço:", "Erro interno.", error);
    }
  }

  static async confirmarCadastro(req, res) {
    try {
      const result = await confirmarCadastro({
        actorId: getActorId(req),
        assistidoId: req.params?.id,
      });
      await respondWithAudit(req, res, 200, result);
    } catch (error) {
      return respondError(res, "Erro ao confirmar cadastro:", "Erro interno.", error);
    }
  }

  static async alterarStatus(req, res) {
    try {
      const result = await alterarStatusAssistido({
        actorId: getActorId(req),
        assistidoId: req.params?.id,
        ativoInput: req.body?.ativo,
      });
      await respondWithAudit(req, res, 200, result);
    } catch (error) {
      return respondError(res, "Erro ao alterar status:", "Erro interno.", error);
    }
  }

  // ── Anamnese ───────────────────────────────────────────────────────────

  static async listarAnamneses(req, res) {
    try {
      const fichas = await listarVersionsAnamnese({ assistidoId: req.params?.id });
      return res.status(200).json({ fichas });
    } catch (error) {
      return respondError(res, "Erro ao listar anamneses:", "Erro interno.", error);
    }
  }

  static async buscarAnamneseAtual(req, res) {
    try {
      const ficha = await buscarAnamneseAtual({ assistidoId: req.params?.id });
      return res.status(200).json({ ficha });
    } catch (error) {
      return respondError(res, "Erro ao buscar anamnese:", "Erro interno.", error);
    }
  }

  static async buscarAnamnesePorVersao(req, res) {
    try {
      const ficha = await buscarAnamnese({
        assistidoId: req.params?.id,
        versao: req.params?.versao,
      });
      return res.status(200).json({ ficha });
    } catch (error) {
      return respondError(res, "Erro ao buscar versão de anamnese:", "Erro interno.", error);
    }
  }

  static async criarAnamnese(req, res) {
    try {
      const result = await criarAnamnese({
        actorId: getActorId(req),
        assistidoId: req.params?.id,
        body: req.body || {},
      });
      if (result.audit) await registrarAuditoria(req, result.audit);
      return res.status(201).json({ mensagem: result.mensagem, ficha: result.ficha });
    } catch (error) {
      return respondError(res, "Erro ao salvar anamnese:", "Erro interno.", error);
    }
  }

  // ── Entrevista Social ──────────────────────────────────────────────────

  static async listarEntrevistas(req, res) {
    try {
      const entrevistas = await listarVersionsEntrevista({ assistidoId: req.params?.id });
      return res.status(200).json({ entrevistas });
    } catch (error) {
      return respondError(res, "Erro ao listar entrevistas:", "Erro interno.", error);
    }
  }

  static async buscarEntrevistaAtual(req, res) {
    try {
      const entrevista = await buscarEntrevistaAtual({ assistidoId: req.params?.id });
      return res.status(200).json({ entrevista });
    } catch (error) {
      return respondError(res, "Erro ao buscar entrevista:", "Erro interno.", error);
    }
  }

  static async buscarEntrevistaPorVersao(req, res) {
    try {
      const entrevista = await buscarEntrevista({
        assistidoId: req.params?.id,
        versao: req.params?.versao,
      });
      return res.status(200).json({ entrevista });
    } catch (error) {
      return respondError(res, "Erro ao buscar versão de entrevista:", "Erro interno.", error);
    }
  }

  static async criarEntrevista(req, res) {
    try {
      const result = await criarEntrevista({
        actorId: getActorId(req),
        assistidoId: req.params?.id,
        body: req.body || {},
      });
      if (result.audit) await registrarAuditoria(req, result.audit);
      return res.status(201).json({ mensagem: result.mensagem, entrevista: result.entrevista });
    } catch (error) {
      return respondError(res, "Erro ao salvar entrevista:", "Erro interno.", error);
    }
  }

  // ── Anexos ─────────────────────────────────────────────────────────────

  static async uploadAnexos(req, res) {
    try {
      const result = await uploadAnexosAssistido({
        actorId: getActorId(req),
        assistidoId: req.params?.id,
        files: req.files || [],
      });
      if (result.audit) await registrarAuditoria(req, result.audit);
      return res.status(200).json({ mensagem: result.mensagem, anexos: result.anexos });
    } catch (error) {
      return respondError(res, "Erro ao fazer upload:", "Erro interno ao enviar anexos.", error);
    }
  }

  static async visualizarAnexo(req, res) {
    try {
      const { anexo, fullPath } = await abrirAnexoAssistido({
        assistidoId: req.params?.id,
        attachmentId: req.params?.attachmentId,
      });

      const previewMimes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
      const disposition = previewMimes.has(anexo.mimeType) ? "inline" : "attachment";

      res.setHeader("Content-Type", anexo.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `${disposition}; filename="${anexo.originalName}"`);

      const { createReadStream } = require("fs");
      createReadStream(fullPath).pipe(res);
    } catch (error) {
      return respondError(res, "Erro ao visualizar anexo:", "Erro interno ao abrir anexo.", error);
    }
  }

  // ── Atendimentos ───────────────────────────────────────────────────────

  static async listarAtendimentos(req, res) {
    try {
      return res.status(200).json(
        await listAttendancesByAssistido({
          user: getSessionUser(req),
          assistidoId: req.params?.id,
          query: req.query || {},
        })
      );
    } catch (error) {
      return respondError(res, "Erro ao listar atendimentos:", "Erro interno ao listar atendimentos.", error);
    }
  }

  static async criarAtendimento(req, res) {
    try {
      const result = await createAttendanceForAssistido({
        user: getSessionUser(req),
        actorId: getActorId(req),
        assistidoId: req.params?.id,
        body: req.body || {},
      });
      return respondWithAudit(req, res, 201, result, "atendimento");
    } catch (error) {
      return respondError(res, "Erro ao registrar atendimento:", "Erro interno ao registrar atendimento.", error);
    }
  }

  static async atualizarAtendimento(req, res) {
    try {
      const result = await updateAttendance({
        user: getSessionUser(req),
        actorId: getActorId(req),
        id: req.params?.atendimentoId,
        body: req.body || {},
      });
      if (!result) return res.status(404).json({ erro: "Atendimento nao encontrado." });
      return respondWithAudit(req, res, 200, result, "atendimento");
    } catch (error) {
      return respondError(res, "Erro ao atualizar atendimento:", "Erro interno ao atualizar atendimento.", error);
    }
  }

  static async alterarStatusAtendimento(req, res) {
    try {
      const result = await changeAttendanceStatus({
        user: getSessionUser(req),
        actorId: getActorId(req),
        id: req.params?.atendimentoId,
        ativoInput: req.body?.ativo,
      });
      if (!result) return res.status(404).json({ erro: "Atendimento nao encontrado." });
      return respondWithAudit(req, res, 200, result, "atendimento");
    } catch (error) {
      return respondError(res, "Erro ao alterar status do atendimento:", "Erro interno.", error);
    }
  }
}

module.exports = AssistidoController;
