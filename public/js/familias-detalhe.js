(function () {
  const shared = window.FamiliasShared;
  if (!shared || typeof window.createFamiliaDetalheUi !== "function") return;

  const {
    confirmAction,
    escapeHtml,
    formatAgendaTipoLabel,
    parseJsonScript,
    requestJson,
    sanitizeClassToken,
    showSuccess,
    showToast,
    toIsoFromLocal,
  } = shared;

  function init(root) {
    const familiaId = root.getAttribute("data-familia-id");
    if (!familiaId) return;

    const refs = {
      recordTabs: Array.from(root.querySelectorAll("[data-record-tab]")),
      recordOverviewPanel: document.getElementById("family-record-overview"),
      recordWorkflowPanel: document.getElementById("family-record-workflow"),
      workflowTitle: document.getElementById("workflow-title"),
      workflowSubtitle: document.getElementById("workflow-subtitle"),
      workflowMainBtn: document.getElementById("workflow-main-btn"),
      workflowBackBtn: document.getElementById("workflow-back-btn"),
      workflowTabs: Array.from(root.querySelectorAll("[data-workflow-tab]")),
      panelPacientes: document.getElementById("panel-pacientes"),
      panelDependente: document.getElementById("panel-dependente"),
      panelHistorico: document.getElementById("panel-historico"),
      panelPresencas: document.getElementById("panel-presencas"),
      panelAtendimento: document.getElementById("panel-atendimento"),
      panelRegistro: document.getElementById("panel-registro"),
      historicoRegistrarBtn: document.getElementById("historico-registrar-btn"),
      registroVoltarBtn: document.getElementById("registro-voltar-btn"),
      registroPanelTitle: document.getElementById("registro-panel-title"),
      pacientesLista: document.getElementById("pacientes-lista"),
      atendimentosLista: document.getElementById("atendimentos-lista"),
      presencasLista: document.getElementById("presencas-lista"),
      presencasResumo: document.getElementById("presencas-resumo"),
      presencasFilterLabel: document.getElementById("presencas-filter-label"),
      atendimentoDetalhe: document.getElementById("atendimento-detalhe"),
      atendimentoEditarBtn: document.getElementById("atendimento-editar-btn"),
      pacientesCount: document.getElementById("pacientes-count"),
      atendimentosCount: document.getElementById("atendimentos-count"),
      presencasCount: document.getElementById("presencas-count"),
      familiaStatusPill: document.getElementById("familia-status-pill"),
      familiaPacientesPill: document.getElementById("familia-pacientes-pill"),
      familiaAtendimentosPill: document.getElementById("familia-atendimentos-pill"),
      familiaPresencasPill: document.getElementById("familia-presencas-pill"),
      statusBadge: document.getElementById("resumo-status"),
      statusBtn: document.getElementById("familia-toggle-status"),
      breadcrumbDependenteSep: document.getElementById(
        "familia-breadcrumb-dependente-sep",
      ),
      breadcrumbDependente: document.getElementById("familia-breadcrumb-dependente"),
      pacienteNovoBtn: document.getElementById("paciente-novo-btn"),
      pacienteCancelarBtn: document.getElementById("paciente-cancelar-btn"),
      pacienteForm: document.getElementById("paciente-form"),
      dependenteDetalhe: document.getElementById("dependente-detalhe"),
      dependenteEditarBtn: document.getElementById("dependente-editar-btn"),
      dependenteForm: document.getElementById("dependente-form"),
      dependenteCancelarBtn: document.getElementById("dependente-cancelar-btn"),
      atendimentoForm: document.getElementById("atendimento-form"),
      atendimentoSubmitBtn: document.getElementById("atendimento-submit-btn"),
      pacienteSelect: document.getElementById("atendimento-paciente"),
      profissionalSelect: document.getElementById("atendimento-profissional"),
    };

    const viewFlags = parseJsonScript("familia-detail-flags", {
      canCreateFamily: false,
      canEditFamily: false,
      canToggleFamilyStatus: false,
      canCreatePatient: false,
      canEditPatient: false,
      canTogglePatientStatus: false,
      canCreateAttendance: false,
      canEditAttendance: false,
      canToggleAttendanceStatus: false,
    });

    const state = {
      currentFamilia: null,
      currentPacientes: [],
      currentAtendimentos: [],
      currentPresencasAgenda: [],
      currentVoluntarios: [],
      currentPresencaFilter: "all",
      selectedDependenteId: null,
      selectedAtendimentoId: null,
      activeView: "pacientes",
      historicoOrigin: "pacientes",
      registroOrigin: "historico",
      registroMode: "create",
      recordTab: "overview",
      viewFlags,
    };

    const ui = window.createFamiliaDetalheUi({ refs, shared, state });
    const {
      closeDependenteForm,
      closePacienteForm,
      formatProfissionalLabel,
      getSelectedAtendimento,
      getSelectedDependente,
      openAtendimentoViewById,
      openDependenteForm,
      openDependenteViewById,
      openPacienteForm,
      openRegistroCreate,
      openRegistroEdit,
      renderAtendimentos,
      renderDependenteFicha,
      renderPacientes,
      renderProfissionalOptions,
      renderResumo,
      setRegistroMode,
      setView: setWorkflowView,
    } = ui;

    function renderRecordTabState(activeTab) {
      const normalized = String(activeTab || "overview").trim() || "overview";
      state.recordTab = normalized;
      refs.recordTabs.forEach((tab) => {
        const isActive = tab.dataset.recordTab === normalized;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    function syncRecordTabFromView(view) {
      const normalized = String(view || "").trim();
      const recordTab =
        normalized === "presencas"
          ? "presencas"
          : normalized === "historico" ||
              normalized === "atendimento" ||
              normalized === "registro"
            ? "historico"
            : "dependentes";

      if (refs.recordOverviewPanel) refs.recordOverviewPanel.hidden = true;
      if (refs.recordWorkflowPanel) refs.recordWorkflowPanel.hidden = false;
      renderRecordTabState(recordTab);
    }

    function setView(view, options = {}) {
      const syncRecordTab = options.syncRecordTab !== false;
      setWorkflowView(view);
      if (syncRecordTab) {
        syncRecordTabFromView(view);
      }
    }

    function activateRecordTab(recordTab) {
      const normalized = String(recordTab || "overview").trim() || "overview";
      if (normalized === "overview") {
        if (refs.recordOverviewPanel) refs.recordOverviewPanel.hidden = false;
        if (refs.recordWorkflowPanel) refs.recordWorkflowPanel.hidden = true;
        renderRecordTabState("overview");
        if (refs.breadcrumbDependente) refs.breadcrumbDependente.hidden = true;
        if (refs.breadcrumbDependenteSep) refs.breadcrumbDependenteSep.hidden = true;
        return;
      }

      if (normalized === "dependentes") {
        setView(state.selectedDependenteId ? "dependente" : "pacientes", {
          syncRecordTab: false,
        });
      } else if (normalized === "presencas") {
        setView("presencas", { syncRecordTab: false });
      } else {
        setView("historico", { syncRecordTab: false });
      }
      if (refs.recordOverviewPanel) refs.recordOverviewPanel.hidden = true;
      if (refs.recordWorkflowPanel) refs.recordWorkflowPanel.hidden = false;
      renderRecordTabState(normalized);
    }

    function buildPresencaCounters(items) {
      return (Array.isArray(items) ? items : []).reduce(
        (acc, item) => {
          acc.total += 1;
          const status = String(item?.statusPresenca || "pendente").trim();
          if (status === "presente") acc.presente += 1;
          else if (status === "falta") acc.falta += 1;
          else if (status === "falta_justificada") acc.justificada += 1;
          else if (status === "cancelado_antecipadamente") acc.cancelada += 1;
          else acc.pendente += 1;
          return acc;
        },
        {
          total: 0,
          presente: 0,
          falta: 0,
          justificada: 0,
          pendente: 0,
          cancelada: 0,
        },
      );
    }

    function filterPresencas(items, filter) {
      const list = Array.isArray(items) ? items : [];
      const normalizedFilter = String(filter || "all").trim();
      if (normalizedFilter === "all") return list;
      if (normalizedFilter === "pendentes_canceladas") {
        return list.filter((item) => {
          const status = String(item?.statusPresenca || "pendente").trim();
          return status === "pendente" || status === "cancelado_antecipadamente";
        });
      }
      return list.filter(
        (item) => String(item?.statusPresenca || "pendente").trim() === normalizedFilter,
      );
    }

    function getPresencaFilterLabel(filter, totalFiltrado, totalGeral) {
      const labels = {
        all: "Mostrando todas as consultas da agenda desta familia.",
        presente: "Mostrando somente as consultas com presenca confirmada.",
        falta: "Mostrando somente as consultas com falta registrada.",
        falta_justificada:
          "Mostrando somente as consultas com falta justificada.",
        pendentes_canceladas:
          "Mostrando consultas pendentes ou canceladas antecipadamente.",
      };
      const base = labels[String(filter || "all")] || labels.all;
      return `${base} ${totalFiltrado} de ${totalGeral} registro(s).`;
    }

    function renderPresencas(items) {
      state.currentPresencasAgenda = Array.isArray(items) ? items : [];
      const counters = buildPresencaCounters(state.currentPresencasAgenda);
      const filteredPresencas = filterPresencas(
        state.currentPresencasAgenda,
        state.currentPresencaFilter,
      );

      if (refs.presencasCount) {
        refs.presencasCount.textContent = String(filteredPresencas.length);
      }

      if (refs.familiaPresencasPill) {
        refs.familiaPresencasPill.textContent = `${counters.total} consulta${
          counters.total === 1 ? "" : "s"
        } agenda`;
      }

      if (refs.presencasResumo) {
        refs.presencasResumo.innerHTML = `
          <article class="presenca-resumo-card is-total ${state.currentPresencaFilter === "all" ? "is-active" : ""}" data-presenca-filter="all" role="button" tabindex="0" aria-label="Mostrar todas as consultas">
            <span>Consultas</span>
            <strong>${counters.total}</strong>
          </article>
          <article class="presenca-resumo-card is-presente ${state.currentPresencaFilter === "presente" ? "is-active" : ""}" data-presenca-filter="presente" role="button" tabindex="0" aria-label="Mostrar consultas com presenca">
            <span>Presentes</span>
            <strong>${counters.presente}</strong>
          </article>
          <article class="presenca-resumo-card is-falta ${state.currentPresencaFilter === "falta" ? "is-active" : ""}" data-presenca-filter="falta" role="button" tabindex="0" aria-label="Mostrar consultas com falta">
            <span>Faltas</span>
            <strong>${counters.falta}</strong>
          </article>
          <article class="presenca-resumo-card is-justificada ${state.currentPresencaFilter === "falta_justificada" ? "is-active" : ""}" data-presenca-filter="falta_justificada" role="button" tabindex="0" aria-label="Mostrar consultas com falta justificada">
            <span>Justificadas</span>
            <strong>${counters.justificada}</strong>
          </article>
          <article class="presenca-resumo-card is-pendente ${state.currentPresencaFilter === "pendentes_canceladas" ? "is-active" : ""}" data-presenca-filter="pendentes_canceladas" role="button" tabindex="0" aria-label="Mostrar consultas pendentes ou canceladas">
            <span>Pendentes / canceladas</span>
            <strong>${counters.pendente + counters.cancelada}</strong>
          </article>
        `;
      }

      if (refs.presencasFilterLabel) {
        refs.presencasFilterLabel.textContent = getPresencaFilterLabel(
          state.currentPresencaFilter,
          filteredPresencas.length,
          counters.total,
        );
      }

      if (!refs.presencasLista) return;

      if (!state.currentPresencasAgenda.length) {
        refs.presencasLista.innerHTML =
          '<p class="empty-hint">Nenhuma consulta de agenda vinculada a esta familia.</p>';
        return;
      }

      if (!filteredPresencas.length) {
        refs.presencasLista.innerHTML =
          '<p class="empty-hint">Nenhuma consulta encontrada para esse filtro.</p>';
        return;
      }

      refs.presencasLista.innerHTML = filteredPresencas
        .map((item) => {
          const pacienteNome = escapeHtml(
            item?.pacienteNome || "Sem dependente especifico",
          );
          const responsavelNome = escapeHtml(
            item?.responsavelNome || "Sem profissional",
          );
          const tipoLabel = escapeHtml(formatAgendaTipoLabel(item?.tipoAtendimento));
          const statusClass = `is-${sanitizeClassToken(
            item?.statusPresenca,
            "pendente",
          )}`;
          const observacao = String(item?.presencaObservacao || "").trim();
          const justificativa = String(item?.presencaJustificativaLabel || "").trim();
          const registroMeta =
            item?.presencaRegistradaEmLabel && item.presencaRegistradaEmLabel !== "-"
              ? `Registrado em ${escapeHtml(item.presencaRegistradaEmLabel)}${
                  item?.presencaRegistradaPorNome
                    ? ` por ${escapeHtml(item.presencaRegistradaPorNome)}`
                    : ""
                }`
              : "";

          return `
            <article class="presenca-card">
              <header class="presenca-card-head">
                <div>
                  <p class="familias-overline">Consulta ${tipoLabel}</p>
                  <h4>${escapeHtml(item?.titulo || "Consulta")}</h4>
                </div>
                <div class="presenca-card-badges">
                  <span class="status-badge presenca-status-badge ${statusClass}">${escapeHtml(item?.statusPresencaLabel || "Pendente")}</span>
                  <span class="status-badge">${escapeHtml(item?.statusAgendamentoLabel || "Agendado")}</span>
                </div>
              </header>
              <div class="presenca-card-grid">
                <p><strong>Data:</strong> ${escapeHtml(item?.inicioLabel || "-")}</p>
                <p><strong>Dependente:</strong> ${pacienteNome}</p>
                <p><strong>Profissional:</strong> ${responsavelNome}</p>
                <p><strong>Sala / local:</strong> ${escapeHtml(item?.salaNome || item?.local || "-")}</p>
              </div>
              ${justificativa ? `<div class="presenca-card-note"><strong>Justificativa:</strong> ${escapeHtml(justificativa)}</div>` : ""}
              ${observacao ? `<div class="presenca-card-note"><strong>Observacao:</strong> ${escapeHtml(observacao)}</div>` : ""}
              ${registroMeta ? `<p class="presenca-card-meta">${registroMeta}</p>` : ""}
            </article>
          `;
        })
        .join("");
    }

    if (refs.workflowMainBtn) {
      refs.workflowMainBtn.addEventListener("click", () => {
        if (state.activeView === "pacientes" || state.activeView === "dependente") {
          state.historicoOrigin = state.activeView;
          setView("historico");
        } else if (
          state.activeView === "historico" &&
          state.viewFlags.canCreateAttendance
        ) {
          openRegistroCreate("historico");
        }
      });
    }

    refs.workflowTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = String(tab.dataset.workflowTab || "").trim();
        if (target === "presencas") {
          setView("presencas");
          return;
        }
        if (target === "historico") {
          setView("historico");
          return;
        }
        setView(state.selectedDependenteId ? "dependente" : "pacientes");
      });
    });

    refs.recordTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activateRecordTab(tab.dataset.recordTab);
      });
    });

    if (refs.presencasResumo) {
      const handlePresencaFilterSelection = (target) => {
        const card = target.closest("[data-presenca-filter]");
        if (!card) return;
        state.currentPresencaFilter =
          String(card.getAttribute("data-presenca-filter") || "all").trim() || "all";
        renderPresencas(state.currentPresencasAgenda);
      };

      refs.presencasResumo.addEventListener("click", (event) => {
        handlePresencaFilterSelection(event.target);
      });

      refs.presencasResumo.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest("[data-presenca-filter]");
        if (!card) return;
        event.preventDefault();
        handlePresencaFilterSelection(card);
      });
    }

    if (refs.workflowBackBtn) {
      refs.workflowBackBtn.addEventListener("click", () => {
        if (state.activeView === "dependente") {
          setView("pacientes");
        } else if (state.activeView === "historico") {
          setView(state.historicoOrigin === "dependente" ? "dependente" : "pacientes");
        } else if (state.activeView === "atendimento") {
          setView("historico");
        } else if (state.activeView === "registro") {
          setView(state.registroOrigin === "atendimento" ? "atendimento" : "historico");
        }
      });
    }

    if (refs.historicoRegistrarBtn) {
      refs.historicoRegistrarBtn.addEventListener("click", () => {
        openRegistroCreate("historico");
      });
    }

    if (refs.registroVoltarBtn) {
      refs.registroVoltarBtn.addEventListener("click", () => {
        setView(state.registroOrigin === "atendimento" ? "atendimento" : "historico");
      });
    }

    if (refs.pacienteNovoBtn) {
      refs.pacienteNovoBtn.addEventListener("click", () => {
        openPacienteForm();
      });
    }

    if (refs.pacienteCancelarBtn) {
      refs.pacienteCancelarBtn.addEventListener("click", () => {
        closePacienteForm();
      });
    }

    if (refs.dependenteEditarBtn) {
      refs.dependenteEditarBtn.addEventListener("click", () => {
        const dependente = getSelectedDependente();
        if (!dependente) return;
        openDependenteForm(dependente);
      });
    }

    if (refs.dependenteCancelarBtn) {
      refs.dependenteCancelarBtn.addEventListener("click", () => {
        closeDependenteForm();
      });
    }

    if (refs.atendimentoEditarBtn) {
      refs.atendimentoEditarBtn.addEventListener("click", () => {
        const atendimento = getSelectedAtendimento();
        if (!atendimento) return;
        openRegistroEdit(atendimento);
      });
    }

    async function loadDetail() {
      try {
        const payload = await requestJson(
          `/api/familias/${familiaId}?incluirInativos=true`,
        );
        state.currentVoluntarios = Array.isArray(payload.voluntarios)
          ? payload.voluntarios.slice()
          : [];
        (payload.atendimentos || []).forEach((atendimento) => {
          const profissional = atendimento?.profissionalId;
          if (!profissional || !profissional._id) return;
          const exists = state.currentVoluntarios.some(
            (item) => String(item._id) === String(profissional._id),
          );
          if (!exists) state.currentVoluntarios.push(profissional);
        });
        state.currentVoluntarios.sort((a, b) =>
          formatProfissionalLabel(a).localeCompare(
            formatProfissionalLabel(b),
            "pt-BR",
          ),
        );
        renderProfissionalOptions(
          refs.atendimentoForm?.elements?.profissionalId?.value || "",
        );
        renderResumo(payload.familia);
        renderPacientes(payload.pacientes || []);
        renderDependenteFicha();
        renderAtendimentos(payload.atendimentos || []);
        renderPresencas(payload.presencasAgenda || []);
      } catch (error) {
        showToast(error.message);
      }
    }

    if (refs.statusBtn) {
      refs.statusBtn.addEventListener("click", async () => {
        if (!state.currentFamilia || !state.viewFlags.canToggleFamilyStatus) return;
        const next = !state.currentFamilia.ativo;
        const ok = await confirmAction({
          title: next ? "Reativar familia?" : "Inativar familia?",
          text: next
            ? "Deseja reativar esta familia?"
            : "Deseja inativar esta familia? Essa acao pode impactar atendimentos.",
          icon: "warning",
          confirmButtonText: next ? "Reativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/familias/${familiaId}/status`, {
            method: "PATCH",
            body: { ativo: next },
          });
          await loadDetail();
          showSuccess("Status da familia atualizado com sucesso.");
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    refs.pacientesLista.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='paciente-status']");
      if (button) {
        if (!state.viewFlags.canTogglePatientStatus) return;
        const nextAtivo = button.getAttribute("data-next") === "true";
        const ok = await confirmAction({
          title: nextAtivo ? "Reativar dependente?" : "Inativar dependente?",
          text: nextAtivo
            ? "Deseja reativar este dependente?"
            : "Deseja inativar este dependente?",
          icon: "warning",
          confirmButtonText: nextAtivo ? "Reativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(`/api/pacientes/${button.getAttribute("data-id")}/status`, {
            method: "PATCH",
            body: { ativo: nextAtivo },
          });
          await loadDetail();
          showSuccess("Status do dependente atualizado com sucesso.");
        } catch (error) {
          showToast(error.message);
        }
        return;
      }

      const card = event.target.closest("[data-type='dependente-open']");
      if (card) {
        openDependenteViewById(card.getAttribute("data-id"));
      }
    });

    refs.pacientesLista.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button[data-type='paciente-status']")) return;
      const card = event.target.closest("[data-type='dependente-open']");
      if (!card) return;
      event.preventDefault();
      openDependenteViewById(card.getAttribute("data-id"));
    });

    refs.dependenteDetalhe.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='dependente-status']");
      if (!button || !state.viewFlags.canTogglePatientStatus) return;
      const nextAtivo = button.getAttribute("data-next") === "true";
      const ok = await confirmAction({
        title: nextAtivo ? "Reativar dependente?" : "Inativar dependente?",
        text: nextAtivo
          ? "Deseja reativar este dependente?"
          : "Deseja inativar este dependente?",
        icon: "warning",
        confirmButtonText: nextAtivo ? "Reativar" : "Inativar",
      });
      if (!ok) return;

      try {
        await requestJson(`/api/pacientes/${button.getAttribute("data-id")}/status`, {
          method: "PATCH",
          body: { ativo: nextAtivo },
        });
        await loadDetail();
        showSuccess("Status do dependente atualizado com sucesso.");
      } catch (error) {
        showToast(error.message);
      }
    });

    refs.atendimentosLista.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='atendimento-status']");
      if (button) {
        if (!state.viewFlags.canToggleAttendanceStatus) return;
        const nextAtivo = button.getAttribute("data-next") === "true";
        const ok = await confirmAction({
          title: nextAtivo ? "Reativar atendimento?" : "Inativar atendimento?",
          text: nextAtivo
            ? "Deseja reativar este atendimento?"
            : "Deseja inativar este atendimento?",
          icon: "warning",
          confirmButtonText: nextAtivo ? "Reativar" : "Inativar",
        });
        if (!ok) return;

        try {
          await requestJson(
            `/api/atendimentos/${button.getAttribute("data-id")}/status`,
            {
              method: "PATCH",
              body: { ativo: nextAtivo },
            },
          );
          await loadDetail();
          showSuccess("Status do atendimento atualizado com sucesso.");
        } catch (error) {
          showToast(error.message);
        }
        return;
      }

      const card = event.target.closest("[data-type='atendimento-open']");
      if (card) {
        openAtendimentoViewById(card.getAttribute("data-id"));
      }
    });

    refs.atendimentosLista.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button[data-type='atendimento-status']")) return;
      const card = event.target.closest("[data-type='atendimento-open']");
      if (!card) return;
      event.preventDefault();
      openAtendimentoViewById(card.getAttribute("data-id"));
    });

    refs.atendimentoDetalhe.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-type='atendimento-status']");
      if (!button || !state.viewFlags.canToggleAttendanceStatus) return;
      const nextAtivo = button.getAttribute("data-next") === "true";
      const ok = await confirmAction({
        title: nextAtivo ? "Reativar atendimento?" : "Inativar atendimento?",
        text: nextAtivo
          ? "Deseja reativar este atendimento?"
          : "Deseja inativar este atendimento?",
        icon: "warning",
        confirmButtonText: nextAtivo ? "Reativar" : "Inativar",
      });
      if (!ok) return;

      try {
        await requestJson(`/api/atendimentos/${button.getAttribute("data-id")}/status`, {
          method: "PATCH",
          body: { ativo: nextAtivo },
        });
        await loadDetail();
        showSuccess("Status do atendimento atualizado com sucesso.");
      } catch (error) {
        showToast(error.message);
      }
    });

    refs.pacienteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.viewFlags.canCreatePatient) {
        showToast("Somente administracao pode registrar dependentes.");
        return;
      }

      const payload = {
        nome: refs.pacienteForm.elements.nome.value.trim(),
        dataNascimento: refs.pacienteForm.elements.dataNascimento.value || null,
        tipoDeficiencia: refs.pacienteForm.elements.tipoDeficiencia.value,
        necessidadesApoio: refs.pacienteForm.elements.necessidadesApoio.value.trim(),
      };

      if (!payload.nome) {
        showToast("Informe o nome do dependente.");
        return;
      }

      try {
        const created = await requestJson(`/api/familias/${familiaId}/pacientes`, {
          method: "POST",
          body: payload,
        });
        closePacienteForm();
        await loadDetail();
        const createdId = created?.paciente?._id;
        if (createdId) {
          openDependenteViewById(createdId);
        }
      } catch (error) {
        showToast(error.message);
      }
    });

    refs.dependenteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.viewFlags.canEditPatient) {
        showToast("Somente administracao pode editar dependentes.");
        return;
      }

      const dependente = getSelectedDependente();
      if (!dependente) return;

      const payload = {
        nome: refs.dependenteForm.elements.nome.value.trim(),
        dataNascimento: refs.dependenteForm.elements.dataNascimento.value || null,
        tipoDeficiencia: refs.dependenteForm.elements.tipoDeficiencia.value,
        necessidadesApoio: refs.dependenteForm.elements.necessidadesApoio.value.trim(),
        observacoes: refs.dependenteForm.elements.observacoes.value.trim(),
        diagnosticoResumo: refs.dependenteForm.elements.diagnosticoResumo.value.trim(),
      };

      if (!payload.nome) {
        showToast("Informe o nome do dependente.");
        return;
      }

      try {
        await requestJson(`/api/pacientes/${dependente._id}`, {
          method: "PUT",
          body: payload,
        });
        closeDependenteForm();
        await loadDetail();
        setView("dependente");
      } catch (error) {
        showToast(error.message);
      }
    });

    refs.atendimentoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.registroMode === "edit" && !state.viewFlags.canEditAttendance) {
        showToast("Somente administracao pode editar atendimentos.");
        return;
      }
      if (state.registroMode !== "edit" && !state.viewFlags.canCreateAttendance) {
        showToast("Somente administracao pode registrar atendimentos.");
        return;
      }

      const payload = {
        pacienteId: refs.atendimentoForm.elements.pacienteId.value || null,
        profissionalId: refs.atendimentoForm.elements.profissionalId.value || null,
        tipo: refs.atendimentoForm.elements.tipo.value,
        dataHora:
          toIsoFromLocal(refs.atendimentoForm.elements.dataHora.value) ||
          new Date().toISOString(),
        resumo: refs.atendimentoForm.elements.resumo.value.trim(),
        proximosPassos: refs.atendimentoForm.elements.proximosPassos.value.trim(),
      };

      if (!payload.resumo) {
        showToast("Informe o resumo do atendimento.");
        return;
      }

      try {
        if (state.registroMode === "edit" && state.selectedAtendimentoId) {
          await requestJson(`/api/atendimentos/${state.selectedAtendimentoId}`, {
            method: "PUT",
            body: payload,
          });
        } else {
          await requestJson(`/api/familias/${familiaId}/atendimentos`, {
            method: "POST",
            body: payload,
          });
        }
        await loadDetail();
        if (state.registroMode === "edit" && state.selectedAtendimentoId) {
          setView("atendimento");
        } else {
          setView("historico");
        }
        setRegistroMode("create");
      } catch (error) {
        showToast(error.message);
      }
    });

    setView("pacientes", { syncRecordTab: false });
    activateRecordTab("overview");
    closePacienteForm();
    closeDependenteForm();
    renderProfissionalOptions();
    loadDetail();
  }

  window.FamiliaDetalhePage = { init };
})();
