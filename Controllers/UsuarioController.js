const UsuarioService = require("../services/domain/UsuarioService");

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
      console.error("Erro ao listar usuários:", error);
      return res.status(500).json({
        erro: "Erro interno ao listar usuários.",
      });
    }
  }

  static async buscarPorId(req, res) {
    try {
      const { id } = req.params;

      const usuario = await UsuarioService.buscarPorId(id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado.",
        });
      }

      return res.status(200).json(usuario);
    } catch (error) {
      console.error("Erro ao buscar usuário por ID:", error);
      return res.status(500).json({
        erro: "Erro interno ao buscar usuário.",
      });
    }
  }

  static async criar(req, res) {
    try {
      const { nome, email, senha, telefone, cpf, perfil, ativo } = req.body;

      if (!nome || !email || !senha) {
        return res.status(400).json({
          erro: "Campos obrigatórios: nome, email e senha.",
        });
      }

      const usuario = await UsuarioService.criar({
        nome,
        email,
        senha,
        telefone,
        cpf,
        perfil,
        ativo,
      });

      return res.status(201).json({
        mensagem: "Usuário criado com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao criar usuário:", error);

      if (error && error.code === 11000) {
        return res.status(409).json({
          erro: "Email ou CPF já cadastrado.",
          detalhes: error.keyValue,
        });
      }

      return res.status(500).json({
        erro: "Erro interno ao criar usuário.",
      });
    }
  }

  static async atualizar(req, res) {
    try {
      const { id } = req.params;

      const usuario = await UsuarioService.atualizar(id, req.body);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado.",
        });
      }

      return res.status(200).json({
        mensagem: "Usuário atualizado com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);

      if (error && error.code === 11000) {
        return res.status(409).json({
          erro: "Email ou CPF já cadastrado.",
          detalhes: error.keyValue,
        });
      }

      return res.status(500).json({
        erro: "Erro interno ao atualizar usuário.",
      });
    }
  }

  static async atualizarSenha(req, res) {
    try {
      const { id } = req.params;
      const { senha } = req.body;

      if (!senha) {
        return res.status(400).json({
          erro: "Campo senha é obrigatório.",
        });
      }

      const usuario = await UsuarioService.atualizarSenha(id, senha);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado.",
        });
      }

      return res.status(200).json({
        mensagem: "Senha atualizada com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      return res.status(500).json({
        erro: "Erro interno ao atualizar senha.",
      });
    }
  }

  static async alterarStatus(req, res) {
    try {
      const { id } = req.params;
      const { ativo } = req.body;

      if (typeof ativo === "undefined") {
        return res.status(400).json({
          erro: "Campo ativo é obrigatório.",
        });
      }

      const usuario = await UsuarioService.alterarStatus(id, ativo);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado.",
        });
      }

      return res.status(200).json({
        mensagem: "Status atualizado com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao alterar status do usuário:", error);
      return res.status(500).json({
        erro: "Erro interno ao alterar status.",
      });
    }
  }

  static async remover(req, res) {
    try {
      const { id } = req.params;

      const usuario = await UsuarioService.remover(id);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado.",
        });
      }

      return res.status(200).json({
        mensagem: "Usuário removido com sucesso.",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
      return res.status(500).json({
        erro: "Erro interno ao remover usuário.",
      });
    }
  }
}

module.exports = UsuarioController;