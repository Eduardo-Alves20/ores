const UsuarioService = require("../../services/domain/UsuarioService");
const { registrarAuditoria } = require("../../services/auditService");
const { PERFIS } = require("../../config/roles");

function getContext(req) {
  return {
    usuarioId: req?.session?.user?.id || null,
  };
}

function getCurrentProfile(req) {
  return String(req?.session?.user?.perfil || "").trim().toLowerCase();
}

function isSuperAdminRequest(req) {
  return getCurrentProfile(req) === PERFIS.SUPERADMIN;
}

async function ensureManageableTarget(req, id) {
  const usuario = await UsuarioService.buscarPorId(id);
  if (!usuario) return null;

  if (String(usuario.perfil || "").toLowerCase() === PERFIS.SUPERADMIN && !isSuperAdminRequest(req)) {
    const error = new Error("Somente superadmin pode alterar outro superadmin.");
    error.status = 403;
    throw error;
  }

  return usuario;
}

class UsuarioController {
  static async listar(req, res) {
    try {
      const { page, limit, busca, ativo, perfil, sort } = req.query;

      const resultado = await UsuarioService.listar({
        page,
        limit,
        busca,
        ativo,
        perfil,
        sort,
      });

      return res.status(200).json(resultado);
    } catch (error) {
      console.error("Erro ao listar usuarios:", error);
      return res.status(500).json({
        erro: "Erro interno ao listar usuarios.",
      });
    }
  }

  static async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const usuario = await UsuarioService.buscarPorId(id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      return res.status(200).json(usuario);
    } catch (error) {
      console.error("Erro ao buscar usuario por ID:", error);
      return res.status(500).json({
        erro: "Erro interno ao buscar usuario.",
      });
    }
  }

  static async criar(req, res) {
    try {
      const {
        nome,
        email,
        login,
        senha,
        telefone,
        cpf,
        perfil,
        tipoCadastro,
        statusAprovacao,
        motivoAprovacao,
        papelAprovacao,
        ativo,
      } = req.body;

      const requestedPerfil = String(perfil || "").trim().toLowerCase();
      if (requestedPerfil === PERFIS.SUPERADMIN && getCurrentProfile(req) !== PERFIS.SUPERADMIN) {
        return res.status(403).json({
          erro: "Somente superadmin pode criar outro superadmin.",
        });
      }

      const usuario = await UsuarioService.criar(
        {
          nome,
          email,
          login,
          senha,
          telefone,
          cpf,
          perfil,
          tipoCadastro,
          statusAprovacao,
          motivoAprovacao,
          papelAprovacao,
          ativo,
        },
        getContext(req)
      );

      await registrarAuditoria(req, {
        acao: "USUARIO_CRIADO",
        entidade: "usuario",
        entidadeId: usuario?._id,
      });

      return res.status(201).json({
        mensagem: "Usuario criado com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao criar usuario:", error);

      if (error && error.code === 11000) {
        return res.status(409).json({
          erro: "Email, usuario de login ou CPF ja cadastrado.",
          detalhes: error.keyValue,
        });
      }

      return res.status(error.status || 500).json({
        erro: error.message || "Erro interno ao criar usuario.",
      });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;
      const requestedPerfil = String(req.body?.perfil || "").trim().toLowerCase();
      if (requestedPerfil === PERFIS.SUPERADMIN && !isSuperAdminRequest(req)) {
        return res.status(403).json({
          erro: "Somente superadmin pode promover um usuario para superadmin.",
        });
      }

      const alvo = await ensureManageableTarget(req, id);
      if (!alvo) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      const usuario = await UsuarioService.atualizar(id, req.body, getContext(req));

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      await registrarAuditoria(req, {
        acao: "USUARIO_ATUALIZADO",
        entidade: "usuario",
        entidadeId: id,
      });

      return res.status(200).json({
        mensagem: "Usuario atualizado com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao atualizar usuario:", error);

      if (error && error.code === 11000) {
        return res.status(409).json({
          erro: "Email, usuario de login ou CPF ja cadastrado.",
          detalhes: error.keyValue,
        });
      }

      return res.status(error.status || 500).json({
        erro: error.message || "Erro interno ao atualizar usuario.",
      });
    }
  }

  static async atualizarSenha(req, res) {
    try {
      const { id } = req.params;
      const { senha } = req.body;

      if (!senha) {
        return res.status(400).json({
          erro: "Campo senha e obrigatorio.",
        });
      }

      const alvo = await ensureManageableTarget(req, id);
      if (!alvo) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      const usuario = await UsuarioService.atualizarSenha(id, senha, getContext(req));

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      await registrarAuditoria(req, {
        acao: "USUARIO_SENHA_ATUALIZADA",
        entidade: "usuario",
        entidadeId: id,
      });

      return res.status(200).json({
        mensagem: "Senha atualizada com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      return res.status(error.status || 500).json({
        erro: error.message || "Erro interno ao atualizar senha.",
      });
    }
  }

  static async alterarStatus(req, res) {
    try {
      const { id } = req.params;
      const { ativo } = req.body;

      if (typeof ativo === "undefined") {
        return res.status(400).json({
          erro: "Campo ativo e obrigatorio.",
        });
      }

      const alvo = await ensureManageableTarget(req, id);
      if (!alvo) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      const usuario = await UsuarioService.alterarStatus(id, ativo, getContext(req));

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      await registrarAuditoria(req, {
        acao: ativo ? "USUARIO_REATIVADO" : "USUARIO_INATIVADO",
        entidade: "usuario",
        entidadeId: id,
      });

      return res.status(200).json({
        mensagem: "Status atualizado com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao alterar status do usuario:", error);
      return res.status(error.status || 500).json({
        erro: error.message || "Erro interno ao alterar status.",
      });
    }
  }

  static async remover(req, res) {
    try {
      const { id } = req.params;
      const alvo = await ensureManageableTarget(req, id);
      if (!alvo) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      const usuario = await UsuarioService.remover(id, getContext(req));

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuario nao encontrado.",
        });
      }

      await registrarAuditoria(req, {
        acao: "USUARIO_INATIVADO",
        entidade: "usuario",
        entidadeId: id,
      });

      return res.status(200).json({
        mensagem: "Usuario inativado com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao inativar usuario:", error);
      return res.status(error.status || 500).json({
        erro: error.message || "Erro interno ao inativar usuario.",
      });
    }
  }
}

module.exports = UsuarioController;

