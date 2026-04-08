const test = require("node:test");
const assert = require("node:assert/strict");

const { ContadorSistema } = require("../../schemas/core/ContadorSistema");
const { Paciente } = require("../../schemas/social/Paciente");
const {
  formatPatientMatricula,
  generatePatientMatricula,
  normalizePatientBirthDate,
  normalizePatientDisabilityType,
  normalizePatientName,
  resolveEnrollmentYear,
  updatePatient,
} = require("../../services/familia/api/pacienteActionService");

const PATIENT_ID = "507f191e810c19729de860ea";
const FAMILY_ID = "507f191e810c19729de860eb";
const COUNTER_KEY = "paciente_matricula";

test("normalizePatientName exige nome preenchido e limita tamanho", () => {
  assert.equal(normalizePatientName("  Ana  ", { required: true }), "Ana");
  assert.equal(normalizePatientName("x".repeat(200), { required: true }).length, 160);

  assert.throws(
    () => normalizePatientName("   ", { required: true }),
    (error) =>
      error?.status === 400 &&
      error?.message === "Campo nome e obrigatorio."
  );
});

test("normalizePatientBirthDate e normalizePatientDisabilityType validam formato e allowlist", () => {
  assert.equal(
    normalizePatientBirthDate("2024-01-10T10:00:00.000Z") instanceof Date,
    true
  );
  assert.equal(normalizePatientBirthDate(""), null);
  assert.equal(
    normalizePatientDisabilityType("transtorno_espectro_autista"),
    "transtorno_espectro_autista"
  );

  assert.throws(
    () => normalizePatientBirthDate("data-invalida"),
    (error) =>
      error?.status === 400 &&
      error?.message === "Data de nascimento invalida."
  );

  assert.throws(
    () => normalizePatientDisabilityType("script"),
    (error) =>
      error?.status === 400 &&
      error?.message === "Tipo de deficiencia invalido."
  );
});

test("resolveEnrollmentYear usa o ano corrente para datas invalidas", () => {
  assert.equal(resolveEnrollmentYear("2030-01-25T00:00:00.000Z"), 2030);
  assert.equal(resolveEnrollmentYear("data-invalida"), new Date().getFullYear());
});

test("formatPatientMatricula gera padrao AAAA + 4 digitos", () => {
  assert.equal(formatPatientMatricula(2026, 1), "20260001");
  assert.equal(formatPatientMatricula("2027", "42"), "20270042");

  assert.throws(
    () => formatPatientMatricula(2026, 0),
    (error) =>
      error?.status === 500 &&
      error?.message === "Sequencia de matricula invalida."
  );
});

test("generatePatientMatricula incrementa por ano e reinicia ao trocar de ano", async () => {
  const originalFindOneAndUpdate = ContadorSistema.findOneAndUpdate;
  const inMemoryCounters = new Map();

  ContadorSistema.findOneAndUpdate = async (filter) => {
    const key = `${String(filter?.chave || "")}:${Number(filter?.ano || 0)}`;
    const next = Number(inMemoryCounters.get(key) || 0) + 1;
    inMemoryCounters.set(key, next);
    return { valor: next };
  };

  try {
    const first2026 = await generatePatientMatricula(new Date("2026-02-01T10:00:00.000Z"));
    const second2026 = await generatePatientMatricula(new Date("2026-10-01T10:00:00.000Z"));
    const first2027 = await generatePatientMatricula(new Date("2027-01-05T10:00:00.000Z"));

    assert.equal(first2026, "20260001");
    assert.equal(second2026, "20260002");
    assert.equal(first2027, "20270001");
    assert.equal(inMemoryCounters.get(`${COUNTER_KEY}:2026`), 2);
    assert.equal(inMemoryCounters.get(`${COUNTER_KEY}:2027`), 1);
  } finally {
    ContadorSistema.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("updatePatient rejeita nome em branco sem atualizar o banco", async () => {
  const originalFindById = Paciente.findById;
  const originalFindByIdAndUpdate = Paciente.findByIdAndUpdate;
  let updateCalled = false;

  Paciente.findById = () => ({
    select: async () => ({
      _id: PATIENT_ID,
      familiaId: FAMILY_ID,
    }),
  });
  Paciente.findByIdAndUpdate = async () => {
    updateCalled = true;
    return null;
  };

  try {
    await assert.rejects(
      () =>
        updatePatient({
          user: { permissions: [] },
          actorId: "507f1f77bcf86cd799439011",
          id: PATIENT_ID,
          body: {
            nome: "   ",
          },
        }),
      (error) =>
        error?.status === 400 &&
        error?.message === "Campo nome e obrigatorio."
    );

    assert.equal(updateCalled, false);
  } finally {
    Paciente.findById = originalFindById;
    Paciente.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});
