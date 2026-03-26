async function isAuthenticated(req, res, next) {
  if (req.session?.user?._id) {
    req.session.redirectTo = req.originalUrl;
    return next();
  }
  res.redirect("/login")
}

module.exports = isAuthenticated;
