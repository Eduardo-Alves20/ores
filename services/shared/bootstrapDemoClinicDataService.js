const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");
const { Atendimento } = require("../../schemas/social/Atendimento");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { AgendaSala, normalizeSalaKey } = require("../../schemas/social/AgendaSala");
const Usuario = require("../../schemas/core/Usuario");
const { PERFIS } = require("../../config/roles");

function isDevLike() {
  const env = String(process.env.AMBIENTE || process.env.NODE_ENV || "")
    .trim()
    .toLowerCase();

  return ["dev", "development", "local", "test", "teste"].includes(env);
}

function seedDate(day, hour, minute = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0);
}

function addMinutes(dateLike, minutes) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getTime() + minutes * 60 * 1000);
}

async function ensureSala({ nome, descricao, actorId }) {
  return AgendaSala.findOneAndUpdate(
    { nomeNormalizado: normalizeSalaKey(nome) },
    {
      $set: {
        nome,
        descricao: descricao || "",
        ativo: true,
        atualizadoPor: actorId || null,
        inativadoEm: null,
        inativadoPor: null,
      },
      $setOnInsert: {
        criadoPor: actorId || null,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function ensureFamilia(definition, actorId) {
  return Familia.findOneAndUpdate(
    { "responsavel.email": String(definition.responsavel.email || "").toLowerCase().trim() },
    {
      $set: {
        responsavel: definition.responsavel,
        endereco: definition.endereco || {},
        observacoes: definition.observacoes || "",
        ativo: true,
        atualizadoPor: actorId || null,
        inativadoEm: null,
        inativadoPor: null,
      },
      $setOnInsert: {
        criadoPor: actorId || null,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function ensurePaciente(familiaId, definition, actorId) {
  return Paciente.findOneAndUpdate(
    { familiaId, nome: definition.nome },
    {
      $set: {
        dataNascimento: definition.dataNascimento || null,
        tipoDeficiencia: definition.tipoDeficiencia || "outra",
        necessidadesApoio: definition.necessidadesApoio || "",
        observacoes: definition.observacoes || "",
        diagnosticoResumo: definition.diagnosticoResumo || "",
        ativo: true,
        atualizadoPor: actorId || null,
        inativadoEm: null,
        inativadoPor: null,
      },
      $setOnInsert: {
        familiaId,
        nome: definition.nome,
        criadoPor: actorId || null,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function ensureAtendimento(familiaId, definition, actorId, pacienteId, profissionalId) {
  return Atendimento.findOneAndUpdate(
    { familiaId, resumo: definition.resumo },
    {
      $set: {
        pacienteId: pacienteId || null,
        profissionalId: profissionalId || null,
        dataHora: definition.dataHora,
        tipo: definition.tipo || "outro",
        proximosPassos: definition.proximosPassos || "",
        ativo: true,
        atualizadoPor: actorId || null,
        inativadoEm: null,
        inativadoPor: null,
      },
      $setOnInsert: {
        familiaId,
        resumo: definition.resumo,
        criadoPor: actorId,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function ensureAgendaEvento(familiaId, definition, actorId, pacienteId, responsavelId, salaId) {
  return AgendaEvento.findOneAndUpdate(
    { familiaId, titulo: definition.titulo },
    {
      $set: {
        tipoAtendimento: definition.tipoAtendimento || "outro",
        inicio: definition.inicio,
        fim: addMinutes(definition.inicio, 30),
        local: definition.local || "",
        salaId: salaId || null,
        observacoes: definition.observacoes || "",
        statusAgendamento: definition.statusAgendamento || "agendado",
        statusPresenca: definition.statusPresenca || "pendente",
        presencaObservacao: definition.presencaObservacao || "",
        presencaRegistradaEm: definition.presencaRegistradaEm || null,
        presencaRegistradaPor: definition.presencaRegistradaPor || null,
        pacienteId: pacienteId || null,
        responsavelId,
        ativo: true,
        atualizadoPor: actorId || null,
        inativadoEm: null,
        inativadoPor: null,
      },
      $setOnInsert: {
        familiaId,
        titulo: definition.titulo,
        criadoPor: actorId,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function loadProfessionals() {
  const users = await Usuario.find({
    ativo: true,
    perfil: { $in: [PERFIS.ADMIN, PERFIS.SUPERADMIN, PERFIS.ATENDENTE, PERFIS.TECNICO] },
    login: { $in: ["admin1", "admin2", "admin3", "admindemo"] },
  })
    .select("_id login nome")
    .lean();

  const map = new Map(users.map((user) => [String(user.login || "").toLowerCase(), user]));
  return {
    actor: map.get("admin1") || users[0] || null,
    byLogin: map,
  };
}

function buildSeedDefinitions(byLogin, salas) {
  const admin1 = byLogin.get("admin1") || byLogin.values().next().value;
  const admin2 = byLogin.get("admin2") || admin1;
  const admin3 = byLogin.get("admin3") || admin1;

  return [
    {
      responsavel: {
        nome: "Helena Demo Souza",
        parentesco: "mae",
        telefone: "(71) 99110-1001",
        email: "helena.demo@alento.local",
      },
      endereco: {
        rua: "Rua das Acacias",
        numero: "101",
        bairro: "Pituba",
        cidade: "Salvador",
        estado: "BA",
      },
      observacoes: "Familia demo para apresentacao de presencas, faltas e historico de atendimentos.",
      pacientes: [
        {
          nome: "Lucas Demo Souza",
          dataNascimento: seedDate(3, 0, 0),
          tipoDeficiencia: "transtorno_espectro_autista",
          necessidadesApoio: "Apoio em comunicacao e rotina estruturada.",
          observacoes: "Responde bem a abordagens ludicas.",
          diagnosticoResumo: "Acompanhamento multiprofissional continuo.",
        },
        {
          nome: "Clara Demo Souza",
          dataNascimento: seedDate(8, 0, 0),
          tipoDeficiencia: "intelectual",
          necessidadesApoio: "Estimulos cognitivos e acolhimento emocional.",
          observacoes: "Boa adaptacao a atendimento individual.",
          diagnosticoResumo: "Necessita reforco educacional semanal.",
        },
      ],
      atendimentos: [
        {
          resumo: "Triagem social inicial da familia Helena Demo Souza",
          tipo: "presencial",
          dataHora: seedDate(8, 10, 0),
          profissionalLogin: "admin1",
          pacienteNome: "Lucas Demo Souza",
          proximosPassos: "Manter acompanhamento em fono e psicologia.",
        },
        {
          resumo: "Acompanhamento escolar de Lucas Demo Souza",
          tipo: "whatsapp",
          dataHora: seedDate(11, 15, 0),
          profissionalLogin: "admin2",
          pacienteNome: "Lucas Demo Souza",
          proximosPassos: "Validar nova rotina de estudos com a familia.",
        },
      ],
      agenda: [
        {
          titulo: "Fono Lucas Demo - acolhimento",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(10, 9, 0),
          salaNome: "Sala Girassol",
          local: "Instituto Alento",
          pacienteNome: "Lucas Demo Souza",
          responsavelLogin: "admin1",
          statusAgendamento: "encerrado",
          statusPresenca: "presente",
          presencaObservacao: "Chegou no horario e participou bem da sessao.",
          presencaRegistradaPorLogin: "admin1",
          presencaRegistradaEm: seedDate(10, 9, 35),
        },
        {
          titulo: "Psicologia Clara Demo - retorno",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(12, 10, 0),
          salaNome: "Sala Esperanca",
          local: "Instituto Alento",
          pacienteNome: "Clara Demo Souza",
          responsavelLogin: "admin2",
          statusAgendamento: "encerrado",
          statusPresenca: "falta_justificada",
          presencaObservacao: "Familia avisou previamente que Clara estava em consulta medica.",
          presencaRegistradaPorLogin: "admin2",
          presencaRegistradaEm: seedDate(12, 10, 40),
        },
        {
          titulo: "Visita domiciliar Lucas Demo",
          tipoAtendimento: "visita_domiciliar",
          inicio: seedDate(14, 14, 0),
          local: "Residencia da familia",
          pacienteNome: "Lucas Demo Souza",
          responsavelLogin: "admin1",
          statusAgendamento: "encerrado",
          statusPresenca: "falta",
          presencaObservacao: "Equipe esteve no local, mas a familia nao estava disponivel.",
          presencaRegistradaPorLogin: "admin1",
          presencaRegistradaEm: seedDate(14, 14, 35),
        },
        {
          titulo: "Fono Clara Demo - proxima sessao",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(18, 9, 0),
          salaNome: "Sala Girassol",
          local: "Instituto Alento",
          pacienteNome: "Clara Demo Souza",
          responsavelLogin: "admin1",
          statusAgendamento: "agendado",
          statusPresenca: "pendente",
        },
      ],
    },
    {
      responsavel: {
        nome: "Joana Demo Almeida",
        parentesco: "mae",
        telefone: "(71) 99110-1002",
        email: "joana.demo@alento.local",
      },
      endereco: {
        rua: "Rua do Sol",
        numero: "220",
        bairro: "Imbui",
        cidade: "Salvador",
        estado: "BA",
      },
      observacoes: "Familia demo com foco em ranking de faltas e presencas.",
      pacientes: [
        {
          nome: "Miguel Demo Almeida",
          dataNascimento: seedDate(6, 0, 0),
          tipoDeficiencia: "multipla",
          necessidadesApoio: "Estimulos motores e acompanhamento psicologico.",
          observacoes: "Necessita acolhimento inicial em todos os encontros.",
          diagnosticoResumo: "Em adaptacao ao cronograma semanal.",
        },
      ],
      atendimentos: [
        {
          resumo: "Acolhimento emocional de Miguel Demo Almeida",
          tipo: "presencial",
          dataHora: seedDate(9, 11, 0),
          profissionalLogin: "admin2",
          pacienteNome: "Miguel Demo Almeida",
          proximosPassos: "Reforcar orientacao de rotina com a familia.",
        },
        {
          resumo: "Orientacao por telefone para Joana Demo Almeida",
          tipo: "ligacao",
          dataHora: seedDate(15, 17, 30),
          profissionalLogin: "admin1",
          pacienteNome: "Miguel Demo Almeida",
          proximosPassos: "Confirmar comparecimento da proxima sessao.",
        },
      ],
      agenda: [
        {
          titulo: "Psicomotricidade Miguel Demo",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(11, 11, 0),
          salaNome: "Sala Oceano",
          local: "Instituto Alento",
          pacienteNome: "Miguel Demo Almeida",
          responsavelLogin: "admin2",
          statusAgendamento: "encerrado",
          statusPresenca: "falta",
          presencaObservacao: "Nao compareceu e nao houve justificativa previa.",
          presencaRegistradaPorLogin: "admin2",
          presencaRegistradaEm: seedDate(11, 11, 35),
        },
        {
          titulo: "Psicologia Miguel Demo",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(13, 13, 0),
          salaNome: "Sala Esperanca",
          local: "Instituto Alento",
          pacienteNome: "Miguel Demo Almeida",
          responsavelLogin: "admin2",
          statusAgendamento: "encerrado",
          statusPresenca: "presente",
          presencaObservacao: "Participacao ativa durante toda a consulta.",
          presencaRegistradaPorLogin: "admin2",
          presencaRegistradaEm: seedDate(13, 13, 35),
        },
        {
          titulo: "Reforco escolar Miguel Demo",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(20, 15, 0),
          salaNome: "Sala Oceano",
          local: "Instituto Alento",
          pacienteNome: "Miguel Demo Almeida",
          responsavelLogin: "admin3",
          statusAgendamento: "agendado",
          statusPresenca: "pendente",
        },
      ],
    },
    {
      responsavel: {
        nome: "Carlos Demo Costa",
        parentesco: "pai",
        telefone: "(71) 99110-1003",
        email: "carlos.demo@alento.local",
      },
      endereco: {
        rua: "Alameda Aurora",
        numero: "58",
        bairro: "Cabula",
        cidade: "Salvador",
        estado: "BA",
      },
      observacoes: "Familia demo com exemplo de cancelamento antecipado.",
      pacientes: [
        {
          nome: "Sofia Demo Costa",
          dataNascimento: seedDate(4, 0, 0),
          tipoDeficiencia: "visual",
          necessidadesApoio: "Apoio pedagogico adaptado e atividades artisticas.",
          observacoes: "Tem boa adesao quando a familia confirma com antecedencia.",
          diagnosticoResumo: "Acompanhamento semanal em reforco e artes.",
        },
      ],
      atendimentos: [
        {
          resumo: "Planejamento pedagogico de Sofia Demo Costa",
          tipo: "videochamada",
          dataHora: seedDate(7, 14, 30),
          profissionalLogin: "admin3",
          pacienteNome: "Sofia Demo Costa",
          proximosPassos: "Ajustar agenda de ingles e artes para o restante do mes.",
        },
      ],
      agenda: [
        {
          titulo: "Ingles Sofia Demo",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(10, 15, 0),
          salaNome: "Sala Esperanca",
          local: "Instituto Alento",
          pacienteNome: "Sofia Demo Costa",
          responsavelLogin: "admin3",
          statusAgendamento: "encerrado",
          statusPresenca: "presente",
          presencaObservacao: "Boa interacao durante a aula de ingles.",
          presencaRegistradaPorLogin: "admin3",
          presencaRegistradaEm: seedDate(10, 15, 35),
        },
        {
          titulo: "Arte Sofia Demo",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(17, 16, 0),
          salaNome: "Sala Girassol",
          local: "Instituto Alento",
          pacienteNome: "Sofia Demo Costa",
          responsavelLogin: "admin1",
          statusAgendamento: "cancelado",
          statusPresenca: "cancelado_antecipadamente",
          presencaObservacao: "Familia avisou com antecedencia que nao conseguiria comparecer.",
          presencaRegistradaPorLogin: "admin1",
          presencaRegistradaEm: seedDate(16, 18, 0),
        },
        {
          titulo: "Servico social Sofia Demo",
          tipoAtendimento: "atendimento_sede",
          inicio: seedDate(21, 10, 30),
          salaNome: "Sala Esperanca",
          local: "Instituto Alento",
          pacienteNome: "Sofia Demo Costa",
          responsavelLogin: "admin1",
          statusAgendamento: "agendado",
          statusPresenca: "pendente",
        },
      ],
    },
  ];
}

async function ensureDemoClinicData() {
  if (!isDevLike()) return;

  const { actor, byLogin } = await loadProfessionals();
  if (!actor) {
    console.warn("Seed demo clinico ignorado: nenhum profissional de demo encontrado.");
    return;
  }

  const salas = new Map();
  for (const sala of [
    { nome: "Sala Girassol", descricao: "Sala de atendimento individual", actorId: actor._id },
    { nome: "Sala Esperanca", descricao: "Sala de acolhimento e psicologia", actorId: actor._id },
    { nome: "Sala Oceano", descricao: "Sala de psicomotricidade e reforco", actorId: actor._id },
  ]) {
    const createdSala = await ensureSala(sala);
    salas.set(createdSala.nome, createdSala);
  }

  const definitions = buildSeedDefinitions(byLogin, salas);

  for (const definition of definitions) {
    const familia = await ensureFamilia(definition, actor._id);
    const pacientesByName = new Map();

    for (const pacienteDef of definition.pacientes) {
      const paciente = await ensurePaciente(familia._id, pacienteDef, actor._id);
      pacientesByName.set(paciente.nome, paciente);
    }

    for (const atendimentoDef of definition.atendimentos) {
      const profissional = byLogin.get(String(atendimentoDef.profissionalLogin || "").toLowerCase()) || actor;
      const paciente = pacientesByName.get(atendimentoDef.pacienteNome) || null;
      await ensureAtendimento(
        familia._id,
        atendimentoDef,
        actor._id,
        paciente?._id || null,
        profissional?._id || null
      );
    }

    for (const agendaDef of definition.agenda) {
      const profissional = byLogin.get(String(agendaDef.responsavelLogin || "").toLowerCase()) || actor;
      const registrador = byLogin.get(String(agendaDef.presencaRegistradaPorLogin || "").toLowerCase()) || profissional;
      const paciente = pacientesByName.get(agendaDef.pacienteNome) || null;
      const sala = agendaDef.salaNome ? salas.get(agendaDef.salaNome) : null;

      await ensureAgendaEvento(
        familia._id,
        {
          ...agendaDef,
          presencaRegistradaPor: agendaDef.presencaRegistradaPorLogin ? registrador?._id || null : null,
        },
        actor._id,
        paciente?._id || null,
        profissional?._id || actor._id,
        sala?._id || null
      );
    }
  }

  console.log(`Seed clinico demo sincronizado para ${definitions.length} familias.`);
}

module.exports = {
  ensureDemoClinicData,
};
