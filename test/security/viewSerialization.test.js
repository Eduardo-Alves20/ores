const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ejs = require("ejs");

const {
  serializeForInlineScript,
} = require("../../services/shared/viewSerializationService");

const viewsDir = path.resolve(__dirname, "..", "..", "views");

function buildSeoStub(_, overrides = {}) {
  return {
    title: overrides.title || "Teste",
    description: overrides.description || "Descricao",
    robots: overrides.noindex ? "noindex,nofollow" : "index,follow",
    themeColor: overrides.themeColor || "#ffffff",
    canonicalUrl: "https://example.com/teste",
    locale: "pt_BR",
    type: overrides.type || "website",
    siteName: "GESA",
    imageUrl: "https://example.com/og.png",
    imageAlt: overrides.imageAlt || "Imagem",
    schemas: Array.isArray(overrides.schemas) ? overrides.schemas : [],
  };
}

test("serializeForInlineScript escapa caracteres perigosos para script inline", () => {
  const serialized = serializeForInlineScript({
    text: "</script><script>alert(1)</script>\u2028\u2029<&>",
  });

  assert.match(
    serialized,
    /\\u003c\/script\\u003e\\u003cscript\\u003ealert\(1\)\\u003c\/script\\u003e\\u2028\\u2029\\u003c\\u0026\\u003e/,
  );
  assert.doesNotMatch(
    serialized,
    /<\/script><script>alert\(1\)<\/script>/,
  );
});

test("seo.ejs serializa schema JSON-LD sem permitir breakout de script", async () => {
  const html = await ejs.renderFile(
    path.join(viewsDir, "partials", "seo.ejs"),
    {
      title: "SEO",
      serializeForInlineScript,
      buildSeo: (_, overrides = {}) =>
        buildSeoStub(_, {
          ...overrides,
          schemas: [
            {
              "@context": "https://schema.org",
              headline: '</script><script>alert("xss")</script>',
            },
          ],
        }),
    },
    { async: true },
  );

  assert.match(
    html,
    /"headline":"\\u003c\/script\\u003e\\u003cscript\\u003ealert\(\\"xss\\"\)\\u003c\/script\\u003e"/,
  );
  assert.doesNotMatch(
    html,
    /"headline":"<\/script><script>alert\("xss"\)<\/script>"/,
  );
});

test("login.ejs serializa flash inline sem injetar HTML executavel", async () => {
  const html = await ejs.renderFile(
    path.join(viewsDir, "partials", "login.ejs"),
    {
      title: "Login",
      body: "",
      pageClass: "",
      csrfToken: "",
      csrfHeaderName: "X-CSRF-Token",
      csrfFieldName: "_csrf",
      assetVersion: "1",
      buildSeo: buildSeoStub,
      serializeForInlineScript,
      successMessage: '</script><script>alert("flash")</script>',
    },
    { async: true },
  );

  assert.match(
    html,
    /<script[^>]*id="app-flash-data"[^>]*type="application\/json"[^>]*>\{"success":\["\\u003c\/script\\u003e\\u003cscript\\u003ealert\(\\"flash\\"\)\\u003c\/script\\u003e"\],"error":\[\],"warning":\[\],"info":\[\]\}<\/script>/,
  );
  assert.doesNotMatch(
    html,
    /<script[^>]*id="app-flash-data"[^>]*>\{"success":\["<\/script><script>alert\("flash"\)<\/script>"\]/,
  );
});
