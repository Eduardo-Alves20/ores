const UsuarioService = require("../../services/domain/UsuarioService");
const Familia = require("../../schemas/social/Familia");
const { Paciente } = require("../../schemas/social/Paciente");
const { Atendimento, TIPOS_ATENDIMENTO } = require("../../schemas/social/Atendimento");
const { PERFIS } = require("../../config/roles");

const USER_FAMILIA_LIMIT_OPTIONS = [9, 12, 18, 30, 60];

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

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        usuario,
        tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
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
      const totais = {
        total: 0,
        ativos: 0,
        inativos: 0,
      };

      if (isFamilia) {
        const email = String(usuario?.email || "").toLowerCase().trim();
        const telefone = String(usuario?.telefone || "").trim();
        const filtroFamilia = {
          $or: [
            { "responsavel.email": email },
          ],
        };

        if (telefone) {
          filtroFamilia.$or.push({ "responsavel.telefone": telefone });
        }

        familia = await Familia.findOne(filtroFamilia).lean();

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

          const atendimentos = await Atendimento.find(filtroAtendimento)
            .populate("pacienteId", "_id nome")
            .sort({ dataHora: -1 })
            .limit(filtros.limit)
            .lean();

          totais.total = atendimentos.length;
          totais.ativos = atendimentos.filter((item) => !!item?.ativo).length;
          totais.inativos = Math.max(totais.total - totais.ativos, 0);

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
        extraCss: ["/css/familias.css", "/css/usuario-familia.css"],
        extraJs: ["/js/usuario-familia.js"],
        usuario,
        tipoCadastroLabel: mapTipoCadastroLabel(usuario?.tipoCadastro),
        isFamilia,
        familia,
        cards,
        cardsPorMes,
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


