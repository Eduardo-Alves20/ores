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

    function onlyDigits(value, maxLength) {
      var digits = String(value || "").replace(/\D+/g, "");
      if (Number.isFinite(maxLength) && maxLength > 0) {
        return digits.slice(0, maxLength);
      }
      return digits;
    }

    function sanitizeTextValue(value, maxLength) {
      var normalized = String(value || "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
        .replace(/[<>]/g, "")
        .trim();
      if (Number.isFinite(maxLength) && maxLength > 0) {
        return normalized.slice(0, maxLength);
      }
      return normalized;
    }

    function sanitizeEmailValue(value) {
      var normalized = sanitizeTextValue(value, 140).toLowerCase();
      if (!normalized) return "";
      var emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRx.test(normalized) ? normalized : "";
    }

    function maskCpf(value) {
      var digits = onlyDigits(value, 11);
      return digits
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    }

    function maskPhone(value) {
      var digits = onlyDigits(value, 11);
      if (digits.length <= 10) {
        return digits
          .replace(/^(\d{2})(\d)/, "($1) $2")
          .replace(/(\d{4})(\d)/, "$1-$2");
      }
      return digits
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2");
    }

    function maskCep(value) {
      var digits = onlyDigits(value, 8);
      return digits.replace(/^(\d{5})(\d)/, "$1-$2");
    }

    function maskNis(value) {
      var digits = onlyDigits(value, 11);
      return digits
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{5})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{2})(\d)/, ".$1-$2");
    }

    function applyMask(mask, value) {
      if (mask === "cpf") return maskCpf(value);
      if (mask === "phone") return maskPhone(value);
      if (mask === "cep") return maskCep(value);
      if (mask === "nis") return maskNis(value);
      return value;
    }

    function initInputMasksAndNumericGuards() {
      form.querySelectorAll("[data-mask], [data-only-digits]").forEach(function (field) {
        var mask = String(field.getAttribute("data-mask") || "").trim();
        var maxDigits = Number.parseInt(String(field.getAttribute("data-only-digits") || ""), 10);

        function enforce() {
          var raw = String(field.value || "");
          var digits = Number.isFinite(maxDigits) && maxDigits > 0
            ? onlyDigits(raw, maxDigits)
            : onlyDigits(raw);

          if (mask) {
            field.value = applyMask(mask, digits);
            return;
          }
          field.value = digits;
        }

        field.addEventListener("input", enforce);
        field.addEventListener("blur", enforce);
        enforce();
      });
    }
    initInputMasksAndNumericGuards();

    var enderecoCepInput = form.elements.endereco_cep || null;
    var enderecoRuaInput = form.elements.endereco_rua || null;
    var enderecoBairroInput = form.elements.endereco_bairro || null;
    var enderecoCidadeInput = form.elements.endereco_cidade || null;
    var enderecoEstadoInput = form.elements.endereco_estado || null;
    var cepLookupInFlight = false;
    var lastResolvedCep = "";

    async function autoFillAddressFromCep() {
      if (!enderecoCepInput) return;
      var cepDigits = onlyDigits(enderecoCepInput.value, 8);
      if (cepDigits.length !== 8) return;
      if (cepLookupInFlight || lastResolvedCep === cepDigits) return;

      cepLookupInFlight = true;
      try {
        var response = await fetch("https://viacep.com.br/ws/" + cepDigits + "/json/");
        if (!response.ok) return;
        var data = await response.json();
        if (!data || data.erro) return;

        if (enderecoRuaInput) enderecoRuaInput.value = sanitizeTextValue(data.logradouro, 160);
        if (enderecoBairroInput) enderecoBairroInput.value = sanitizeTextValue(data.bairro, 80);
        if (enderecoCidadeInput) enderecoCidadeInput.value = sanitizeTextValue(data.localidade, 80);
        if (enderecoEstadoInput) {
          var uf = sanitizeTextValue(data.uf, 2).toUpperCase();
          enderecoEstadoInput.value = uf;
        }

        lastResolvedCep = cepDigits;
        updateProgress();
      } catch (_) {
        // Sem bloquear o fluxo caso a API esteja indisponível.
      } finally {
        cepLookupInFlight = false;
      }
    }

    if (enderecoCepInput) {
      enderecoCepInput.addEventListener("blur", autoFillAddressFromCep);
      enderecoCepInput.addEventListener("change", autoFillAddressFromCep);
      if (
        onlyDigits(enderecoCepInput.value, 8).length === 8 &&
        enderecoRuaInput &&
        !String(enderecoRuaInput.value || "").trim()
      ) {
        autoFillAddressFromCep();
      }
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

      var faixaKey = age <= 12 ? "crianca" : age < 18 ? "adolescente" : age < 60 ? "adulto" : "idoso";
      var faixaLabels = { crianca: "Crianca", adolescente: "Adolescente", adulto: "Adulto", idoso: "Idoso" };
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
    if (dataNascInput && dataNascInput.value) calcAge();

    // ── Faixa selector (anamnese panel header) ────────────────────────────
    var FAIXA_CONFIG = {
      crianca: {
        title: "Anamnese - Crianca",
        label: "Ficha aplicada: Crianca (0-12 anos)",
        desc:  "Adaptada para criancas. Desenvolvimento, rotina familiar, linguagem, escolaridade e comportamento."
      },
      adolescente: {
        title: "Anamnese - Adolescente",
        label: "Ficha aplicada: Adolescente (13-17 anos)",
        desc:  "Adaptada para adolescentes. Historico de vida, escolaridade, comportamento, vinculos e desenvolvimento afetivo-sexual."
      },
      adulto: {
        title: "Anamnese - Adulto",
        label: "Ficha aplicada: Adulto (18-59 anos)",
        desc:  "Adaptada para adultos. Historico de vida, vida adulta, comportamento, escolaridade e trabalho."
      },
      idoso: {
        title: "Anamnese - Idoso",
        label: "Ficha aplicada: Idoso (60+ anos)",
        desc:  "Adaptada para idosos. Aspectos fisicos, cognitivos e psicologicos da terceira idade, historico medico e rede de cuidado."
      }
    };

    function updateFaixaPanel(faixaVal) {
      var cfg      = FAIXA_CONFIG[faixaVal] || FAIXA_CONFIG.adulto;
      var titleEl  = document.getElementById("anamnese-panel-title");
      var labelEl  = document.getElementById("anamnese-faixa-label");
      var descEl   = document.getElementById("anamnese-faixa-desc");
      var childEl  = document.getElementById("anamnese-form-crianca");
      var adolescenteEl = document.getElementById("anamnese-form-adolescente");
      var adultoEl = document.getElementById("anamnese-form-adulto");
      var idosoEl = document.getElementById("anamnese-form-idoso");
      var geralEl  = document.getElementById("anamnese-form-geral");
      if (titleEl) titleEl.textContent = cfg.title;
      if (labelEl) labelEl.textContent = cfg.label;
      if (descEl)  descEl.textContent  = cfg.desc;
      if (childEl) childEl.hidden = faixaVal !== "crianca";
      if (adolescenteEl) adolescenteEl.hidden = faixaVal !== "adolescente";
      if (adultoEl) adultoEl.hidden = faixaVal !== "adulto";
      if (idosoEl) idosoEl.hidden = faixaVal !== "idoso";
      if (geralEl) geralEl.hidden = faixaVal === "crianca" || faixaVal === "adolescente" || faixaVal === "adulto" || faixaVal === "idoso";
    }

    form.querySelectorAll('input[type="radio"][name="_faixa_sel"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) updateFaixaPanel(radio.value);
      });
    });
    var faixaSelecionada = form.querySelector('input[type="radio"][name="_faixa_sel"]:checked');
    updateFaixaPanel(faixaSelecionada ? faixaSelecionada.value : "adulto");

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
    var uploadCardFilesByField = {};

    form.querySelectorAll(".upload-card").forEach(function (card) {
      var input = card.querySelector("input[type='file']");
      if (!input) return;
      var fieldName = String(input.name || "anexo_outros").trim() || "anexo_outros";
      var container = card.querySelector("[data-upload-files-for]");
      if (!container) return;
      uploadCardFilesByField[fieldName] = container;
    });

    function formatFileSize(sizeInBytes) {
      var kb = Math.round(Number(sizeInBytes || 0) / 1024);
      return kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";
    }

    function refreshAnnexoList() {
      Object.keys(uploadCardFilesByField).forEach(function (fieldName) {
        var container = uploadCardFilesByField[fieldName];
        if (!container) return;

        var filesInCard = uploadedFiles
          .map(function (entry, idx) {
            if (!entry || entry.fieldName !== fieldName || !entry.file) return null;
            return { index: idx, file: entry.file };
          })
          .filter(Boolean);

        if (!filesInCard.length) {
          container.hidden = true;
          container.innerHTML = "";
          return;
        }

        container.hidden = false;
        container.innerHTML =
          '<div class="upload-card-files-title">Arquivos anexados (' + filesInCard.length + ')</div>' +
          '<div class="annexo-files-list">' +
          filesInCard.map(function (item) {
            return (
              '<div class="annexo-file-item" data-file-idx="' + item.index + '">' +
                '<i class="fa-solid fa-file-lines annexo-file-icon" aria-hidden="true"></i>' +
                '<div class="annexo-file-info">' +
                  '<span class="annexo-file-name">' + escHtml(item.file.name) + '</span>' +
                  '<span class="annexo-file-meta">' + formatFileSize(item.file.size) + '</span>' +
                "</div>" +
                '<button type="button" class="annexo-file-remove" aria-label="Remover arquivo"><i class="fa-solid fa-times"></i></button>' +
              "</div>"
            );
          }).join("") +
          "</div>";

        container.querySelectorAll(".annexo-file-remove").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var idx = parseInt(btn.closest("[data-file-idx]").getAttribute("data-file-idx"), 10);
            if (Number.isNaN(idx)) return;
            uploadedFiles.splice(idx, 1);
            refreshAnnexoList();
          });
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
        if (type === "booleano") {
          camposExtras[key] = String(field.value || "").trim() === "true";
          return;
        }
        if (type === "numero") {
          camposExtras[key] = sanitizeTextValue(String(field.value || "").replace(/[^0-9,.\-]/g, ""), 40);
          return;
        }
        if (type === "data") {
          camposExtras[key] = sanitizeTextValue(field.value, 10);
          return;
        }
        camposExtras[key] = sanitizeTextValue(field.value, type === "textarea" ? 5000 : 320);
      });

      // Merge checkbox groups
      Object.assign(camposExtras, collectCheckboxGroups());

      // Composição familiar as JSON
      if (cfRows.length > 0) {
        camposExtras.composicao_familiar = JSON.stringify(cfRows);
      }

      return {
        responsavel: {
          nome:                      sanitizeTextValue((form.elements.responsavel_nome                 || {}).value || "", 120),
          telefone:                  maskPhone((form.elements.responsavel_telefone             || {}).value || ""),
          email:                     sanitizeEmailValue((form.elements.responsavel_email                || {}).value || ""),
          parentesco:                sanitizeTextValue((form.elements.responsavel_parentesco           || {}).value || "", 60),
          nomeResponsavel:           sanitizeTextValue((form.elements.responsavel_familiar_nome        || {}).value || "", 120),
          cpfResponsavel:            maskCpf((form.elements.responsavel_familiar_cpf         || {}).value || ""),
          dataNascimentoResponsavel: sanitizeTextValue((form.elements.responsavel_familiar_nascimento  || {}).value || "", 10),
          telefoneResponsavel:       maskPhone((form.elements.responsavel_familiar_telefone    || {}).value || ""),
          emailResponsavel:          sanitizeEmailValue((form.elements.responsavel_familiar_email       || {}).value || ""),
        },
        endereco: {
          cep:         maskCep((form.elements.endereco_cep         || {}).value || ""),
          rua:         sanitizeTextValue((form.elements.endereco_rua         || {}).value || "", 160),
          numero:      sanitizeTextValue((form.elements.endereco_numero      || {}).value || "", 20),
          bairro:      sanitizeTextValue((form.elements.endereco_bairro      || {}).value || "", 80),
          cidade:      sanitizeTextValue((form.elements.endereco_cidade      || {}).value || "", 80),
          estado:      sanitizeTextValue((form.elements.endereco_estado      || {}).value || "", 2).toUpperCase(),
          complemento: sanitizeTextValue((form.elements.endereco_complemento || {}).value || "", 120),
        },
        observacoes:  sanitizeTextValue((form.elements.observacoes || {}).value || "", 3000),
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
        !payload.responsavel.dataNascimentoResponsavel
      ) {
        setFeedback("Preencha os dados obrigatorios do responsavel familiar (nome, CPF e nascimento).", "error");
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
            ["Responsável ou filiação", label(cx.responsavel_ou_filiacao || cx.nome_social)],
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
