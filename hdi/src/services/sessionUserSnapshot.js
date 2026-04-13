function buildSessionUserSnapshot(user = null) {
  if (!user || typeof user !== "object") return null;

  const groups = Array.isArray(user.groups)
    ? Array.from(
        new Set(
          user.groups
            .map((item) => String(item || "").trim())
            .filter(Boolean)
        )
      ).slice(0, 64)
    : [];

  return {
    _id: String(user._id || user.id || "").trim(),
    email: String(user.email || "").trim().toLowerCase(),
    groups,
    name: String(user.name || "").trim(),
    username: String(user.username || "").trim(),
  };
}

module.exports = {
  buildSessionUserSnapshot,
};
