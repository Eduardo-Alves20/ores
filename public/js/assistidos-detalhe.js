(function () {
  "use strict";
  var shared = window.FamiliasShared;
  if (!shared) return;
  var root = document.querySelector('[data-page="assistido-detalhe"]');
  if (!root) return;

  var requestJson = shared.requestJson;
  var parseJsonScript = shared.parseJsonScript;
  var escapeHtml = shared.escapeHtml;
  var formatDateTime = shared.formatDateTime;
  var confirmAction = shared.confirmAction;
  var showToast = shared.showToast;
  var showSuccess = shared.showSuccess;

  var assistidoId = root.getAttribute("data-assistido-id");
  var flags = parseJsonScript("assistido-detalhe-flags", {});
  if (!flags.canAtendView || !assistidoId) return;

  var listaEl = document.getElementById("atendimentos-lista");
  var form = document.getElementById("atendimento-form");
  var novoBtn = document.getElementById("atendimento-novo-btn");
  var cancelarBtn = document.getElementById("atendimento-cancelar-btn");

  var TIPO_LABEL = {
    presencial: "Presencial",
    ligacao: "Ligação",
    whatsapp: "WhatsApp",
    mensagem: "Mensagem",
    videochamada: "Videochamada",
    outro: "Outro",
  };

  function openForm(atendimento) {
    if (!form) return;
    form.reset();
    form.elements.atendimentoId.value = atendimento ? String(atendimento._id) : "";
    form.elements.tipo.value = atendimento ? atendimento.tipo || "presencial" : "presencial";
    if (atendimento && atendimento.dataHora) {
      var d = new Date(atendimento.dataHora);
      if (!Number.isNaN(d.getTime())) {
        var pad = function (n) { return String(n).padStart(2, "0"); };
        form.elements.dataHora.value =
          d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
      }
    }
    form.elements.resumo.value = atendimento ? atendimento.resumo || "" : "";
    form.elements.proximosPassos.value = atendimento ? atendimento.proximosPassos || "" : "";
    form.elements.visibilityScope.value = atendimento ? atendimento.visibilityScope || "care_team" : "care_team";
    form.elements.notasPrivadas.value = atendimento ? atendimento.notasPrivadas || "" : "";
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function closeForm() {
    if (!form) return;
    form.style.display = "none";
    form.reset();
    form.elements.atendimentoId.value = "";
  }

  function renderLista(docs) {
    if (!listaEl) return;
    if (!docs || !docs.length) {
      listaEl.innerHTML = '<p style="color:var(--text-soft)">Nenhum atendimento registrado ainda.</p>';
      return;
    }
    listaEl.innerHTML = docs
      .map(function (a) {
        var prof = a.profissionalId && a.profissionalId.nome ? a.profissionalId.nome : "";
        var podeEditar = flags.canAtendUpdate && a.ativo;
        var podeStatus = flags.canAtendStatus;
        var actions = "";
        if (podeEditar) {
          actions += '<button type="button" class="btn btn-xs btn-ghost" data-atend-edit="' + escapeHtml(String(a._id)) + '">Editar</button> ';
        }
        if (podeStatus) {
          actions += '<button type="button" class="btn btn-xs btn-muted" data-atend-toggle="' + escapeHtml(String(a._id)) + '" data-ativo="' + (a.ativo ? "1" : "0") + '">' + (a.ativo ? "Inativar" : "Reativar") + "</button>";
        }
        return (
          '<article class="card-elevated" style="padding:16px;margin-bottom:10px;' + (a.ativo ? "" : "opacity:.6") + '">' +
            '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">' +
              '<strong>' + escapeHtml(TIPO_LABEL[a.tipo] || a.tipo || "Atendimento") + "</strong>" +
              '<span style="color:var(--text-soft);font-size:13px">' + escapeHtml(formatDateTime(a.dataHora)) + "</span>" +
            "</div>" +
            '<p style="margin:8px 0;white-space:pre-wrap">' + escapeHtml(a.resumo || "") + "</p>" +
            (a.proximosPassos ? '<p style="margin:4px 0"><strong>Próximos passos:</strong> ' + escapeHtml(a.proximosPassos) + "</p>" : "") +
            (a.notasPrivadas ? '<p style="margin:4px 0;color:#b45309"><strong>Notas privadas:</strong> ' + escapeHtml(a.notasPrivadas) + "</p>" : "") +
            (prof ? '<p style="margin:4px 0;color:var(--text-soft);font-size:13px">Profissional: ' + escapeHtml(prof) + "</p>" : "") +
            (actions ? '<div style="margin-top:10px;display:flex;gap:8px">' + actions + "</div>" : "") +
          "</article>"
        );
      })
      .join("");
  }

  var cache = [];

  async function load() {
    try {
      var data = await requestJson("/api/assistidos/" + assistidoId + "/atendimentos?limit=100");
      cache = Array.isArray(data.docs) ? data.docs : [];
      renderLista(cache);
    } catch (e) {
      if (listaEl) listaEl.innerHTML = '<p style="color:#dc2626">Erro ao carregar atendimentos.</p>';
    }
  }

  if (novoBtn) novoBtn.addEventListener("click", function () { openForm(null); });
  if (cancelarBtn) cancelarBtn.addEventListener("click", closeForm);

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var id = form.elements.atendimentoId.value;
      var payload = {
        tipo: form.elements.tipo.value,
        dataHora: form.elements.dataHora.value ? new Date(form.elements.dataHora.value).toISOString() : undefined,
        resumo: form.elements.resumo.value.trim(),
        proximosPassos: form.elements.proximosPassos.value.trim(),
        visibilityScope: form.elements.visibilityScope.value,
        notasPrivadas: form.elements.notasPrivadas.value.trim(),
      };
      if (!payload.resumo) {
        showToast("Resumo é obrigatório.");
        return;
      }
      try {
        if (id) {
          await requestJson("/api/assistidos/" + assistidoId + "/atendimentos/" + id, { method: "PUT", body: payload });
        } else {
          await requestJson("/api/assistidos/" + assistidoId + "/atendimentos", { method: "POST", body: payload });
        }
        showSuccess("Atendimento salvo.");
        closeForm();
        load();
      } catch (err) {
        showToast(err.message || "Erro ao salvar atendimento.");
      }
    });
  }

  if (listaEl) {
    listaEl.addEventListener("click", async function (e) {
      var editId = e.target.getAttribute && e.target.getAttribute("data-atend-edit");
      if (editId) {
        var atend = cache.find(function (a) { return String(a._id) === String(editId); });
        if (atend) openForm(atend);
        return;
      }
      var toggleId = e.target.getAttribute && e.target.getAttribute("data-atend-toggle");
      if (toggleId) {
        var ativoAtual = e.target.getAttribute("data-ativo") === "1";
        var ok = await confirmAction({
          title: ativoAtual ? "Inativar atendimento?" : "Reativar atendimento?",
          text: ativoAtual ? "O atendimento ficará oculto do histórico ativo." : "O atendimento voltará ao histórico ativo.",
        });
        if (!ok) return;
        try {
          await requestJson("/api/assistidos/" + assistidoId + "/atendimentos/" + toggleId + "/status", {
            method: "PATCH",
            body: { ativo: !ativoAtual },
          });
          load();
        } catch (err) {
          showToast(err.message || "Erro ao alterar status.");
        }
      }
    });
  }

  load();
}());
