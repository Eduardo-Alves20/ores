const { buildOnlineUsersWidget } = require("../../services/admin/onlineUsersWidgetService");

class OnlineUsersPageController {
  static async index(req, res) {
    try {
      const onlineUsersWidget = await buildOnlineUsersWidget({
        enabled: true,
        currentSessionUser: req?.session?.user || null,
      });

      return res.status(200).render("pages/painel/usuarios-online", {
        title: "Usuarios online",
        sectionTitle: "Usuarios online",
        navKey: "usuarios-online",
        layout: "partials/app.ejs",
        pageClass: "page-online-users",
        extraCss: ["/css/online-users.css"],
        onlineUsers: onlineUsersWidget,
      });
    } catch (error) {
      console.error("Erro ao carregar usuarios online:", error);
      return res.status(500).render("pages/painel/usuarios-online", {
        title: "Usuarios online",
        sectionTitle: "Usuarios online",
        navKey: "usuarios-online",
        layout: "partials/app.ejs",
        pageClass: "page-online-users",
        extraCss: ["/css/online-users.css"],
        onlineUsers: {
          enabled: true,
          total: 0,
          items: [],
          windowMinutes: Number(process.env.ONLINE_USERS_WINDOW_MINUTES || 10),
          generatedAt: new Date().toISOString(),
          emptyMessage: "Nao foi possivel carregar os usuarios online agora.",
        },
      });
    }
  }
}

module.exports = OnlineUsersPageController;
