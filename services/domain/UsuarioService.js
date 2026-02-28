const Usuario = require("../../schemas/Usuario");

class UsuarioService {
  static async listar({ page = 1, limit = 10, busca = "", ativo, perfil, sort = "-createdAt" }) {
    const filtro = {};

    if (busca) {
      filtro.$or = [
        { nome: { $regex: busca, $options: "i" } },
        { email: { $regex: busca, $options: "i" } },
        { cpf: { $regex: busca, $options: "i" } },
      ];
    }

    if (typeof ativo !== "undefined") {
      if (ativo === "true" || ativo === true) filtro.ativo = true;
      if (ativo === "false" || ativo === false) filtro.ativo = false;
    }

    if (perfil) {
      filtro.perfil = perfil;
    }

    return Usuario.paginate(filtro, {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      sort,
      select: "-senha",
      lean: true,
    });
  }

  static async buscarPorId(id) {
    return Usuario.findById(id).select("-senha");
  }

  static async buscarPorEmail(email) {
    return Usuario.findOne({ email: String(email).toLowerCase().trim() }).select("+senha");
  }

  static async criar(dados) {
    const payload = {
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha, // se quiser hash, te mando depois com bcrypt
      telefone: dados.telefone,
      cpf: dados.cpf,
      perfil: dados.perfil,
      ativo: typeof dados.ativo === "undefined" ? true : dados.ativo,
      ultimoLoginEm: dados.ultimoLoginEm || null,
    };

    const usuario = await Usuario.create(payload);

    return Usuario.findById(usuario._id).select("-senha");
  }

  static async atualizar(id, dados) {
    const payload = {
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      cpf: dados.cpf,
      perfil: dados.perfil,
      ativo: dados.ativo,
      ultimoLoginEm: dados.ultimoLoginEm,
    };

    // remove campos undefined para não sobrescrever sem querer
    Object.keys(payload).forEach((key) => {
      if (typeof payload[key] === "undefined") delete payload[key];
    });

    return Usuario.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).select("-senha");
  }

  static async atualizarSenha(id, novaSenha) {
    return Usuario.findByIdAndUpdate(
      id,
      { senha: novaSenha },
      { new: true, runValidators: true }
    ).select("-senha");
  }

  static async remover(id) {
    return Usuario.findByIdAndDelete(id).select("-senha");
  }

  static async alterarStatus(id, ativo) {
    return Usuario.findByIdAndUpdate(
      id,
      { ativo: !!ativo },
      { new: true, runValidators: true }
    ).select("-senha");
  }
}

module.exports = UsuarioService;