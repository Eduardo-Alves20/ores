const UsuarioService = require("../services/domain/UsuarioService");
const { PERFIS } = require("../config/roles");

function mapTipoCadastroLabel(tipoCadastro) {
  if (tipoCadastro === "familia") return "Familia";
  return "Voluntario";
}

class PortalUsuarioController {
  static async meusDados(req, res) {
    try {
      const userId = req?.session?.user?.id;
      const perfil = req?.session?.user?.perfil;
      if (!userId) {
        return res.redirect("/login");
      }

      if (perfil !== PERFIS.USUARIO) {
        return res.redirect("/painel");
      }

      const usuario = await UsuarioService.buscarPorId(userId);
      if (!usuario) {
        return res.redirect("/login");
      }

      return res.status(200).render("pages/usuario/meus-dados", {
        title: "Meus Dados",
        sectionTitle: "Meus Dados",
        navKey: "meus-dados",
        layout: "partials/app.ejs",
        pageClass: "page-usuario-meus-dados",
        usuario,
        tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
      });
    } catch (error) {
      console.error("Erro ao carregar meus dados:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar seus dados.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }
}

module.exports = PortalUsuarioController;
