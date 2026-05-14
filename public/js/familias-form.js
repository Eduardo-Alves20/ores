(function () {
  const shared = window.FamiliasShared;
  if (!shared) return;

  const { parseJsonScript, requestJson } = shared;

  function init(root) {
    const form = document.getElementById("familia-form");
    if (!form) return;

    const feedback     = document.getElementById("familia-form-feedback");
    const mode         = root.getAttribute("data-mode");
    const familyId     = root.getAttribute("data-familia-id");
    const initial      = parseJsonScript("familia-form-initial", null);
    const initialAtivo = initial?.ativo ?? true;

    // ── Wizard elements ──────────────────────────────────────────────────
    const panels     = Array.from(form.querySelectorAll(".wizard-panel[data-panel]"));
    const stepItems  = Array.from(document.querySelectorAll(".wizard-step-item[data-step]"));
    const connectors = Array.from(document.querySelectorAll(".wizard-step-connector"));
    const totalSteps = stepItems.length;
    let   currentStep = 1;

    const elPrev      = document.getElementById("wizard-prev");
    const elNext      = document.getElementById("wizard-next");
    const elSaveDraft = document.getElementById("wizard-save-draft");
    const elSubmit    = document.getElementById("wizard-submit");
    const elStepLabel = document.getElementById("wizard-step-label");
    const elProgText  = document.getElementById("wizard-progress-text");
    const elProgFill  = document.getElementById("wizard-progress-fill");

    // ── Feedback ──────────────────────────────────────────────────────────
    function setFeedback(msg, type) {
      feedback.hidden      = !msg;
      feedback.textContent = msg || "";
      feedback.className   = "form-feedback" + (type ? " is-" + type : "");
    }

    // ── Progress / badges ─────────────────────────────────────────────────
    function getCompletedSteps() {
      return panels.reduce(function (acc, panel) {
        var step     = parseInt(panel.getAttribute("data-panel"), 10);
        if (isNaN(step) || step > totalSteps) return acc;
        var required = panel.querySelectorAll("[required]");
        if (required.length === 0) return acc;
        var allFilled = Array.from(required).every(function (f) { return f.value.trim().length > 0; });
        if (allFilled) acc.push(step);
        return acc;
      }, []);
    }

    function hasAnyData(panel) {
      var inputs = panel.querySelectorAll(
        "input:not([type='hidden']):not([type='radio']):not([type='checkbox']):not([readonly]), select, textarea"
      );
      return Array.from(inputs).some(function (f) { return f.value && f.value.trim().length > 0; });
    }

    function updateProgress() {
      var done = getCompletedSteps();
      var pct  = Math.round((done.length / totalSteps) * 100);

      if (elProgText) elProgText.textContent = done.length + " de " + totalSteps + " preenchidas — " + pct + "%";
      if (elProgFill) {
        elProgFill.style.width = pct + "%";
        elProgFill.parentElement.setAttribute("aria-valuenow", pct);
      }

      stepItems.forEach(function (item, i) {
        var step   = i + 1;
        var isDone = done.includes(step) && step !== currentStep;
        item.classList.toggle("is-active", step === currentStep);
        item.classList.toggle("is-done",   isDone);
        var circle = item.querySelector(".wizard-step-circle");
        if (circle) {
          circle.innerHTML = isDone
            ? '<i class="fa-solid fa-check" aria-hidden="true"></i>'
            : String(step);
        }
      });

      connectors.forEach(function (c, i) {
        c.classList.toggle("is-done", done.includes(i + 1));
      });

      // Badges: REVISADA (green) / EM PREENCHIMENTO (orange)
      panels.forEach(function (panel) {
        var step  = parseInt(panel.getAttribute("data-panel"), 10);
        var badge = panel.querySelector(".wizard-panel-badge");
        if (!badge) return;
        if (done.includes(step)) {
          badge.hidden    = false;
          badge.textContent = "REVISADA";
          badge.className = "wizard-panel-badge is-revisada";
        } else if (hasAnyData(panel)) {
          badge.hidden    = false;
          badge.textContent = "EM PREENCHIMENTO";
          badge.className = "wizard-panel-badge is-em-preenchimento";
        } else {
          badge.hidden = true;
        }
      });
    }

    // ── Navigate to step ─────────────────────────────────────────────────
    function showStep(step) {
      currentStep = step;
      panels.forEach(function (panel) {
        var n = parseInt(panel.getAttribute("data-panel"), 10);
        panel.hidden = n !== step;
      });
      if (elStepLabel) elStepLabel.textContent = "Etapa " + step + " de " + totalSteps;
      if (elPrev)   elPrev.hidden   = step === 1;
      if (elNext)   elNext.hidden   = step === totalSteps;
      if (elSubmit) elSubmit.hidden = step !== totalSteps;
      if (step === totalSteps) buildResumo();
      updateProgress();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ── Validate current step ────────────────────────────────────────────
    function validateStep(step) {
      var panel = form.querySelector('.wizard-panel[data-panel="' + step + '"]');
      if (!panel) return true;
      var required = panel.querySelectorAll("[required]");
      var valid = true;
      required.forEach(function (field) {
        var empty = !field.value.trim();
        field.classList.toggle("is-invalid", empty);
        if (empty) valid = false;
      });
      return valid;
    }

    // ── Navigation listeners ─────────────────────────────────────────────
    elNext && elNext.addEventListener("click", function () {
      setFeedback("", "");
      if (currentStep < totalSteps) showStep(currentStep + 1);
    });

    elPrev && elPrev.addEventListener("click", function () {
      setFeedback("", "");
      if (currentStep > 1) showStep(currentStep - 1);
    });

    stepItems.forEach(function (item, i) {
      item.addEventListener("click", function () {
        setFeedback("", "");
        showStep(i + 1);
      });
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); item.click(); }
      });
    });

    // ── Radio pills ───────────────────────────────────────────────────────
    function initRadioPills() {
      form.querySelectorAll(".radio-pill").forEach(function (label) {
        var input = label.querySelector("input[type='radio']");
        if (!input) return;
        function refresh() {
          var group = form.querySelectorAll('input[type="radio"][name="' + input.name + '"]');
          group.forEach(function (r) {
            var pill = r.closest(".radio-pill");
            if (pill) pill.classList.toggle("is-selected", r.checked);
          });
          updateProgress();
        }
        input.addEventListener("change", refresh);
        if (input.checked) refresh();
      });
    }
    initRadioPills();

    // ── Checkbox groups ───────────────────────────────────────────────────
    function initCheckboxGroups() {
      form.querySelectorAll("input[type='checkbox'][data-checkbox-group]").forEach(function (cb) {
        var option = cb.closest(".checkbox-option");
        function refresh() {
          if (option) option.classList.toggle("is-checked", cb.checked);
          updateProgress();
        }
        cb.addEventListener("change", refresh);
        if (cb.checked) refresh();
      });
    }
    initCheckboxGroups();

    function collectCheckboxGroups() {
      var groups = {};
      form.querySelectorAll("input[type='checkbox'][data-checkbox-group]").forEach(function (cb) {
        var grp = cb.getAttribute("data-checkbox-group");
        if (!grp) return;
        if (!groups[grp]) groups[grp] = [];
        if (cb.checked) groups[grp].push(cb.value);
      });
      var result = {};
      Object.keys(groups).forEach(function (grp) {
        result[grp] = groups[grp].join(",");
      });
      return result;
    }

    // ── Age calculation ───────────────────────────────────────────────────
    var dataNascInput = form.querySelector("[name='campoExtra_data_nascimento']");
    var idadeInput    = form.querySelector("[name='_idade_calculada']");
    var faixaInput    = form.querySelector("[name='_faixa_anamnese']");

    function calcAge() {
      var val = dataNascInput && dataNascInput.value;
      if (!val) return;
      var dob   = new Date(val);
      if (isNaN(dob)) return;
      var today = new Date();
      var age   = today.getFullYear() - dob.getFullYear();
      var m     = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (idadeInput) idadeInput.value = age + " anos";

      var faixaKey = age < 18 ? "crianca" : age < 60 ? "adulto" : "idoso";
      var faixaLabels = { crianca: "Criança / Adolescente", adulto: "Adulto", idoso: "Idoso" };
      if (faixaInput) faixaInput.value = faixaLabels[faixaKey] || faixaKey;

      var faixaRadio = form.querySelector('input[type="radio"][name="_faixa_sel"][value="' + faixaKey + '"]');
      if (faixaRadio && !faixaRadio.checked) {
        faixaRadio.checked = true;
        updateFaixaPanel(faixaKey);
        initRadioPills(); // refresh pill styles
      }
      updateProgress();
    }

    dataNascInput && dataNascInput.addEventListener("change", calcAge);

    // ── Faixa selector (anamnese panel header) ────────────────────────────
    var FAIXA_CONFIG = {
      crianca: {
        title: "Anamnese — Criança / Adolescente",
        label: "Ficha aplicada: Criança / Adolescente (até 17 anos)",
        desc:  "Adaptada para crianças e adolescentes. Desenvolvimento, vacinas, vida escolar e dinâmica familiar."
      },
      adulto: {
        title: "Anamnese — Adulto",
        label: "Ficha aplicada: Adulto (18–59 anos)",
        desc:  "Sugerida automaticamente pela idade do assistido. Doenças crônicas, hábitos de vida, saúde mental, trabalho e ocupação."
      },
      idoso: {
        title: "Anamnese — Idoso",
        label: "Ficha aplicada: Idoso (60+ anos)",
        desc:  "Adaptada para idosos. Polifarmácia, mobilidade, quedas, suporte social e condições crônicas."
      }
    };

    function updateFaixaPanel(faixaVal) {
      var cfg      = FAIXA_CONFIG[faixaVal] || FAIXA_CONFIG.adulto;
      var titleEl  = document.getElementById("anamnese-panel-title");
      var labelEl  = document.getElementById("anamnese-faixa-label");
      var descEl   = document.getElementById("anamnese-faixa-desc");
      if (titleEl) titleEl.textContent = cfg.title;
      if (labelEl) labelEl.textContent = cfg.label;
      if (descEl)  descEl.textContent  = cfg.desc;
    }

    form.querySelectorAll('input[type="radio"][name="_faixa_sel"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateFaixaPanel(radio.value);
      });
    });

    // ── Composição familiar (CF) table ────────────────────────────────────
    var cfRows   = [];
    var cfRowsEl = document.getElementById("cf-rows");
    var cfAddBtn = document.getElementById("cf-add-btn");

    if (initial && initial.camposExtras && initial.camposExtras.composicao_familiar) {
      try { cfRows = JSON.parse(initial.camposExtras.composicao_familiar); } catch (e) { cfRows = []; }
    }

    var CF_PARENTESCO = [
      ["", "Parentesco..."],
      ["conjuge", "Cônjuge / Companheiro(a)"], ["filho", "Filho(a)"],
      ["pai", "Pai / Mãe"], ["irmao", "Irmão / Irmã"],
      ["avo", "Avó / Avô"], ["neto", "Neto(a)"],
      ["tio", "Tio(a)"], ["sobrinho", "Sobrinho(a)"], ["outro", "Outro"],
    ];
    var CF_ESCOLARIDADE = [
      ["", "Escolaridade..."],
      ["sem_instrucao", "Sem instrução"], ["fundamental_i", "Fund. I"],
      ["fundamental_ii", "Fund. II"], ["medio", "Médio"], ["superior", "Superior"],
    ];

    function cfSelect(opts, val, cls) {
      return '<select class="input-control input-sm ' + (cls || "") + '">' +
        opts.map(function (o) {
          return '<option value="' + o[0] + '"' + (o[0] === val ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") +
      "</select>";
    }

    function renderCfTable() {
      if (!cfRowsEl) return;
      if (!cfRows.length) {
        cfRowsEl.innerHTML = '<p class="cf-empty-state" style="font-size:0.8rem;color:var(--muted);padding:10px 0;">Nenhum membro adicionado ainda.</p>';
        calcPerCapita();
        return;
      }
      cfRowsEl.innerHTML = cfRows.map(function (row, i) {
        return (
          '<div class="cf-table-row" data-cf-idx="' + i + '">' +
            '<input class="input-control input-sm cf-nome" type="text" placeholder="Nome completo" value="' + escHtml(row.nome || "") + '" />' +
            cfSelect(CF_PARENTESCO, row.parentesco || "", "cf-parentesco") +
            '<input class="input-control input-sm cf-idade" type="text" placeholder="Ex: 8" value="' + escHtml(row.idade || "") + '" maxlength="3" />' +
            cfSelect(CF_ESCOLARIDADE, row.escolaridade || "", "cf-escolaridade") +
            '<input class="input-control input-sm cf-ocupacao" type="text" placeholder="Ex: Estudante" value="' + escHtml(row.ocupacao || "") + '" />' +
            '<input class="input-control input-sm cf-renda" type="text" placeholder="R$" value="' + escHtml(row.renda || "") + '" />' +
            '<button type="button" class="cf-delete-btn" data-cf-idx="' + i + '" aria-label="Remover membro"><i class="fa-solid fa-times"></i></button>' +
          "</div>"
        );
      }).join("");

      cfRowsEl.querySelectorAll(".cf-nome").forEach(function (el, i) {
        el.addEventListener("input", function () { cfRows[i].nome = el.value; });
      });
      cfRowsEl.querySelectorAll(".cf-parentesco").forEach(function (el, i) {
        el.addEventListener("change", function () { cfRows[i].parentesco = el.value; });
      });
      cfRowsEl.querySelectorAll(".cf-idade").forEach(function (el, i) {
        el.addEventListener("input", function () { cfRows[i].idade = el.value; calcPerCapita(); });
      });
      cfRowsEl.querySelectorAll(".cf-escolaridade").forEach(function (el, i) {
        el.addEventListener("change", function () { cfRows[i].escolaridade = el.value; });
      });
      cfRowsEl.querySelectorAll(".cf-ocupacao").forEach(function (el, i) {
        el.addEventListener("input", function () { cfRows[i].ocupacao = el.value; });
      });
      cfRowsEl.querySelectorAll(".cf-renda").forEach(function (el, i) {
        el.addEventListener("input", function () { cfRows[i].renda = el.value; });
      });
      cfRowsEl.querySelectorAll(".cf-delete-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-cf-idx"), 10);
          cfRows.splice(idx, 1);
          renderCfTable();
        });
      });

      calcPerCapita();
    }

    cfAddBtn && cfAddBtn.addEventListener("click", function () {
      cfRows.push({ nome: "", parentesco: "", idade: "", escolaridade: "", ocupacao: "", renda: "" });
      renderCfTable();
    });

    renderCfTable();

    // ── Per capita calculation ────────────────────────────────────────────
    var rendaFamiliarInput    = document.getElementById("renda_familiar_total_input");
    var rendaPerCapitaDisplay = document.getElementById("renda_per_capita_display");

    function parseBRL(str) {
      if (!str) return 0;
      return parseFloat(String(str).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
    }

    function calcPerCapita() {
      if (!rendaPerCapitaDisplay) return;
      var renda       = parseBRL(rendaFamiliarInput && rendaFamiliarInput.value);
      var totalPessoas = 1 + cfRows.length;
      if (renda <= 0) { rendaPerCapitaDisplay.value = ""; return; }
      var perCapita = renda / totalPessoas;
      rendaPerCapitaDisplay.value = "R$ " + perCapita.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    rendaFamiliarInput && rendaFamiliarInput.addEventListener("input", calcPerCapita);

    // ── Upload cards / file preview ───────────────────────────────────────
    var uploadedFiles  = [];
    var annexoSection  = document.getElementById("annexo-files-section");
    var annexoList     = document.getElementById("annexo-files-list");
    var annexoTitle    = document.getElementById("annexo-files-title");

    function refreshAnnexoList() {
      if (!annexoList) return;
      if (!uploadedFiles.length) {
        if (annexoSection) annexoSection.hidden = true;
        return;
      }
      if (annexoSection) annexoSection.hidden = false;
      if (annexoTitle) annexoTitle.textContent = "Arquivos anexados (" + uploadedFiles.length + ")";
      annexoList.innerHTML = uploadedFiles.map(function (entry, i) {
        var file = entry && entry.file ? entry.file : null;
        if (!file) return "";
        var kb  = Math.round(file.size / 1024);
        var str = kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";
        return (
          '<div class="annexo-file-item" data-file-idx="' + i + '">' +
            '<i class="fa-solid fa-file-lines annexo-file-icon"></i>' +
            '<div class="annexo-file-info">' +
              '<span class="annexo-file-name">' + escHtml(file.name) + '</span>' +
              '<span class="annexo-file-size">' + str + '</span>' +
            "</div>" +
            '<button type="button" class="annexo-file-remove" aria-label="Remover"><i class="fa-solid fa-times"></i></button>' +
          "</div>"
        );
      }).join("");

      annexoList.querySelectorAll(".annexo-file-remove").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.closest("[data-file-idx]").getAttribute("data-file-idx"), 10);
          uploadedFiles.splice(idx, 1);
          refreshAnnexoList();
        });
      });
    }

    form.querySelectorAll(".upload-card input[type='file']").forEach(function (fileInput) {
      fileInput.addEventListener("change", function () {
        Array.from(fileInput.files).forEach(function (f) {
          uploadedFiles.push({
            fieldName: fileInput.name || "anexo_outros",
            file: f,
          });
        });
        fileInput.value = "";
        refreshAnnexoList();
      });
    });

    async function uploadAttachments(familyRecordId) {
      if (!familyRecordId || !uploadedFiles.length) {
        return { total: 0, anexos: [] };
      }

      var formData = new FormData();
      uploadedFiles.forEach(function (entry) {
        if (!entry || !entry.file) return;
        formData.append(entry.fieldName || "anexo_outros", entry.file, entry.file.name);
      });

      var response = await fetch("/api/familias/" + familyRecordId + "/anexos", {
        method: "POST",
        body: formData,
      });

      var contentType = response.headers.get("content-type") || "";
      var isJson = contentType.includes("application/json");
      var payload = isJson ? await response.json() : {};
      if (!response.ok) {
        throw new Error((payload && (payload.erro || payload.message)) || "Erro ao enviar anexos.");
      }

      uploadedFiles = [];
      refreshAnnexoList();
      return {
        total: Number(payload && payload.total ? payload.total : 0),
        anexos: Array.isArray(payload && payload.anexos) ? payload.anexos : [],
      };
    }

    // ── Collect payload ───────────────────────────────────────────────────
    function collectPayload() {
      var camposExtras = {};
      var seen = {};

      form.querySelectorAll("[data-custom-field-key]").forEach(function (field) {
        var key  = String(field.getAttribute("data-custom-field-key") || "").trim();
        var type = String(field.getAttribute("data-custom-field-type") || "texto").trim();
        if (!key) return;
        if (field.type === "radio") {
          if (!field.checked) return;
          if (seen[key]) return;
        }
        seen[key] = true;
        camposExtras[key] = type === "booleano"
          ? String(field.value || "").trim() === "true"
          : String(field.value || "").trim();
      });

      // Merge checkbox groups
      Object.assign(camposExtras, collectCheckboxGroups());

      // Composição familiar as JSON
      if (cfRows.length > 0) {
        camposExtras.composicao_familiar = JSON.stringify(cfRows);
      }

      return {
        responsavel: {
          nome:                      ((form.elements.responsavel_nome                 || {}).value || "").trim(),
          telefone:                  ((form.elements.responsavel_telefone             || {}).value || "").trim(),
          email:                     ((form.elements.responsavel_email                || {}).value || "").trim(),
          parentesco:                ((form.elements.responsavel_parentesco           || {}).value || "responsavel"),
          nomeResponsavel:           ((form.elements.responsavel_familiar_nome        || {}).value || "").trim(),
          cpfResponsavel:            ((form.elements.responsavel_familiar_cpf         || {}).value || "").trim(),
          dataNascimentoResponsavel: ((form.elements.responsavel_familiar_nascimento  || {}).value || "").trim(),
          telefoneResponsavel:       ((form.elements.responsavel_familiar_telefone    || {}).value || "").trim(),
          emailResponsavel:          ((form.elements.responsavel_familiar_email       || {}).value || "").trim(),
        },
        endereco: {
          cep:         ((form.elements.endereco_cep         || {}).value || "").trim(),
          rua:         ((form.elements.endereco_rua         || {}).value || "").trim(),
          numero:      ((form.elements.endereco_numero      || {}).value || "").trim(),
          bairro:      ((form.elements.endereco_bairro      || {}).value || "").trim(),
          cidade:      ((form.elements.endereco_cidade      || {}).value || "").trim(),
          estado:      ((form.elements.endereco_estado      || {}).value || "").trim().toUpperCase(),
          complemento: ((form.elements.endereco_complemento || {}).value || "").trim(),
        },
        observacoes:  ((form.elements.observacoes || {}).value || "").trim(),
        camposExtras,
      };
    }

    // ── Save ──────────────────────────────────────────────────────────────
    async function save(redirectAfter) {
      var payload = collectPayload();
      if (!payload.responsavel.nome || !payload.responsavel.telefone) {
        setFeedback("Preencha nome e telefone do assistido (Etapa 1).", "error");
        if (currentStep !== 1) showStep(1);
        return null;
      }
      if (
        !payload.responsavel.nomeResponsavel ||
        !payload.responsavel.cpfResponsavel ||
        !payload.responsavel.dataNascimentoResponsavel ||
        !payload.responsavel.telefoneResponsavel ||
        !payload.responsavel.emailResponsavel
      ) {
        setFeedback("Preencha os dados do responsavel familiar (nome, CPF, nascimento, telefone e e-mail).", "error");
        if (currentStep !== 1) showStep(1);
        return null;
      }

      var submitBtn = form.querySelector("button[type='submit']");
      var draftBtn  = document.getElementById("wizard-save-draft");
      if (submitBtn) submitBtn.disabled = true;
      if (draftBtn)  draftBtn.disabled  = true;

      try {
        var targetId = familyId;
        if (mode === "editar" && familyId) {
          await requestJson("/api/familias/" + familyId, { method: "PUT", body: payload });
          var nextAtivo = form.elements.ativo ? form.elements.ativo.value === "true" : initialAtivo;
          if (nextAtivo !== initialAtivo) {
            await requestJson("/api/familias/" + familyId + "/status", { method: "PATCH", body: { ativo: nextAtivo } });
          }
        } else {
          var created = await requestJson("/api/familias", { method: "POST", body: payload });
          targetId = created && created.familia && created.familia._id;
        }

        var uploadResult = { total: 0, anexos: [] };
        var uploadErrorMessage = "";
        if (targetId && uploadedFiles.length) {
          try {
            uploadResult = await uploadAttachments(targetId);
          } catch (uploadErr) {
            uploadErrorMessage = uploadErr && uploadErr.message
              ? String(uploadErr.message)
              : "Falha ao enviar anexos.";
          }
        }
        var uploadText = uploadResult.total > 0 ? " e " + uploadResult.total + " anexo(s) enviado(s)" : "";

        if (redirectAfter) {
          if (uploadErrorMessage) {
            setFeedback("Assistido salvo, mas os anexos falharam (" + uploadErrorMessage + "). Redirecionando...", "error");
          } else {
            setFeedback("Assistido salvo com sucesso" + uploadText + ". Redirecionando...", "success");
          }
          window.setTimeout(function () {
            window.location.href = targetId ? "/familias/" + targetId : "/familias";
          }, 500);
        } else {
          if (uploadErrorMessage) {
            setFeedback("Rascunho salvo, mas os anexos falharam (" + uploadErrorMessage + ").", "error");
          } else {
            setFeedback("Rascunho salvo com sucesso" + uploadText + ".", "success");
          }
          window.setTimeout(function () { setFeedback("", ""); }, 3000);
        }
        return targetId;
      } catch (err) {
        setFeedback(err.message || "Erro ao salvar.", "error");
        return null;
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (draftBtn)  draftBtn.disabled  = false;
      }
    }

    elSaveDraft && elSaveDraft.addEventListener("click", function () { save(false); });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      setFeedback("", "");
      await save(true);
    });

    form.addEventListener("input",  updateProgress);
    form.addEventListener("change", updateProgress);

    // ── Helpers ───────────────────────────────────────────────────────────
    function escHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function label(val) {
      return val && String(val).trim() ? String(val).trim() : null;
    }

    // ── Resumo builder ────────────────────────────────────────────────────
    var LABELS_SEXO = {
      masculino: "Masculino", feminino: "Feminino",
      intersexo: "Intersexo", nao_informado: "Não informado"
    };
    var LABELS_ESTADO_CIVIL = {
      solteiro: "Solteiro(a)", casado: "Casado(a)",
      uniao_estavel: "União estável", divorciado: "Divorciado(a)",
      viuvo: "Viúvo(a)", separado: "Separado(a)"
    };
    var LABELS_MORADIA = {
      propria: "Própria", alugada: "Alugada", cedida: "Cedida",
      ocupacao: "Ocupação", abrigo: "Abrigo / Alojamento", sem_moradia: "Sem moradia fixa"
    };

    function humanize(map, val) {
      return (map && val && map[val]) ? map[val] : val;
    }

    function buildResumo() {
      var container = document.getElementById("resumo-content");
      if (!container) return;

      var p  = collectPayload();
      var cx = p.camposExtras || {};
      var e  = p.endereco    || {};

      var cfSection = { icon: "fa-people-roof", title: "Composição familiar", fields: [] };
      if (cfRows.length > 0) {
        cfRows.forEach(function (row, i) {
          var details = [row.parentesco, row.idade ? row.idade + " anos" : null, row.ocupacao].filter(Boolean).join(" · ");
          cfSection.fields.push([row.nome || ("Membro " + (i + 1)), details || null]);
        });
      } else {
        cfSection.fields.push(["Membros", null]);
      }

      var sections = [
        {
          icon: "fa-id-card",
          title: "Identificação",
          fields: [
            ["Nome completo", label(p.responsavel.nome)],
            ["Nome social",   label(cx.nome_social)],
            ["CPF",           label(cx.cpf)],
            ["RG",            label(cx.rg ? cx.rg + (cx.orgao_emissor ? " — " + cx.orgao_emissor : "") : null)],
            ["Data de nasc.", label(cx.data_nascimento)],
            ["Idade",         idadeInput ? label(idadeInput.value) : null],
            ["Faixa etária",  faixaInput ? label(faixaInput.value) : null],
          ],
        },
        {
          icon: "fa-person",
          title: "Características pessoais",
          fields: [
            ["Sexo biológico", humanize(LABELS_SEXO, cx.sexo_biologico)],
            ["Estado civil",   humanize(LABELS_ESTADO_CIVIL, cx.estado_civil)],
            ["Cor / raça",     label(cx.cor_raca)],
            ["Naturalidade",   label(cx.naturalidade)],
            ["Nacionalidade",  label(cx.nacionalidade)],
          ],
        },
        {
          icon: "fa-phone",
          title: "Contato",
          fields: [
            ["Telefone principal",  label(p.responsavel.telefone)],
            ["Telefone secundário", label(cx.telefone_secundario)],
            ["WhatsApp",            cx.is_whatsapp === "sim" ? "Sim" : cx.is_whatsapp === "nao" ? "Não" : null],
            ["Email",               label(p.responsavel.email)],
          ],
        },
        {
          icon: "fa-user-shield",
          title: "Responsavel familiar",
          fields: [
            ["Nome",       label(p.responsavel.nomeResponsavel)],
            ["CPF",        label(p.responsavel.cpfResponsavel)],
            ["Nascimento", label(p.responsavel.dataNascimentoResponsavel)],
            ["Telefone",   label(p.responsavel.telefoneResponsavel)],
            ["Email",      label(p.responsavel.emailResponsavel)],
          ],
        },
        {
          icon: "fa-location-dot",
          title: "Endereço",
          fields: [
            ["Logradouro",      [e.rua, e.numero, e.complemento].filter(Boolean).join(", ") || null],
            ["Bairro",          label(e.bairro)],
            ["Cidade / UF",     [e.cidade, e.estado].filter(Boolean).join(" / ") || null],
            ["CEP",             label(e.cep)],
            ["Tipo de moradia", humanize(LABELS_MORADIA, cx.tipo_moradia)],
          ],
        },
        cfSection,
        {
          icon: "fa-coins",
          title: "Situação socioeconômica",
          fields: [
            ["Situação de trabalho", label(cx.situacao_trabalho)],
            ["Escolaridade",         label(cx.escolaridade)],
            ["Renda familiar",       cx.renda_familiar ? "R$ " + cx.renda_familiar : null],
            ["Renda per capita",     rendaPerCapitaDisplay ? label(rendaPerCapitaDisplay.value) : null],
            ["Benefícios sociais",   cx.beneficios_sociais ? cx.beneficios_sociais.split(",").join(", ") : null],
          ],
        },
        {
          icon: "fa-clipboard-list",
          title: "Diagnóstico social",
          fields: [
            ["Hipótese diagnóstica", label(cx.hipotese_diagnostica)],
            ["Principal demanda",    label(cx.demanda_principal)],
            ["Vulnerabilidades",     cx.vulnerabilidades ? cx.vulnerabilidades.split(",").join(", ") : null],
            ["Observações gerais",   label(p.observacoes)],
          ],
        },
      ];

      container.innerHTML = sections.map(function (sec) {
        var rows = sec.fields.filter(function (f) { return f[1]; });
        if (!rows.length) return "";
        return (
          '<div class="resumo-secao">' +
            '<h3 class="resumo-secao-title">' +
              '<span class="form-subsection-icon"><i class="fa-solid ' + sec.icon + '" aria-hidden="true"></i></span>' +
              sec.title +
            "</h3>" +
            '<div class="resumo-secao-grid">' +
              rows.map(function (row) {
                return (
                  '<div class="resumo-campo">' +
                    '<span class="resumo-campo-label">' + row[0] + "</span>" +
                    '<span class="resumo-campo-value">' + row[1] + "</span>" +
                  "</div>"
                );
              }).join("") +
            "</div>" +
          "</div>"
        );
      }).join("");
    }

    // ── Init ──────────────────────────────────────────────────────────────
    calcAge();
    showStep(1);
  }

  window.FamiliasFormPage = { init };
})();
