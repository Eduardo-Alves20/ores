const { registrarAuditoria } = require("../../services/auditService");
const {
  changeManagedUserStatus,
  createManagedUser,
  deactivateManagedUser,
  getActorContext,
  getCurrentProfile,
  listManagedUsers,
  loadManagedUserById,
  resetManagedUserPassword,
  updateManagedUser,
} = require("../../services/admin/user/userAdminService");

function respondJsonError(res, logMessage, fallbackMessage, error) {
  console.error(logMessage, error);

  if (error?.code === 11000) {
    return res.status(409).json({
      erro: "Email, usuario de login ou CPF ja cadastrado.",
      detalhes: error.keyValue,
    });
  }

  return res.status(error?.status || 500).json({
    erro: error?.message || fallbackMessage,
  });
}

function respondNotFound(res, message = "Usuario nao encontrado.") {
  return res.status(404).json({
    erro: message,
  });
}

async function respondWithAuditedResult(req, res, statusCode, result) {
  if (!result?.usuario) {
    return respondNotFound(res);
  }

  if (result.audit) {
    await registrarAuditoria(req, result.audit);
  }

  return res.status(statusCode).json({
    mensagem: result.mensagem,
    usuario: result.usuario,
  });
}

class UsuarioController {
  static async listar(req, res) {
    try {
      return res.status(200).json(await listManagedUsers(req.query || {}));
    } catch (error) {
      return respondJsonError(
        res,
        "Erro ao listar usuarios:",
        "Erro interno ao listar usuarios.",
        error
      );
    }
  }

  static async buscarPorId(req, res) {
    try {
      const usuario = await loadManagedUserById(req.params?.id);

      if (!usuario) {
        return respondNotFound(res);
      }

      return res.status(200).json(usuario);
    } catch (error) {
      return respondJsonError(
        res,
        "Erro ao buscar usuario por ID:",
        "Erro interno ao buscar usuario.",
        error
      );
    }
  }

  static async criar(req, res) {
    try {
      return respondWithAuditedResult(
        req,
        res,
        201,
        await createManagedUser({
          body: req.body || {},
          actorContext: getActorContext(req),
          currentProfile: getCurrentProfile(req),
        })
      );
    } catch (error) {
      return respondJsonError(
        res,
        "Erro ao criar usuario:",
        "Erro interno ao criar usuario.",
        error
      );
    }
  }

  static async atualizar(req, res) {
    try {
      return respondWithAuditedResult(
        req,
        res,
        200,
        await updateManagedUser({
          id: req.params?.id,
          body: req.body || {},
          actorContext: getActorContext(req),
          currentProfile: getCurrentProfile(req),
        })
      );
    } catch (error) {
      return respondJsonError(
        res,
        "Erro ao atualizar usuario:",
        "Erro interno ao atualizar usuario.",
        error
      );
    }
  }

  static async atualizarSenha(req, res) {
    try {
      return respondWithAuditedResult(
        req,
        res,
        200,
        await resetManagedUserPassword({
          id: req.params?.id,
          body: req.body || {},
          actorContext: getActorContext(req),
          currentProfile: getCurrentProfile(req),
        })
      );
    } catch (error) {
      return respondJsonError(
        res,
        "Erro ao atualizar senha:",
        "Erro interno ao atualizar senha.",
        error
      );
    }
  }

  static async alterarStatus(req, res) {
    try {
      return respondWithAuditedResult(
        req,
        res,
        200,
        await changeManagedUserStatus({
          id: req.params?.id,
          body: req.body || {},
          actorContext: getActorContext(req),
          currentProfile: getCurrentProfile(req),
        })
      );
    } catch (error) {
      return respondJsonError(
        res,
        "Erro ao alterar status do usuario:",
        "Erro interno ao alterar status.",
        error
      );
    }
  }

  static async remover(req, res) {
    try {
      return respondWithAuditedResult(
        req,
        res,
        200,
        await deactivateManagedUser({
          id: req.params?.id,
          actorContext: getActorContext(req),
          currentProfile: getCurrentProfile(req),
        })
      );
    } catch (error) {
      return respondJsonError(
        res,
        "Erro ao inativar usuario:",
        "Erro interno ao inativar usuario.",
        error
      );
    }
  }
}

module.exports = UsuarioController;
