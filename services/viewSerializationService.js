const INLINE_SCRIPT_ESCAPE_MAP = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

function serializeForInlineScript(value, fallback = null) {
  const target = typeof value === "undefined" ? fallback : value;
  const serialized = JSON.stringify(target);

  if (typeof serialized !== "string") {
    return "null";
  }

  return serialized.replace(
    /[<>&\u2028\u2029]/g,
    (character) => INLINE_SCRIPT_ESCAPE_MAP[character] || character,
  );
}

module.exports = {
  serializeForInlineScript,
};
