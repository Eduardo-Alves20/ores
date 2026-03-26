const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NO_STORE_CACHE_CONTROL,
  applyDynamicNoStoreHeaders,
} = require("../../middlewares/requestSecurity");

function createMockResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

test("applyDynamicNoStoreHeaders desabilita cache para respostas dinamicas", () => {
  const req = {
    session: {
      user: { id: "507f1f77bcf86cd799439011" },
    },
  };
  const res = createMockResponse();
  let nextArg = "not-called";

  applyDynamicNoStoreHeaders(req, res, (arg) => {
    nextArg = arg;
  });

  assert.equal(nextArg, undefined);
  assert.equal(res.headers["Cache-Control"], NO_STORE_CACHE_CONTROL);
  assert.equal(res.headers.Pragma, "no-cache");
  assert.equal(res.headers.Expires, "0");
  assert.equal(res.headers["Surrogate-Control"], "no-store");
  assert.equal(res.headers.Vary, "Cookie");
});
