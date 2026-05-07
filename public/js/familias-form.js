(function () {
  const shared = window.FamiliasShared;
  if (!shared) return;

  const { parseJsonScript, requestJson } = shared;

  function init(root) {
    const form = document.getElementById("familia-form");
    if (!form) return;

    const feedback    = document.getElementById("familia-form-feedback");
    const mode        = root.getAttribute("data-mode");
    const familyId    = root.getAttribute("data-familia-id");
    const initial     = parseJsonScript("familia-form-initial", null);
    const initialAtivo = initial?.ativo ?? true;

    // ── Wizard elements ──────────────────────────────────────────────────
    const panels      = Array.from(form.querySelectorAll(".wizard-panel[data-panel]"));
    const stepItems   = Array.from(document.querySelectorAll(".wizard-step-item[data-step]"));
    const connectors  = Array.from(document.querySelectorAll(".wizard-step-connector"));
    const totalSteps  = stepItems.length;
    let   currentStep = 1;

    const elPrev       = document.getElementById("wizard-prev");
    const elNext       = document.getElementById("wizard-next");
    const elSaveDraft  = document.getElementById("wizard-save-draft");
    const elSubmit     = document.getElementById("wizard-submit");
    const elStepLabel  = document.getElementById("wizard-step-label");
    const elProgText   = document.getElementById("wizard-progress-text");
    const elProgFill   = document.getElementById("wizard-progress-fill");

    // ── Feedback ──────────────────────────────────────────────────────────
    function setFeedback(msg, type) {
      feedback.hidden    = !msg;
      feedback.textContent = msg || "";
      feedback.className = "form-feedback" + (type ? " is-" + type : "");
    }

    // ── Progress ──────────────────────────────────────────────────────────
    function getCompletedSteps() {
      return panels.reduce(function (acc, panel, i) {
        var step = parseInt(panel.getAttribute("data-panel"), 10);
        if (isNaN(step) || step > totalSteps) return acc;
        var required = panel.querySelectorAll("[required]");
        if (required.length === 0) return acc;
        var allFilled = Array.from(required).every(function (f) { return f.value.trim().length > 0; });
        if (allFilled) acc.push(step);
        return acc;
      }, []);
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

      // connector state
      connectors.forEach(function (c, i) {
        c.classList.toggle("is-done", done.includes(i + 1));
      });

      // REVISADA badges
      panels.forEach(function (panel) {
        var step  = parseInt(panel.getAttribute("data-panel"), 10);
        var badge = panel.querySelector(".wizard-panel-badge");
        if (badge) badge.hidden = !done.includes(step);
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
      if (!validateStep(currentStep)) {
        setFeedback("Preencha os campos obrigatórios antes de avançar.", "error");
        return;
      }
      setFeedback("", "");
      if (currentStep < totalSteps) showStep(currentStep + 1);
    });

    elPrev && elPrev.addEventListener("click", function () {
      setFeedback("", "");
      if (currentStep > 1) showStep(currentStep - 1);
    });

    stepItems.forEach(function (item, i) {
      item.addEventListener("click", function () {
        var target = i + 1;
        var done   = getCompletedSteps();
        if (target < currentStep || done.includes(target) || target === currentStep) {
          setFeedback("", "");
          showStep(target);
        }
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

    // ── Age / faixa calculation ───────────────────────────────────────────
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
      if (faixaInput) {
        if      (age < 2)  faixaInput.value = "Bebê";
        else if (age < 12) faixaInput.value = "Criança";
        else if (age < 18) faixaInput.value = "Adolescente";
        else if (age < 60) faixaInput.value = "Adulto";
        else               faixaInput.value = "Idoso";
      }
      updateProgress();
    }

    dataNascInput && dataNascInput.addEventListener("change", calcAge);
    calcAge();

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
        }
        if (seen[key] && field.type === "radio") return;
        seen[key] = true;

        if (type === "booleano") {
          camposExtras[key] = String(field.value || "").trim() === "true";
          return;
        }
        camposExtras[key] = String(field.value || "").trim();
      });

      return {
        responsavel: {
          nome:       ((form.elements.responsavel_nome       || {}).value || "").trim(),
          telefone:   ((form.elements.responsavel_telefone   || {}).value || "").trim(),
          email:      ((form.elements.responsavel_email      || {}).value || "").trim(),
          parentesco: ((form.elements.responsavel_parentesco || {}).value || "responsavel"),
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
        observacoes: ((form.elements.observacoes || {}).value || "").trim(),
        camposExtras: camposExtras,
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

        if (redirectAfter) {
          setFeedback("Assistido salvo com sucesso. Redirecionando...", "success");
          window.setTimeout(function () {
            window.location.href = targetId ? "/familias/" + targetId : "/familias";
          }, 500);
        } else {
          setFeedback("Rascunho salvo com sucesso.", "success");
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

    // ── Progress on any change ────────────────────────────────────────────
    form.addEventListener("input",  updateProgress);
    form.addEventListener("change", updateProgress);

    // ── Resumo builder ────────────────────────────────────────────────────
    function label(val) {
      return val && String(val).trim() ? String(val).trim() : null;
    }

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

      var sections = [
        {
          icon: "fa-id-card",
          title: "Identificação",
          fields: [
            ["Nome completo",    label(p.responsavel.nome)],
            ["Nome social",      label(cx.nome_social)],
            ["CPF",              label(cx.cpf)],
            ["RG",               label(cx.rg ? cx.rg + (cx.orgao_emissor ? " — " + cx.orgao_emissor : "") : null)],
            ["Data de nasc.",    label(cx.data_nascimento)],
            ["Idade",            idadeInput ? label(idadeInput.value) : null],
            ["Faixa",            faixaInput ? label(faixaInput.value) : null],
          ],
        },
        {
          icon: "fa-person",
          title: "Características pessoais",
          fields: [
            ["Sexo biológico",       humanize(LABELS_SEXO, cx.sexo_biologico)],
            ["Estado civil",         humanize(LABELS_ESTADO_CIVIL, cx.estado_civil)],
            ["Cor / raça",           label(cx.cor_raca)],
            ["Naturalidade",         label(cx.naturalidade)],
            ["Nacionalidade",        label(cx.nacionalidade)],
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
          icon: "fa-location-dot",
          title: "Endereço",
          fields: [
            ["Logradouro", [e.rua, e.numero, e.complemento].filter(Boolean).join(", ") || null],
            ["Bairro",     label(e.bairro)],
            ["Cidade / UF",[e.cidade, e.estado].filter(Boolean).join(" / ") || null],
            ["CEP",        label(e.cep)],
            ["Tipo de moradia", humanize(LABELS_MORADIA, cx.tipo_moradia)],
          ],
        },
        {
          icon: "fa-coins",
          title: "Situação socioeconômica",
          fields: [
            ["Situação de trabalho", label(cx.situacao_trabalho)],
            ["Escolaridade",         label(cx.escolaridade)],
            ["Renda individual",     cx.renda_individual ? "R$ " + cx.renda_individual : null],
            ["Renda familiar",       cx.renda_familiar   ? "R$ " + cx.renda_familiar   : null],
            ["Nº pessoas na casa",   label(cx.pessoas_residencia)],
            ["Benefícios",           label(cx.beneficios)],
          ],
        },
        {
          icon: "fa-clipboard-list",
          title: "Diagnóstico social",
          fields: [
            ["Principal demanda",    label(cx.demanda_principal)],
            ["CRAS / CREAS",         label(cx.cras_referencia)],
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
            '</h3>' +
            '<div class="resumo-secao-grid">' +
              rows.map(function (row) {
                return (
                  '<div class="resumo-campo">' +
                    '<span class="resumo-campo-label">' + row[0] + '</span>' +
                    '<span class="resumo-campo-value">' + row[1] + '</span>' +
                  '</div>'
                );
              }).join("") +
            '</div>' +
          '</div>'
        );
      }).join("");
    }

    // ── Init ──────────────────────────────────────────────────────────────
    calcAge();
    showStep(1);
  }

  window.FamiliasFormPage = { init };
})();
