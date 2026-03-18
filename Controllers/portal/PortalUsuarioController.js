const UsuarioService = require("../../services/domain/UsuarioService");
const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");
const { Atendimento, TIPOS_ATENDIMENTO } = require("../../schemas/social/Atendimento");
const { AgendaEvento } = require("../../schemas/social/AgendaEvento");
const { PERFIS, getProfileLabel } = require("../../config/roles");
const { PERMISSIONS } = require("../../config/permissions");
const { getVolunteerAccessLabel } = require("../../config/volunteerAccess");
const { hasAnyPermission } = require("../../services/accessControlService");
const { escapeRegex } = require("../../services/shared/searchUtilsService");

const USER_FAMILIA_LIMIT_OPTIONS = [9, 12, 18, 30, 60];
const USER_AGENDA_LIMIT = 12;

function mapTipoCadastroLabel(tipoCadastro) {
  if (tipoCadastro === "familia") return "Familia";
  return "Voluntario";
}

function mapTipoAtendimentoLabel(tipo) {
  const labels = {
    ligacao: "Ligacao",
    presencial: "Presencial",
    mensagem: "Mensagem",
    whatsapp: "Whatsapp",
    videochamada: "Videochamada",
    outro: "Outro",
  };
  const value = String(tipo || "").toLowerCase().trim();
  return labels[value] || "Outro";
}

function mapDateTimeLabel(dateLike) {
  if (!dateLike) return "-";
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(dt);
}

function mapDayLabel(dateLike) {
  if (!dateLike) return "-";
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
}

function mapMonthLabel(dateLike) {
  if (!dateLike) return "Mes indefinido";
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "Mes indefinido";
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(dt);
  return label.replace(/^\w/, (c) => c.toUpperCase());
}

function mapAgendaStatusLabel(status) {
  const labels = {
    agendado: "Agendado",
    encerrado: "Encerrado",
    cancelado: "Cancelado",
    em_analise_cancelamento: "Em analise de cancelamento",
    em_negociacao_remarcacao: "Em negociacao de remarcacao",
    remarcado: "Remarcado",
  };
  return labels[String(status || "").trim()] || "Agendado";
}

function mapPresenceStatusLabel(status) {
  const labels = {
    pendente: "Pendente",
    presente: "Presente",
    falta: "Falta",
    falta_justificada: "Falta justificada",
    cancelado_antecipadamente: "Cancelado antecipadamente",
  };
  return labels[String(status || "").trim()] || "Pendente";
}

function parseFiltroTipo(raw) {
  const value = String(raw || "todos").toLowerCase().trim();
  if (TIPOS_ATENDIMENTO.includes(value)) return value;
  return "todos";
}

function parseFiltroStatus(raw) {
  const value = String(raw || "todos").toLowerCase().trim();
  if (value === "ativo" || value === "inativo") return value;
  return "todos";
}

function parseFiltroDate(raw) {
  const value = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return value;
}

function parseFiltroLimit(raw) {
  const parsed = Number.parseInt(String(raw || ""), 10);
  if (USER_FAMILIA_LIMIT_OPTIONS.includes(parsed)) return parsed;
  return 18;
}

function hasPerm(user, permission) {
  return hasAnyPermission(user?.permissions || [], [permission]);
}

function buildPortalQuickLinks(user) {
  const links = [];

  if (hasPerm(user, PERMISSIONS.PORTAL_MEUS_DADOS)) {
    links.push({
      href: "/meus-dados",
      label: "Meus Dados",
      description: "Veja seus dados cadastrais e o tipo de acesso liberado.",
      icon: "fa-address-card",
    });
  }

  if (hasPerm(user, PERMISSIONS.PORTAL_MINHA_FAMILIA)) {
    links.push({
      href: "/minha-familia",
      label: "Minha Familia",
      description: "Acompanhe atendimentos, agenda e registros da familia.",
      icon: "fa-heart",
    });
  }

  if (hasPerm(user, PERMISSIONS.DASHBOARD_VIEW)) {
    links.push({
      href: "/painel",
      label: "Painel",
      description: "Acesse indicadores e a visao geral da operacao social.",
      icon: "fa-chart-line",
    });
  }

  if (hasPerm(user, PERMISSIONS.FAMILIAS_VIEW)) {
    links.push({
      href: "/familias",
      label: "Assistidos",
      description: "Consulte familias, dependentes e acompanhamentos.",
      icon: "fa-people-group",
    });
  }

  if (hasPerm(user, PERMISSIONS.AGENDA_VIEW)) {
    links.push({
      href: "/agenda",
      label: "Agenda",
      description: "Visualize compromissos e a organizacao dos atendimentos.",
      icon: "fa-calendar-days",
    });
  }

  return links;
}

function buildAccessHighlights(user) {
  const highlights = [];

  if (hasPerm(user, PERMISSIONS.DASHBOARD_VIEW)) highlights.push("Painel executivo");
  if (hasPerm(user, PERMISSIONS.FAMILIAS_VIEW)) highlights.push("Consulta de assistidos");
  if (hasPerm(user, PERMISSIONS.ATENDIMENTOS_CREATE)) highlights.push("Registro de atendimentos");
  if (hasPerm(user, PERMISSIONS.AGENDA_VIEW)) highlights.push("Agenda");
  if (hasPerm(user, PERMISSIONS.AGENDA_ATTENDANCE)) highlights.push("Presencas");
  if (hasPerm(user, PERMISSIONS.RELATORIOS_VIEW)) highlights.push("Relatorios");
  if (hasPerm(user, PERMISSIONS.BUSCA_GLOBAL)) highlights.push("Busca global");

  return highlights;
}

function mapAgendaCard(item) {
  return {
    id: String(item?._id || ""),
    titulo: item?.titulo || "Agendamento",
    dataHoraIso: item?.inicio ? new Date(item.inicio).toISOString() : "",
    dataHoraLabel: mapDateTimeLabel(item?.inicio),
    diaLabel: mapDayLabel(item?.inicio),
    profissionalNome: item?.responsavelId?.nome || "Nao informado",
    salaNome: item?.salaId?.nome || "-",
    local: item?.local || "-",
    statusAgendamento: item?.statusAgendamento || "agendado",
    statusAgendamentoLabel: mapAgendaStatusLabel(item?.statusAgendamento),
    statusPresenca: item?.statusPresenca || "pendente",
    statusPresencaLabel: mapPresenceStatusLabel(item?.statusPresenca),
    observacoes: item?.observacoes || "-",
    presencaObservacao: item?.presencaObservacao || "",
  };
}

async function findLinkedFamily(usuario) {
  const email = String(usuario?.email || "").toLowerCase().trim();
  const telefone = String(usuario?.telefone || "").trim();

  const filtroFamilia = {
    $or: [{ "responsavel.email": email }],
  };

  if (telefone) {
    filtroFamilia.$or.push({ "responsavel.telefone": telefone });
  }

  return Familia.findOne(filtroFamilia).lean();
}

class PortalUsuarioController {
  static async meusDados(req, res) {
    try {
      const userId = req?.session?.user?.id;
      const perfil = req?.session?.user?.perfil;
      if (!userId) {
        return res.redirect("/login");
      }

      if (perfil !== PERFIS.USUARIO) {
        return res.redirect("/painel");
      }

      const usuario = await UsuarioService.buscarPorId(userId);
      if (!usuario) {
        return res.redirect("/login");
      }

      return res.status(200).render("pages/usuario/meus-dados", {
        title: "Meus Dados",
        sectionTitle: "Meus Dados",
        navKey: "meus-dados",
        layout: "partials/app.ejs",
        pageClass: "page-usuario-meus-dados",
        extraCss: ["/css/usuario-portal.css"],
        usuario,
        perfilLabel: getProfileLabel(usuario?.perfil),
        tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
        nivelAcessoVoluntarioLabel: getVolunteerAccessLabel(usuario?.nivelAcessoVoluntario),
        quickLinks: buildPortalQuickLinks(req?.session?.user),
        accessHighlights: buildAccessHighlights(req?.session?.user),
      });
    } catch (error) {
      console.error("Erro ao carregar meus dados:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar seus dados.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }

  static async minhaFamilia(req, res) {
    try {
      const userId = req?.session?.user?.id;
      const perfil = req?.session?.user?.perfil;
      if (!userId) {
        return res.redirect("/login");
      }

      if (perfil !== PERFIS.USUARIO) {
        return res.redirect("/painel");
      }

      const usuario = await UsuarioService.buscarPorId(userId);
      if (!usuario) {
        return res.redirect("/login");
      }

      const isFamilia = String(usuario?.tipoCadastro || "").toLowerCase() === "familia";
      const filtros = {
        busca: String(req.query?.busca || "").trim(),
        tipo: parseFiltroTipo(req.query?.tipo),
        status: parseFiltroStatus(req.query?.status),
        dataInicio: parseFiltroDate(req.query?.dataInicio),
        dataFim: parseFiltroDate(req.query?.dataFim),
        limit: parseFiltroLimit(req.query?.limit),
        limitOptions: USER_FAMILIA_LIMIT_OPTIONS,
        tiposOptions: TIPOS_ATENDIMENTO.map((tipo) => ({
          value: tipo,
          label: mapTipoAtendimentoLabel(tipo),
        })),
      };

      if (filtros.dataInicio && filtros.dataFim && filtros.dataInicio > filtros.dataFim) {
        const aux = filtros.dataInicio;
        filtros.dataInicio = filtros.dataFim;
        filtros.dataFim = aux;
      }

      let familia = null;
      let cards = [];
      let cardsPorMes = [];
      let proximosAgendamentos = [];
      let historicoAgendamentos = [];
      const totais = {
        total: 0,
        ativos: 0,
        inativos: 0,
      };

      if (isFamilia) {
        familia = await findLinkedFamily(usuario);

        if (familia?._id) {
          const filtroAtendimento = {
            familiaId: familia._id,
          };

          if (filtros.tipo !== "todos") {
            filtroAtendimento.tipo = filtros.tipo;
          }

          if (filtros.status === "ativo") {
            filtroAtendimento.ativo = true;
          } else if (filtros.status === "inativo") {
            filtroAtendimento.ativo = false;
          }

          if (filtros.dataInicio || filtros.dataFim) {
            filtroAtendimento.dataHora = {};
            if (filtros.dataInicio) {
              filtroAtendimento.dataHora.$gte = new Date(`${filtros.dataInicio}T00:00:00`);
            }
            if (filtros.dataFim) {
              filtroAtendimento.dataHora.$lte = new Date(`${filtros.dataFim}T23:59:59.999`);
            }
          }

          if (filtros.busca) {
            const buscaRegex = new RegExp(escapeRegex(filtros.busca), "i");
            const pacientesComBusca = await Paciente.find({
              familiaId: familia._id,
              nome: { $regex: buscaRegex },
            })
              .select("_id")
              .lean();

            const pacienteIds = pacientesComBusca.map((item) => item?._id).filter(Boolean);
            const orBusca = [
              { resumo: { $regex: buscaRegex } },
              { proximosPassos: { $regex: buscaRegex } },
              { tipo: { $regex: buscaRegex } },
            ];

            if (pacienteIds.length) {
              orBusca.push({ pacienteId: { $in: pacienteIds } });
            }

            filtroAtendimento.$or = orBusca;
          }

          const inicioHoje = new Date();
          inicioHoje.setHours(0, 0, 0, 0);

          const [atendimentos, agendaFutura, agendaHistorico] = await Promise.all([
            Atendimento.find(filtroAtendimento)
              .populate("pacienteId", "_id nome")
              .sort({ dataHora: -1 })
              .limit(filtros.limit)
              .lean(),
            AgendaEvento.find({
              familiaId: familia._id,
              ativo: true,
              inicio: { $gte: inicioHoje },
              statusAgendamento: { $ne: "cancelado" },
            })
              .populate("responsavelId", "_id nome")
              .populate("salaId", "_id nome")
              .sort({ inicio: 1 })
              .limit(USER_AGENDA_LIMIT)
              .lean(),
            AgendaEvento.find({
              familiaId: familia._id,
              $or: [
                { inicio: { $lt: inicioHoje } },
                { statusPresenca: { $ne: "pendente" } },
                { statusAgendamento: { $in: ["cancelado", "encerrado", "remarcado"] } },
              ],
            })
              .populate("responsavelId", "_id nome")
              .populate("salaId", "_id nome")
              .sort({ inicio: -1 })
              .limit(USER_AGENDA_LIMIT)
              .lean(),
          ]);

          totais.total = atendimentos.length;
          totais.ativos = atendimentos.filter((item) => !!item?.ativo).length;
          totais.inativos = Math.max(totais.total - totais.ativos, 0);

          proximosAgendamentos = agendaFutura.map(mapAgendaCard);
          historicoAgendamentos = agendaHistorico.map(mapAgendaCard);

          cards = atendimentos.map((item) => ({
            id: String(item?._id || ""),
            dataHoraIso: item?.dataHora ? new Date(item.dataHora).toISOString() : "",
            tipoLabel: mapTipoAtendimentoLabel(item?.tipo),
            dataHoraLabel: mapDateTimeLabel(item?.dataHora),
            diaLabel: mapDayLabel(item?.dataHora),
            dependenteNome: item?.pacienteId?.nome || "Nao informado",
            resumo: item?.resumo || "-",
            proximosPassos: item?.proximosPassos || "-",
            ativo: !!item?.ativo,
            statusLabel: item?.ativo ? "ATIVO" : "INATIVO",
          }));

          const monthBuckets = new Map();
          cards.forEach((card) => {
            const dt = new Date(card.dataHoraIso || "");
            const monthKey = Number.isNaN(dt.getTime())
              ? "indefinido"
              : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
            if (!monthBuckets.has(monthKey)) {
              monthBuckets.set(monthKey, {
                key: monthKey,
                label: mapMonthLabel(card.dataHoraIso),
                cards: [],
              });
            }
            monthBuckets.get(monthKey).cards.push(card);
          });
          cardsPorMes = Array.from(monthBuckets.values())
            .map((bucket) => ({
              ...bucket,
              cards: [...bucket.cards].sort((a, b) => String(a.dataHoraIso).localeCompare(String(b.dataHoraIso))),
            }))
            .sort((a, b) => String(b.key).localeCompare(String(a.key)));
        }
      }

      return res.status(200).render("pages/usuario/minha-familia", {
        title: "Minha Familia",
        sectionTitle: "Minha Familia",
        navKey: "minha-familia",
        layout: "partials/app.ejs",
        pageClass: "page-usuario-minha-familia",
        extraCss: ["/css/usuario-familia.css"],
        extraJs: ["/js/usuario-familia.js"],
        usuario,
        tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
        isFamilia,
        familia,
        cards,
        cardsPorMes,
        proximosAgendamentos,
        historicoAgendamentos,
        totais,
        filtros,
      });
    } catch (error) {
      console.error("Erro ao carregar tela da familia do usuario:", error);
      return res.status(500).render("pages/errors/500", {
        status: 500,
        message: "Erro ao carregar os dados da sua familia.",
        req,
        err: error,
        layout: "partials/login.ejs",
      });
    }
  }
}

module.exports = PortalUsuarioController;
