const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ABSENCE_ALERT_THRESHOLD,
  shouldTriggerAbsenceAlert,
} = require("../../services/agenda/domain/agendaEventAttendanceService");

test("shouldTriggerAbsenceAlert dispara quando a segunda falta e registrada", () => {
  assert.equal(
    shouldTriggerAbsenceAlert({
      previousStatusPresenca: "pendente",
      nextStatusPresenca: "falta",
      totalAbsences: ABSENCE_ALERT_THRESHOLD,
    }),
    true
  );
});

test("shouldTriggerAbsenceAlert nao dispara para status sem ausencia", () => {
  assert.equal(
    shouldTriggerAbsenceAlert({
      previousStatusPresenca: "pendente",
      nextStatusPresenca: "presente",
      totalAbsences: ABSENCE_ALERT_THRESHOLD,
    }),
    false
  );
});

test("shouldTriggerAbsenceAlert nao dispara quando ja era falta antes", () => {
  assert.equal(
    shouldTriggerAbsenceAlert({
      previousStatusPresenca: "falta_justificada",
      nextStatusPresenca: "falta",
      totalAbsences: ABSENCE_ALERT_THRESHOLD,
    }),
    false
  );
});

test("shouldTriggerAbsenceAlert nao dispara fora do limiar de duas faltas", () => {
  assert.equal(
    shouldTriggerAbsenceAlert({
      previousStatusPresenca: "pendente",
      nextStatusPresenca: "falta_justificada",
      totalAbsences: 1,
    }),
    false
  );

  assert.equal(
    shouldTriggerAbsenceAlert({
      previousStatusPresenca: "pendente",
      nextStatusPresenca: "falta_justificada",
      totalAbsences: 3,
    }),
    false
  );
});
