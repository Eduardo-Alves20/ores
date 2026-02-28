const jwt = require("jsonwebtoken");

function verificarUsuarioLogado(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: "Token não informado." });
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ erro: "Token inválido." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // opcional: disponibiliza dados do usuário para as próximas rotas
    req.usuario = payload;

    return next();
  } catch (error) {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

module.exports = verificarUsuarioLogado;