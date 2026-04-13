(function () {
  window.createFamiliaDetalheUi = function createFamiliaDetalheUi({
    refs,
    shared,
    state,
  }) {
    const {
      escapeHtml,
      formatAtendimentoTipoLabel,
      formatDate,
      formatDateTime,
    } = shared;
    const can = (flagName) => Boolean(state?.viewFlags?.[flagName]);

    function toDateInputValue(dateLike) {
      if (!dateLike) return "";
      const dt = new Date(dateLike);
      if (Number.isNaN(dt.getTime())) return "";
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function toDateTimeLocalValue(dateLike) {
      if (!dateLike) return "";
      const dt = new Date(dateLike);
      if (Number.isNaN(dt.getTime())) return "";
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      const hour = String(dt.getHours()).padStart(2, "0");
      const minute = String(dt.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    function getSelectedDependente() {
      if (!state.selectedDependenteId) return null;
      return (
        state.currentPacientes.find(
          (paciente) => String(paciente._id) === String(state.selectedDependenteId),
        ) || null
      );
    }

    function syncDependenteBreadcrumb() {
      if (!refs.breadcrumbDependente || !refs.breadcrumbDependenteSep) return;
      const dependente = getSelectedDependente();
      const showDependenteCrumb =
        state.activeView === "dependente" &&
        Boolean(String(dependente?.nome || "").trim());

      refs.breadcrumbDependente.hidden = !showDependenteCrumb;
      refs.breadcrumbDependenteSep.hidden = !showDependenteCrumb;

      if (showDependenteCrumb) {
        refs.breadcrumbDependente.textContent = `Dependente: ${String(
          dependente.nome,
        ).trim()}`;
      } else {
        refs.breadcrumbDependente.textContent = "Dependente";
      }
    }

    function getAtendimentoPaciente(item) {
      const itemPacienteId = item?.pacienteId?._id || item?.pacienteId || null;
      return (
        state.currentPacientes.find(
          (paciente) => String(paciente._id) === String(itemPacienteId),
        ) || null
      );
    }

    function formatProfissionalLabel(profissional) {
      const nome = String(profissional?.nome || "").trim();
      const login = String(profissional?.login || "").trim();
      if (nome && login && nome.toLowerCase() !== login.toLowerCase()) {
        return `${nome} (${login})`;
      }
      return nome || login || "Voluntario";
    }

    function getAtendimentoProfissional(item) {
      const rawProfissional = item?.profissionalId || null;
      const profissionalId = rawProfissional?._id || rawProfissional || null;
      if (rawProfissional && typeof rawProfissional === "object" && rawProfissional._id) {
        return rawProfissional;
      }
      return (
        state.currentVoluntarios.find(
          (profissional) => String(profissional._id) === String(profissionalId),
        ) || null
      );
    }

    function renderProfissionalOptions(selectedId = "") {
      if (!refs.profissionalSelect) return;

      const baseOption = '<option value="">Sem profissional especificado</option>';
      const options = state.currentVoluntarios.map(
        (profissional) => {
          const profissionalId = escapeHtml(String(profissional?._id || ""));
          return `<option value="${profissionalId}">${escapeHtml(
            formatProfissionalLabel(profissional),
          )}</option>`;
        },
      );

      refs.profissionalSelect.innerHTML = [baseOption].concat(options).join("");
      refs.profissionalSelect.value = selectedId ? String(selectedId) : "";
    }

    function getSelectedAtendimento() {
      if (!state.selectedAtendimentoId) return null;
      return (
        state.currentAtendimentos.find(
          (atendimento) => String(atendimento._id) === String(state.selectedAtendimentoId),
        ) || null
      );
    }

    function closePacienteForm() {
      if (!refs.pacienteForm) return;
      refs.pacienteForm.reset();
      refs.pacienteForm.hidden = true;
      if (refs.pacienteNovoBtn) refs.pacienteNovoBtn.hidden = !can("canCreatePatient");
    }

    function openPacienteForm() {
      if (!can("canCreatePatient") || !refs.pacienteForm) return;
      refs.pacienteForm.hidden = false;
      if (refs.pacienteNovoBtn) refs.pacienteNovoBtn.hidden = true;
      const nomeInput = refs.pacienteForm.elements.nome;
      if (nomeInput) nomeInput.focus();
    }

    function closeDependenteForm() {
      if (!refs.dependenteForm) return;
      refs.dependenteForm.reset();
      refs.dependenteForm.hidden = true;
      if (refs.dependenteEditarBtn) refs.dependenteEditarBtn.hidden = !can("canEditPatient");
    }

    function openDependenteForm(paciente) {
      if (!can("canEditPatient") || !paciente || !refs.dependenteForm) return;
      refs.dependenteForm.elements.nome.value = paciente.nome || "";
      refs.dependenteForm.elements.dataNascimento.value = toDateInputValue(
        paciente.dataNascimento,
      );
      refs.dependenteForm.elements.tipoDeficiencia.value =
        paciente.tipoDeficiencia || "outra";
      refs.dependenteForm.elements.necessidadesApoio.value =
        paciente.necessidadesApoio || "";
      refs.dependenteForm.elements.observacoes.value = paciente.observacoes || "";
      refs.dependenteForm.elements.diagnosticoResumo.value =
        paciente.diagnosticoResumo || "";
      refs.dependenteForm.hidden = false;
      if (refs.dependenteEditarBtn) refs.dependenteEditarBtn.hidden = true;
      const nomeInput = refs.dependenteForm.elements.nome;
      if (nomeInput) nomeInput.focus();
    }

    function renderDependenteFicha() {
      const dependente = getSelectedDependente();
      if (!dependente) {
        refs.dependenteDetalhe.innerHTML =
          '<p class="empty-hint">Selecione um dependente para visualizar a ficha.</p>';
        if (refs.dependenteEditarBtn) {
          refs.dependenteEditarBtn.disabled = true;
          refs.dependenteEditarBtn.hidden = !can("canEditPatient");
        }
        syncDependenteBreadcrumb();
        return;
      }

      if (refs.dependenteEditarBtn) {
        refs.dependenteEditarBtn.disabled = !can("canEditPatient");
        refs.dependenteEditarBtn.hidden = !can("canEditPatient");
      }

      const statusClass = dependente.ativo ? "status-active" : "status-inactive";
      const statusLabel = dependente.ativo ? "Ativo" : "Inativo";
      const toggleLabel = dependente.ativo ? "Inativar" : "Reativar";
      const dependenteId = escapeHtml(String(dependente?._id || ""));
      const statusAction = can("canTogglePatientStatus")
        ? `<button class="mini-btn mini-btn-warn" type="button" data-type="dependente-status" data-id="${dependenteId}" data-next="${String(!dependente.ativo)}">${escapeHtml(toggleLabel)}</button>`
        : '<span class="section-subtitle">Somente administracao pode alterar o status.</span>';

      refs.dependenteDetalhe.innerHTML = `
        <div class="stack-card-content">
          <h4>${escapeHtml(dependente.nome || "-")}</h4>
          <p><strong>Nascimento:</strong> ${escapeHtml(formatDate(dependente.dataNascimento))}</p>
          <p><strong>Tipo:</strong> ${escapeHtml(dependente.tipoDeficiencia || "-")}</p>
          <p><strong>Necessidades de apoio:</strong> ${escapeHtml(dependente.necessidadesApoio || "-")}</p>
          <p><strong>Observacoes:</strong> ${escapeHtml(dependente.observacoes || "-")}</p>
          <p><strong>Diagnostico / laudo:</strong> ${escapeHtml(dependente.diagnosticoResumo || "-")}</p>
        </div>
        <div class="stack-actions">
          <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
          ${statusAction}
        </div>
      `;
      syncDependenteBreadcrumb();
    }

    function renderAtendimentoFicha() {
      const atendimento = getSelectedAtendimento();
      if (!atendimento) {
        refs.atendimentoDetalhe.innerHTML =
          '<p class="empty-hint">Selecione um atendimento no historico para visualizar a ficha.</p>';
        if (refs.atendimentoEditarBtn) {
          refs.atendimentoEditarBtn.disabled = true;
          refs.atendimentoEditarBtn.hidden = !can("canEditAttendance");
        }
        return;
      }

      if (refs.atendimentoEditarBtn) {
        refs.atendimentoEditarBtn.disabled = !can("canEditAttendance");
        refs.atendimentoEditarBtn.hidden = !can("canEditAttendance");
      }

      const paciente = getAtendimentoPaciente(atendimento);
      const profissional = getAtendimentoProfissional(atendimento);
      const statusClass = atendimento.ativo ? "status-active" : "status-inactive";
      const statusLabel = atendimento.ativo ? "Ativo" : "Inativo";
      const toggleLabel = atendimento.ativo ? "Inativar" : "Reativar";
      const atendimentoId = escapeHtml(String(atendimento?._id || ""));
      const statusAction = can("canToggleAttendanceStatus")
        ? `<button class="mini-btn mini-btn-warn" type="button" data-type="atendimento-status" data-id="${atendimentoId}" data-next="${String(!atendimento.ativo)}">${escapeHtml(toggleLabel)}</button>`
        : '<span class="section-subtitle">Somente administracao pode alterar o status.</span>';
      const tipoLabel = formatAtendimentoTipoLabel(atendimento.tipo);
      const resumoSafe = escapeHtml(atendimento.resumo || "-");
      const proximosSafe = escapeHtml(atendimento.proximosPassos || "-");

      refs.atendimentoDetalhe.innerHTML = `
        <article class="consulta-card consulta-card-detalhe">
          <header class="consulta-card-head">
            <h4 class="consulta-card-title">Atendimento ${escapeHtml(tipoLabel)}</h4>
            <span class="consulta-card-mark"></span>
          </header>
          <div class="consulta-card-body">
            <p class="consulta-label">Data da consulta</p>
            <p class="consulta-value consulta-value-primary">${escapeHtml(
              formatDateTime(atendimento.dataHora),
            )}</p>

            <p class="consulta-label">Dependente</p>
            <p class="consulta-value consulta-value-success">${escapeHtml(
              paciente?.nome || "Nao informado",
            )}</p>

            <p class="consulta-label">Profissional / voluntario</p>
            <p class="consulta-value consulta-value-success">${escapeHtml(
              profissional ? formatProfissionalLabel(profissional) : "Nao informado",
            )}</p>

            <hr class="consulta-divider" />

            <p class="consulta-label">Status</p>
            <p class="consulta-value consulta-value-accent">${escapeHtml(
              statusLabel.toUpperCase(),
            )}</p>

            <p class="consulta-meta"><strong>Resumo:</strong> ${resumoSafe}</p>
            <p class="consulta-meta"><strong>Proximos passos:</strong> ${proximosSafe}</p>

            <div class="stack-actions">
              <span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span>
              ${statusAction}
            </div>
          </div>
        </article>
      `;
    }

    function setRegistroMode(mode, atendimento = null) {
      state.registroMode = mode === "edit" ? "edit" : "create";

      if (state.registroMode === "edit" && atendimento) {
        refs.registroPanelTitle.textContent = "Editar Atendimento";
        refs.atendimentoSubmitBtn.textContent = "Salvar Alteracoes";
        refs.registroVoltarBtn.textContent = "Voltar ao Atendimento";
        refs.atendimentoForm.elements.pacienteId.value = String(
          atendimento?.pacienteId?._id || atendimento?.pacienteId || "",
        );
        refs.atendimentoForm.elements.profissionalId.value = String(
          atendimento?.profissionalId?._id || atendimento?.profissionalId || "",
        );
        refs.atendimentoForm.elements.tipo.value = atendimento.tipo || "outro";
        refs.atendimentoForm.elements.dataHora.value = toDateTimeLocalValue(
          atendimento.dataHora,
        );
        refs.atendimentoForm.elements.resumo.value = atendimento.resumo || "";
        refs.atendimentoForm.elements.proximosPassos.value =
          atendimento.proximosPassos || "";
        return;
      }

      refs.registroPanelTitle.textContent = "Registrar Atendimento";
      refs.atendimentoSubmitBtn.textContent = "Salvar Atendimento";
      refs.registroVoltarBtn.textContent = "Voltar ao Historico";
      refs.atendimentoForm.reset();
      refs.atendimentoForm.elements.profissionalId.value = "";
    }

    function openRegistroCreate(origin = "historico") {
      if (!can("canCreateAttendance")) return;
      state.registroOrigin = origin;
      setRegistroMode("create");
      setView("registro");
    }

    function openRegistroEdit(atendimento) {
      if (!can("canEditAttendance") || !atendimento) return;
      state.registroOrigin = "atendimento";
      setRegistroMode("edit", atendimento);
      setView("registro");
    }

    function setView(view) {
      state.activeView = view;

      refs.panelPacientes.hidden = view !== "pacientes";
      refs.panelDependente.hidden = view !== "dependente";
      refs.panelHistorico.hidden = view !== "historico";
      refs.panelPresencas.hidden = view !== "presencas";
      refs.panelAtendimento.hidden = view !== "atendimento";
      refs.panelRegistro.hidden = view !== "registro";

      refs.panelPacientes.classList.toggle("is-active", view === "pacientes");
      refs.panelDependente.classList.toggle("is-active", view === "dependente");
      refs.panelHistorico.classList.toggle("is-active", view === "historico");
      refs.panelPresencas.classList.toggle("is-active", view === "presencas");
      refs.panelAtendimento.classList.toggle("is-active", view === "atendimento");
      refs.panelRegistro.classList.toggle("is-active", view === "registro");

      if (view === "pacientes") {
        refs.workflowTitle.textContent = "Ficha de Dependentes";
        refs.workflowSubtitle.textContent =
          can("canEditPatient") || can("canCreatePatient")
            ? "Gestao dos dependentes vinculados a esta familia."
            : "Consulta dos dependentes vinculados a esta familia.";
        refs.workflowMainBtn.hidden = false;
        refs.workflowMainBtn.textContent = "Historico de atendimento";
        refs.workflowBackBtn.hidden = true;
      } else if (view === "dependente") {
        refs.workflowTitle.textContent = "Ficha do Dependente";
        refs.workflowSubtitle.textContent = can("canEditPatient")
          ? "Dados completos do dependente e edicao segura."
          : "Dados completos do dependente em modo de leitura.";
        refs.workflowMainBtn.hidden = false;
        refs.workflowMainBtn.textContent = "Historico de atendimento";
        refs.workflowBackBtn.hidden = false;
        refs.workflowBackBtn.textContent = "Voltar aos dependentes";
      } else if (view === "historico") {
        refs.workflowTitle.textContent = "Historico de Atendimentos";
        refs.workflowSubtitle.textContent = can("canCreateAttendance")
          ? "Linha do tempo completa das interacoes com a familia."
          : "Linha do tempo completa das interacoes com a familia em modo de leitura.";
        refs.workflowMainBtn.hidden = !can("canCreateAttendance");
        refs.workflowMainBtn.textContent = "Registrar atendimento";
        refs.workflowBackBtn.hidden = false;
        refs.workflowBackBtn.textContent = "Ficha de dependentes";
      } else if (view === "presencas") {
        refs.workflowTitle.textContent = "Controle de Presenca";
        refs.workflowSubtitle.textContent =
          "Consultas da agenda com faltas, presencas e justificativas desta familia.";
        refs.workflowMainBtn.hidden = true;
        refs.workflowBackBtn.hidden = true;
      } else if (view === "atendimento") {
        refs.workflowTitle.textContent = "Ficha do Atendimento";
        refs.workflowSubtitle.textContent =
          "Detalhes completos do atendimento selecionado.";
        refs.workflowMainBtn.hidden = true;
        refs.workflowBackBtn.hidden = false;
        refs.workflowBackBtn.textContent = "Voltar ao historico";
      } else {
        refs.workflowTitle.textContent =
          state.registroMode === "edit" ? "Editar Atendimento" : "Registrar Atendimento";
        refs.workflowSubtitle.textContent =
          state.registroMode === "edit"
            ? "Atualize as informacoes e salve as alteracoes."
            : "Preencha os dados e salve o novo registro.";
        refs.workflowMainBtn.hidden = true;
        refs.workflowBackBtn.hidden = false;
        refs.workflowBackBtn.textContent =
          state.registroOrigin === "atendimento"
            ? "Voltar ao atendimento"
            : "Voltar ao historico";
      }

      const activeTab =
        view === "pacientes" || view === "dependente"
          ? "pacientes"
          : view === "presencas"
            ? "presencas"
            : "historico";
      refs.workflowTabs.forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.workflowTab === activeTab);
      });

      if (view !== "pacientes") closePacienteForm();
      if (view !== "dependente") closeDependenteForm();
      syncDependenteBreadcrumb();
    }

    function renderResumo(familia) {
      state.currentFamilia = familia;
      document.getElementById("resumo-nome").textContent =
        familia?.responsavel?.nome || "-";
      document.getElementById("resumo-telefone").textContent =
        familia?.responsavel?.telefone || "-";
      document.getElementById("resumo-email").textContent =
        familia?.responsavel?.email || "-";
      document.getElementById("resumo-observacoes").textContent =
        familia?.observacoes || "-";

      const endereco = [
        familia?.endereco?.rua,
        familia?.endereco?.numero,
        familia?.endereco?.bairro,
        familia?.endereco?.cidade,
        familia?.endereco?.estado,
      ]
        .filter(Boolean)
        .join(", ");
      document.getElementById("resumo-endereco").textContent = endereco || "-";

      refs.statusBadge.textContent = familia?.ativo ? "Ativa" : "Inativa";
      refs.statusBadge.className = `status-badge ${
        familia?.ativo ? "status-active" : "status-inactive"
      }`;
      if (refs.statusBtn) {
        refs.statusBtn.textContent = familia?.ativo
          ? "Inativar Familia"
          : "Reativar Familia";
        refs.statusBtn.hidden = !can("canToggleFamilyStatus");
      }

      if (refs.familiaStatusPill) {
        refs.familiaStatusPill.textContent = familia?.ativo
          ? "Familia ativa"
          : "Familia inativa";
        refs.familiaStatusPill.className = `familias-hero-tag ${
          familia?.ativo ? "is-success" : "is-neutral"
        }`;
      }
    }

    function renderPacientes(pacientes) {
      state.currentPacientes = pacientes;
      refs.pacientesCount.textContent = String(pacientes.length);
      if (refs.familiaPacientesPill) {
        refs.familiaPacientesPill.textContent = `${pacientes.length} dependente${
          pacientes.length === 1 ? "" : "s"
        }`;
      }
      if (
        state.selectedDependenteId &&
        !pacientes.some(
          (paciente) => String(paciente._id) === String(state.selectedDependenteId),
        )
      ) {
        state.selectedDependenteId = null;
      }

      if (!pacientes.length) {
        refs.pacientesLista.innerHTML =
          '<p class="empty-hint">Nenhum dependente vinculado.</p>';
      } else {
        refs.pacientesLista.innerHTML = pacientes
          .map((paciente) => {
            const toggleLabel = paciente.ativo ? "Inativar" : "Reativar";
            const pacienteId = escapeHtml(String(paciente?._id || ""));
            return `
              <article class="stack-card stack-card-clickable" data-type="dependente-open" data-id="${pacienteId}" role="button" tabindex="0" aria-label="Abrir ficha de ${escapeHtml(paciente.nome || "dependente")}">
                <div>
                  <h4>${escapeHtml(paciente.nome || "-")}</h4>
                  <p><strong>Tipo:</strong> ${escapeHtml(paciente.tipoDeficiencia || "-")}</p>
                  <p><strong>Nascimento:</strong> ${escapeHtml(formatDate(paciente.dataNascimento))}</p>
                  <p><strong>Apoio:</strong> ${escapeHtml(paciente.necessidadesApoio || "-")}</p>
                </div>
                <div class="stack-actions">
                  <span class="status-badge ${
                    paciente.ativo ? "status-active" : "status-inactive"
                  }">${escapeHtml(paciente.ativo ? "Ativo" : "Inativo")}</span>
                  ${
                    can("canTogglePatientStatus")
                      ? `<button class="mini-btn mini-btn-warn" type="button" data-type="paciente-status" data-id="${pacienteId}" data-next="${String(!paciente.ativo)}">${escapeHtml(toggleLabel)}</button>`
                      : ""
                  }
                </div>
              </article>
            `;
          })
          .join("");
      }

      if (refs.pacienteSelect) {
        const options = ['<option value="">Sem dependente especifico</option>'].concat(
          pacientes
            .filter((paciente) => paciente.ativo)
            .map(
              (paciente) =>
                `<option value="${escapeHtml(String(paciente?._id || ""))}">${escapeHtml(
                  paciente.nome,
                )}</option>`,
            ),
        );
        refs.pacienteSelect.innerHTML = options.join("");
      }
      syncDependenteBreadcrumb();
    }

    function renderAtendimentos(atendimentos) {
      state.currentAtendimentos = atendimentos;
      refs.atendimentosCount.textContent = String(atendimentos.length);
      if (refs.familiaAtendimentosPill) {
        refs.familiaAtendimentosPill.textContent = `${atendimentos.length} atendimento${
          atendimentos.length === 1 ? "" : "s"
        }`;
      }
      if (
        state.selectedAtendimentoId &&
        !atendimentos.some(
          (atendimento) => String(atendimento._id) === String(state.selectedAtendimentoId),
        )
      ) {
        state.selectedAtendimentoId = null;
      }

      if (!atendimentos.length) {
        refs.atendimentosLista.innerHTML =
          '<p class="empty-hint">Nenhum atendimento registrado.</p>';
        renderAtendimentoFicha();
        return;
      }

      refs.atendimentosLista.innerHTML = atendimentos
        .map((item) => {
          const paciente = getAtendimentoPaciente(item);
          const profissional = getAtendimentoProfissional(item);
          const toggleLabel = item.ativo ? "Inativar" : "Reativar";
          const tipoLabel = formatAtendimentoTipoLabel(item.tipo);
          const selectedClass =
            String(state.selectedAtendimentoId || "") === String(item._id)
              ? "consulta-card-selected"
              : "";
          const atendimentoId = escapeHtml(String(item?._id || ""));
          const resumoRaw = String(item.resumo || "-");
          const resumoCorto = escapeHtml(
            resumoRaw.length > 180 ? `${resumoRaw.slice(0, 180)}...` : resumoRaw,
          );

          return `
            <article class="consulta-card consulta-card-clickable ${selectedClass}" data-type="atendimento-open" data-id="${atendimentoId}" role="button" tabindex="0" aria-label="Abrir ficha do atendimento">
              <header class="consulta-card-head">
                <h4 class="consulta-card-title">Atendimento ${escapeHtml(tipoLabel)}</h4>
                <span class="consulta-card-mark"></span>
              </header>
              <div class="consulta-card-body">
                <p class="consulta-label">Data da consulta</p>
                <p class="consulta-value consulta-value-primary">${escapeHtml(
                  formatDateTime(item.dataHora),
                )}</p>

                <p class="consulta-label">Dependente</p>
                <p class="consulta-value consulta-value-success">${escapeHtml(
                  paciente?.nome || "Nao informado",
                )}</p>

                <p class="consulta-label">Voluntario atendido</p>
                <p class="consulta-value">${escapeHtml(
                  profissional ? formatProfissionalLabel(profissional) : "Nao informado",
                )}</p>

                <hr class="consulta-divider" />

                <p class="consulta-label">Status</p>
                <p class="consulta-value consulta-value-accent">${escapeHtml(
                  item.ativo ? "ATIVO" : "INATIVO",
                )}</p>

                <p class="consulta-meta"><strong>Resumo:</strong> ${resumoCorto}</p>
                <div class="stack-actions">
                  <span class="status-badge ${
                    item.ativo ? "status-active" : "status-inactive"
                  }">${escapeHtml(item.ativo ? "Ativo" : "Inativo")}</span>
                  ${
                    can("canToggleAttendanceStatus")
                      ? `<button class="mini-btn mini-btn-warn" type="button" data-type="atendimento-status" data-id="${atendimentoId}" data-next="${String(!item.ativo)}">${escapeHtml(toggleLabel)}</button>`
                      : ""
                  }
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      renderAtendimentoFicha();
    }

    function openDependenteViewById(id) {
      if (!id) return;
      state.selectedDependenteId = String(id);
      renderDependenteFicha();
      setView("dependente");
    }

    function openAtendimentoViewById(id) {
      if (!id) return;
      state.selectedAtendimentoId = String(id);
      renderAtendimentos(state.currentAtendimentos);
      setView("atendimento");
    }

    return {
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
      renderAtendimentoFicha,
      renderDependenteFicha,
      renderPacientes,
      renderProfissionalOptions,
      renderResumo,
      setRegistroMode,
      setView,
    };
  };
})();
