(function () {
  "use strict";
  var shared = window.FamiliasShared;
  if (!shared) return;
  var root = document.querySelector('[data-page="assistidos-lista"]');
  if (!root) return;
  var requestJson = shared.requestJson;
  var parseJsonScript = shared.parseJsonScript;

  var filtros = parseJsonScript("assistidos-initial", {});
  var viewFlags = parseJsonScript("assistidos-view-flags", {});

  function faixaLabel(f) {
    return { crianca: "Criança", adolescente: "Adolescente", adulto: "Adulto", idoso: "Idoso" }[f] || f || "—";
  }

  function statusBadge(s) {
    var map = { ativo: "badge-soft", rascunho: "badge-soft badge-soft-muted", em_analise: "badge-soft", inativo: "badge-soft badge-soft-muted", cancelado: "badge-soft badge-soft-muted" };
    var label = { ativo: "Ativo", rascunho: "Rascunho", em_analise: "Em análise", inativo: "Inativo", cancelado: "Cancelado" };
    return '<span class="' + (map[s] || "badge-soft") + '">' + (label[s] || s || "—") + "</span>";
  }

  function renderRows(docs) {
    var tbody = document.getElementById("assistidos-table-body");
    if (!docs || !docs.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px">Nenhum assistido encontrado.</td></tr>';
      return;
    }
    tbody.innerHTML = docs.map(function (a) {
      var tel = a.telefonePrincipal || "—";
      var cidade = [a.endereco && a.endereco.cidade, a.endereco && a.endereco.estado].filter(Boolean).join("/") || "—";
      var upd = a.updatedAt ? new Date(a.updatedAt).toLocaleDateString("pt-BR") : "—";
      var actions = '<a href="/assistidos/' + a._id + '" class="btn btn-xs btn-muted">Ver</a>';
      if (viewFlags.canUpdate) actions += ' <a href="/assistidos/' + a._id + '/editar" class="btn btn-xs btn-ghost">Editar</a>';
      return "<tr>" +
        "<td>" + (a.nome || "—") + "</td>" +
        "<td>" + (a.cpf || "—") + "</td>" +
        "<td>" + tel + "</td>" +
        "<td>" + faixaLabel(a.faixaEtaria) + "</td>" +
        "<td>" + cidade + "</td>" +
        "<td>" + statusBadge(a.status) + "</td>" +
        "<td>" + upd + "</td>" +
        "<td>" + actions + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderPagination(meta, currentParams) {
    var nav = document.getElementById("assistidos-paginacao");
    if (!meta || meta.totalPages <= 1) { nav.innerHTML = ""; return; }
    var html = "";
    for (var p = 1; p <= meta.totalPages; p++) {
      var params = Object.assign({}, currentParams, { page: p });
      var qs = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
      html += '<a href="?' + qs + '" class="paginacao-btn' + (p === meta.page ? " is-active" : "") + '">' + p + "</a>";
    }
    nav.innerHTML = html;
  }

  function getFormParams() {
    var form = document.getElementById("assistidos-filtro-form");
    if (!form) return {};
    var params = {};
    new FormData(form).forEach(function (v, k) { if (v) params[k] = v; });
    return params;
  }

  async function load(params) {
    var qs = Object.keys(params || {}).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    var data = await requestJson("/api/assistidos?" + qs);
    if (!data) return;
    var docs = data.docs || data.assistidos || [];
    var total = data.totalDocs || docs.length;
    document.getElementById("assistidos-total-chip").textContent = total;
    document.getElementById("assistidos-active-chip").textContent = docs.filter(function (a) { return a.status === "ativo"; }).length;
    document.getElementById("assistidos-count").textContent = total + " encontrados";
    renderRows(docs);
    renderPagination(data, params);
  }

  var form = document.getElementById("assistidos-filtro-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      load(getFormParams());
    });
  }
  var clearBtn = document.getElementById("assistidos-limpar-filtros");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (form) form.reset();
      load({});
    });
  }

  load(filtros).catch(function () {
    var tbody = document.getElementById("assistidos-table-body");
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px">Erro ao carregar assistidos.</td></tr>';
  });
}());
