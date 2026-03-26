const NO_STORE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

function applyDynamicNoStoreHeaders(req, res, next) {
  res.setHeader("Cache-Control", NO_STORE_CACHE_CONTROL);
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  if (req?.session?.user) {
    res.setHeader("Vary", "Cookie");
  }

  next();
}

module.exports = {
  NO_STORE_CACHE_CONTROL,
  applyDynamicNoStoreHeaders,
};
