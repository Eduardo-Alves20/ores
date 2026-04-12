const test = require("node:test");
const assert = require("node:assert/strict");

const UsuarioService = require("../../services/domain/UsuarioService");
const AuditTrail = require("../../schemas/core/AuditTrail");
const AuthController = require("../../Controllers/auth/AuthController");

function createJsonResponseMock() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

test("AuthController.cadastro exige documento e foto no cadastro p?blico de voluntário", async () => {
  const originalCriar = UsuarioService.criar;
  let createCalled = false;

  UsuarioService.criar = async () => {
    createCalled = true;
    return null;
  };

  try {
    const req = {
      body: {
        nome: "Voluntario Publico",
        email: "voluntario.publico@alento.test",
        login: "voluntario.publico",
        telefone: "(21) 99999-9999",
        tipoCadastro: "voluntario",
        senha: "SenhaSegura123!",
        confirmarSenha: "SenhaSegura123!",
      },
      files: {},
      accepts(type) {
        return type === "json";
      },
    };
    const res = createJsonResponseMock();

    await AuthController.cadastro(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(
      res.payload?.erro,
      "Para cadastro de voluntário, envie o documento de identidade e a foto de perfil."
    );
    assert.equal(createCalled, false);
  } finally {
    UsuarioService.criar = originalCriar;
  }
});

test("AuthController.cadastro traduz falha de upload do multer para resposta 400", async () => {
  const req = {
    body: {
      nome: "Voluntario Publico",
      email: "voluntario.publico@alento.test",
      login: "voluntario.publico",
      telefone: "(21) 99999-9999",
      tipoCadastro: "voluntario",
      senha: "SenhaSegura123!",
      confirmarSenha: "SenhaSegura123!",
    },
    uploadError: {
      name: "MulterError",
      code: "LIMIT_FILE_SIZE",
    },
    accepts(type) {
      return type === "json";
    },
  };
  const res = createJsonResponseMock();

  await AuthController.cadastro(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload?.erro,
    "Um dos arquivos enviados excede o limite permitido. Envie documento e foto mais leves."
  );
});

test("AuthController.cadastro reconstr?i dadosCadastro enviados pelo multipart p?blico", async () => {
  const originalCriar = UsuarioService.criar;
  const originalAuditCreate = AuditTrail.create;
  let capturedPayload = null;

  UsuarioService.criar = async (payload) => {
    capturedPayload = payload;
    return { _id: "usuario-publico", ...payload };
  };
  AuditTrail.create = async () => ({ _id: "audit-ok" });

  try {
    const req = {
      body: {
        nome: "Familia Publica",
        email: "familia.publica@alento.test",
        login: "familia.publica",
        cpf: "123.456.789-09",
        telefone: "(21) 99999-0000",
        tipoCadastro: "familia",
        senha: "SenhaSegura123!",
        confirmarSenha: "SenhaSegura123!",
        "dadosCadastro[endereco]": "Rua das Flores, 100",
        dadosCadastro_quantidade_membros: "4",
      },
      files: {},
      accepts(type) {
        return type === "json";
      },
    };
    const res = createJsonResponseMock();

    await AuthController.cadastro(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(capturedPayload?.dadosCadastro?.endereco, "Rua das Flores, 100");
    assert.equal(capturedPayload?.dadosCadastro?.quantidade_membros, "4");
  } finally {
    UsuarioService.criar = originalCriar;
    AuditTrail.create = originalAuditCreate;
  }
});
