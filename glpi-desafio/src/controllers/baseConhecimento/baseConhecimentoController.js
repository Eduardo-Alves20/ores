import {
  listarBaseConhecimento,
  obterArtigoBaseConhecimento,
  obterStatsBaseConhecimento,
  invalidarCacheBaseConhecimento,
} from "../../service/baseConhecimentoService.js";
import { normalizarPaginacao } from "../../service/paginacaoService.js";
import {
  excluirTopicoBaseConhecimento,
  atualizarStatusTopicoBaseConhecimento,
  atualizarTopicoBaseConhecimento,
  criarTopicoBaseConhecimento,
  listarTopicosBaseConhecimentoInternos,
  obterTopicoBaseConhecimentoPorSlug,
} from "../../repos/baseConhecimentoTopicosRepo.js";
import { registrarEventoSistema } from "../../service/logsService.js";

function filtroQuery(query = {}) {
  return {
    q: String(query?.q || "").trim(),
  };
}

function filtroGerenciarQuery(query = {}) {
  const statusRaw = String(query?.status || "").trim().toLowerCase();
  return {
    q: String(query?.q || "").trim(),
    status: ["ativos", "inativos", "todos"].includes(statusRaw) ? statusRaw : "ativos",
  };
}

function podeGerirTopicos(usuarioSessao = null) {
  const perfil = String(usuarioSessao?.perfil || "").trim().toLowerCase();
  return perfil === "tecnico" || perfil === "admin";
}

function valoresTopicoForm(body = {}) {
  return {
    titulo: String(body?.titulo || "").trim(),
    categoria: String(body?.categoria || "").trim(),
    resumo: String(body?.resumo || "").trim(),
    tags: String(body?.tags || "").trim(),
    perguntas: String(body?.perguntas || "").trim(),
    sintomas: String(body?.sintomas || "").trim(),
    conteudo: String(body?.conteudo || "").trim(),
  };
}

function topicoParaValores(topico = {}) {
  return {
    titulo: String(topico?.titulo || ""),
    categoria: String(topico?.categoria || ""),
    resumo: String(topico?.resumo || ""),
    tags: Array.isArray(topico?.tags) ? topico.tags.join(", ") : "",
    perguntas: Array.isArray(topico?.perguntas) ? topico.perguntas.join("\n") : "",
    sintomas: Array.isArray(topico?.sintomas) ? topico.sintomas.join(", ") : "",
    conteudo: String(topico?.conteudo || ""),
  };
}

export async function baseConhecimentoIndexGet(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  const filtros = filtroQuery(req.query);
  const { page, limit } = normalizarPaginacao(req.query, {
    pageDefault: 1,
    limitDefault: 10,
    limitMin: 10,
    limitMax: 200,
  });

  try {
    const [dados, stats] = await Promise.all([
      listarBaseConhecimento({ q: filtros.q, page, limit }),
      obterStatsBaseConhecimento(),
    ]);

    return res.render("base-conhecimento/index", {
      layout: "layout-app",
      titulo: "Base de conhecimento",
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      podeGerirTopicos: podeGerirTopicos(usuarioSessao),
      filtros: { ...filtros, limit: dados?.paginacao?.limit || limit },
      artigos: dados?.itens || [],
      paginacao: dados?.paginacao || { total: 0, page: 1, pages: 1, limit },
      paginacaoQuery: {
        q: filtros.q,
        limit: dados?.paginacao?.limit || limit,
      },
      totalFiltrados: Number(dados?.paginacao?.total || 0),
      totalBase: Number(dados?.totalBase || 0),
      stats,
      erroGeral: null,
    });
  } catch (err) {
    console.error("Erro ao carregar base de conhecimento:", err);
    return res.status(500).render("base-conhecimento/index", {
      layout: "layout-app",
      titulo: "Base de conhecimento",
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      podeGerirTopicos: podeGerirTopicos(usuarioSessao),
      filtros: { ...filtros, limit },
      artigos: [],
      paginacao: { total: 0, page: 1, pages: 1, limit },
      paginacaoQuery: { q: filtros.q, limit },
      totalFiltrados: 0,
      totalBase: 0,
      stats: { total: 0, categorias: [] },
      erroGeral: "Nao foi possivel carregar a base de conhecimento.",
    });
  }
}

export async function baseConhecimentoNovoGet(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  if (!podeGerirTopicos(usuarioSessao)) {
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Sem permissao para criar topicos." };
    return res.redirect("/base-conhecimento");
  }

  return res.render("base-conhecimento/novo", {
    layout: "layout-app",
    titulo: "Novo topico da base",
    cssPortal: "/styles/usuario.css",
    cssExtra: "/styles/base-conhecimento.css",
    usuarioSessao,
    erroGeral: null,
    valores: {
      titulo: "",
      categoria: "",
      resumo: "",
      tags: "",
      perguntas: "",
      sintomas: "",
      conteudo: "",
    },
  });
}

export async function baseConhecimentoNovoPost(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  if (!podeGerirTopicos(usuarioSessao)) {
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Sem permissao para criar topicos." };
    return res.redirect("/base-conhecimento");
  }

  const valores = valoresTopicoForm(req.body);

  try {
    const topico = await criarTopicoBaseConhecimento({
      ...valores,
      autor: usuarioSessao,
    });
    invalidarCacheBaseConhecimento();

    await registrarEventoSistema({
      req,
      nivel: "info",
      modulo: "base_conhecimento",
      evento: "base_conhecimento.topico_criado",
      acao: "criar_topico",
      resultado: "sucesso",
      mensagem: `Topico interno criado: ${String(topico?.titulo || "").slice(0, 140)}.`,
      alvo: {
        tipo: "base_conhecimento",
        id: String(topico?._id || ""),
      },
      meta: {
        slug: topico?.slug,
        categoria: topico?.categoria,
      },
    });

    if (req.session) req.session.flash = { tipo: "success", mensagem: "Topico criado na base com sucesso." };
    return res.redirect(`/base-conhecimento/${encodeURIComponent(String(topico?.slug || ""))}`);
  } catch (err) {
    console.error("Erro ao criar topico da base de conhecimento:", err);
    return res.status(400).render("base-conhecimento/novo", {
      layout: "layout-app",
      titulo: "Novo topico da base",
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      erroGeral: err?.message || "Nao foi possivel criar o topico.",
      valores,
    });
  }
}

export async function baseConhecimentoGerenciarGet(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  if (!podeGerirTopicos(usuarioSessao)) {
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Sem permissao para gerenciar topicos." };
    return res.redirect("/base-conhecimento");
  }

  const filtros = filtroGerenciarQuery(req.query);
  try {
    const topicos = await listarTopicosBaseConhecimentoInternos({
      q: filtros.q,
      status: filtros.status,
      limit: 1000,
    });

    return res.render("base-conhecimento/gerenciar", {
      layout: "layout-app",
      titulo: "Gerenciar FAQ interno",
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      filtros,
      topicos: Array.isArray(topicos) ? topicos : [],
      erroGeral: null,
    });
  } catch (err) {
    console.error("Erro ao carregar painel de gerenciamento da base:", err);
    return res.status(500).render("base-conhecimento/gerenciar", {
      layout: "layout-app",
      titulo: "Gerenciar FAQ interno",
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      filtros,
      topicos: [],
      erroGeral: "Nao foi possivel carregar os topicos internos.",
    });
  }
}

export async function baseConhecimentoEditarGet(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  if (!podeGerirTopicos(usuarioSessao)) {
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Sem permissao para editar topicos." };
    return res.redirect("/base-conhecimento");
  }

  const slug = String(req.params?.slug || "").trim().toLowerCase();
  try {
    const topico = await obterTopicoBaseConhecimentoPorSlug(slug, { incluirInativos: true });
    if (!topico) {
      if (req.session) req.session.flash = { tipo: "error", mensagem: "Topico interno nao encontrado." };
      return res.redirect("/base-conhecimento/gerenciar");
    }

    return res.render("base-conhecimento/editar", {
      layout: "layout-app",
      titulo: "Editar topico da base",
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      erroGeral: null,
      topico,
      valores: topicoParaValores(topico),
    });
  } catch (err) {
    console.error("Erro ao abrir edicao de topico da base:", err);
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Nao foi possivel abrir o topico para edicao." };
    return res.redirect("/base-conhecimento/gerenciar");
  }
}

export async function baseConhecimentoEditarPost(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  if (!podeGerirTopicos(usuarioSessao)) {
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Sem permissao para editar topicos." };
    return res.redirect("/base-conhecimento");
  }

  const slug = String(req.params?.slug || "").trim().toLowerCase();
  const valores = valoresTopicoForm(req.body);
  try {
    const topico = await atualizarTopicoBaseConhecimento(
      slug,
      valores,
      { autor: usuarioSessao },
    );
    invalidarCacheBaseConhecimento();

    await registrarEventoSistema({
      req,
      nivel: "info",
      modulo: "base_conhecimento",
      evento: "base_conhecimento.topico_editado",
      acao: "editar_topico",
      resultado: "sucesso",
      mensagem: `Topico interno atualizado: ${String(topico?.titulo || "").slice(0, 140)}.`,
      alvo: {
        tipo: "base_conhecimento",
        id: String(topico?._id || ""),
      },
      meta: {
        slug: topico?.slug,
        categoria: topico?.categoria,
      },
    });

    if (req.session) req.session.flash = { tipo: "success", mensagem: "Topico atualizado com sucesso." };
    if (topico?.ativo === false) return res.redirect("/base-conhecimento/gerenciar");
    return res.redirect(`/base-conhecimento/${encodeURIComponent(String(topico?.slug || slug))}`);
  } catch (err) {
    console.error("Erro ao editar topico da base de conhecimento:", err);
    const topico = await obterTopicoBaseConhecimentoPorSlug(slug, { incluirInativos: true }).catch(() => null);
    return res.status(400).render("base-conhecimento/editar", {
      layout: "layout-app",
      titulo: "Editar topico da base",
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      erroGeral: err?.message || "Nao foi possivel atualizar o topico.",
      topico: topico || { slug, ativo: true },
      valores,
    });
  }
}

export async function baseConhecimentoStatusPost(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  if (!podeGerirTopicos(usuarioSessao)) {
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Sem permissao para alterar status de topicos." };
    return res.redirect("/base-conhecimento");
  }

  const slug = String(req.params?.slug || "").trim().toLowerCase();
  const ativo = String(req.body?.ativo || "").trim() === "1";
  const referer = String(req.get?.("referer") || "").trim();
  const redirectBack = referer.includes("/base-conhecimento/gerenciar")
    ? referer
    : "/base-conhecimento/gerenciar";
  try {
    const topico = await atualizarStatusTopicoBaseConhecimento(
      slug,
      ativo,
      { autor: usuarioSessao },
    );
    invalidarCacheBaseConhecimento();

    await registrarEventoSistema({
      req,
      nivel: "info",
      modulo: "base_conhecimento",
      evento: "base_conhecimento.topico_status",
      acao: "atualizar_status_topico",
      resultado: "sucesso",
      mensagem: `Topico interno ${ativo ? "ativado" : "desativado"}: ${String(topico?.titulo || "").slice(0, 140)}.`,
      alvo: {
        tipo: "base_conhecimento",
        id: String(topico?._id || ""),
      },
      meta: {
        slug: topico?.slug,
        ativo,
      },
    });

    if (req.session) {
      req.session.flash = {
        tipo: "success",
        mensagem: ativo ? "Topico ativado com sucesso." : "Topico desativado com sucesso.",
      };
    }
  } catch (err) {
    console.error("Erro ao atualizar status de topico da base:", err);
    if (req.session) {
      req.session.flash = {
        tipo: "error",
        mensagem: err?.message || "Nao foi possivel atualizar o status do topico.",
      };
    }
  }

  return res.redirect(redirectBack);
}

export async function baseConhecimentoExcluirPost(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  if (!podeGerirTopicos(usuarioSessao)) {
    if (req.session) req.session.flash = { tipo: "error", mensagem: "Sem permissao para excluir topicos." };
    return res.redirect("/base-conhecimento");
  }

  const slug = String(req.params?.slug || "").trim().toLowerCase();
  const referer = String(req.get?.("referer") || "").trim();
  const redirectBack = referer.includes("/base-conhecimento")
    ? referer
    : "/base-conhecimento/gerenciar";

  try {
    const topico = await excluirTopicoBaseConhecimento(slug, { autor: usuarioSessao });
    invalidarCacheBaseConhecimento();

    await registrarEventoSistema({
      req,
      nivel: "security",
      modulo: "base_conhecimento",
      evento: "base_conhecimento.topico_excluido",
      acao: "excluir_topico",
      resultado: "sucesso",
      mensagem: `Topico interno excluido: ${String(topico?.titulo || "").slice(0, 140)}.`,
      alvo: {
        tipo: "base_conhecimento",
        id: String(topico?._id || ""),
      },
      meta: {
        slug: topico?.slug,
      },
    });

    if (req.session) req.session.flash = { tipo: "success", mensagem: "Topico excluido com sucesso." };
  } catch (err) {
    console.error("Erro ao excluir topico da base:", err);
    if (req.session) {
      req.session.flash = {
        tipo: "error",
        mensagem: err?.message || "Nao foi possivel excluir o topico.",
      };
    }
  }

  return res.redirect(redirectBack);
}

export async function baseConhecimentoShowGet(req, res) {
  const usuarioSessao = req.session?.usuario || null;
  const slug = String(req.params?.slug || "").trim().toLowerCase();

  try {
    const artigo = await obterArtigoBaseConhecimento(slug);
    if (!artigo) {
      return res.status(404).render("erros/erro", {
        layout: "layout-app",
        titulo: "Artigo nao encontrado",
        mensagem: "O artigo solicitado nao foi encontrado na base de conhecimento.",
      });
    }

    return res.render("base-conhecimento/show", {
      layout: "layout-app",
      titulo: `${artigo.titulo} - Base de conhecimento`,
      cssPortal: "/styles/usuario.css",
      cssExtra: "/styles/base-conhecimento.css",
      usuarioSessao,
      podeGerirTopicos: podeGerirTopicos(usuarioSessao),
      artigo,
    });
  } catch (err) {
    console.error("Erro ao carregar artigo da base de conhecimento:", err);
    return res.status(500).render("erros/erro", {
      layout: "layout-app",
      titulo: "Erro interno",
      mensagem: "Nao foi possivel carregar o artigo solicitado.",
    });
  }
}
