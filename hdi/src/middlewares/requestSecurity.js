const NO_STORE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

function applySecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()"
  );
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
}

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
  applySecurityHeaders,
};
