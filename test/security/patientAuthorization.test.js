const test = require("node:test");
const assert = require("node:assert/strict");

const { Paciente } = require("../../schemas/social/Paciente");
const {
  normalizePatientBirthDate,
  normalizePatientDisabilityType,
  normalizePatientName,
  updatePatient,
} = require("../../services/familia/api/pacienteActionService");

const PATIENT_ID = "507f191e810c19729de860ea";
const FAMILY_ID = "507f191e810c19729de860eb";

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
