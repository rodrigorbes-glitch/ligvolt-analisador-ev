/**
 * LIGVOLT - Aplicação Principal (App Entry Point)
 * Integração de Eventos DOM, Dossiê, Laudo e Compartilhamento
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  const UI = window.LigvoltUI;
  if (!UI) {
    console.error('LigvoltUI não carregado.');
    return;
  }

  // Inicializa checklist
  UI.initChecklistState();

  // 1. Vinculação das Abas Principais
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const target = this.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(p => p.classList.remove('active'));

      this.classList.add('active');
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');

      UI.state.activeTab = target;
    });
  });

  // 2. Presets Rápidos de Instalação
  const presetButtons = document.querySelectorAll('[data-quick-preset]');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const preset = this.dataset.quickPreset;
      applyInstallationPreset(preset);
    });
  });

  function applyInstallationPreset(preset) {
    if (preset === 'res-mono-32') {
      UI.state.supplyType = 'monofasica';
      UI.state.voltagePreset = 'custom';
      UI.state.voltageSingle = 220;
      UI.state.distance = 15;
      UI.state.mainBreakerKnown = true;
      UI.state.mainBreaker = 63;
      UI.state.demandKnown = true;
      UI.state.demandMode = 'total';
      UI.state.demandTotal = 20;
      UI.state.chargers = [
        { id: 1, name: 'Wallbox Residencial', nominalCurrent: 32, enabled: true, phaseConfig: 'L1-N' }
      ];
    } else if (preset === 'condo-2x32') {
      UI.state.supplyType = 'trifasica';
      UI.state.voltagePreset = '220_380';
      UI.state.distance = 30;
      UI.state.mainBreakerKnown = true;
      UI.state.mainBreaker = 125;
      UI.state.demandKnown = true;
      UI.state.demandMode = 'per_phase';
      UI.state.demandPhases = { L1: 30, L2: 30, L3: 30 };
      UI.state.chargers = [
        { id: 1, name: 'Wallbox Vaga 1', nominalCurrent: 32, enabled: true, phaseConfig: '3F' },
        { id: 2, name: 'Wallbox Vaga 2', nominalCurrent: 32, enabled: true, phaseConfig: '3F' }
      ];
    } else if (preset === 'comercial-4x32') {
      UI.state.supplyType = 'trifasica';
      UI.state.voltagePreset = '220_380';
      UI.state.distance = 45;
      UI.state.mainBreakerKnown = true;
      UI.state.mainBreaker = 200;
      UI.state.demandKnown = true;
      UI.state.demandMode = 'per_phase';
      UI.state.demandPhases = { L1: 60, L2: 55, L3: 65 };
      UI.state.chargers = [
        { id: 1, name: 'Totem Ponto 1', nominalCurrent: 32, enabled: true, phaseConfig: '3F' },
        { id: 2, name: 'Totem Ponto 2', nominalCurrent: 32, enabled: true, phaseConfig: '3F' },
        { id: 3, name: 'Totem Ponto 3', nominalCurrent: 32, enabled: true, phaseConfig: '3F' },
        { id: 4, name: 'Totem Ponto 4', nominalCurrent: 32, enabled: true, phaseConfig: '3F' }
      ];
    }
    syncFormInputsWithState();
    UI.renderChargersList();
    UI.recalculateAndRender();
  }

  // 3. Sincronização dos Inputs do Formulário com o Estado
  function syncFormInputsWithState() {
    const supplyRadio = document.querySelector(`input[name="supplyType"][value="${UI.state.supplyType}"]`);
    if (supplyRadio) supplyRadio.checked = true;

    const voltPresetSelect = document.getElementById('voltagePreset');
    if (voltPresetSelect) voltPresetSelect.value = UI.state.voltagePreset;
    toggleCustomVoltageInputs();

    const distInput = document.getElementById('inputDistance');
    if (distInput) distInput.value = UI.state.distance;

    const mainBrkInput = document.getElementById('inputMainBreaker');
    const mainBrkUnknown = document.getElementById('chkMainBreakerUnknown');
    if (mainBrkInput) {
      mainBrkInput.value = UI.state.mainBreakerKnown ? UI.state.mainBreaker : '';
      mainBrkInput.disabled = !UI.state.mainBreakerKnown;
    }
    if (mainBrkUnknown) mainBrkUnknown.checked = !UI.state.mainBreakerKnown;

    const demandUnknown = document.getElementById('chkDemandUnknown');
    if (demandUnknown) demandUnknown.checked = !UI.state.demandKnown;
    toggleDemandInputs();

    const cableInsulSelect = document.getElementById('selectCableInsulation');
    if (cableInsulSelect) cableInsulSelect.value = UI.state.cableInsulation;

    const installMethodSelect = document.getElementById('selectInstallMethod');
    if (installMethodSelect) installMethodSelect.value = UI.state.installationMethod;

    const groupingSelect = document.getElementById('selectGrouping');
    if (groupingSelect) groupingSelect.value = UI.state.groupingCircuits;

    const tempSelect = document.getElementById('selectAmbientTemp');
    if (tempSelect) tempSelect.value = UI.state.ambientTemp;

    const contMarginChk = document.getElementById('chkContinuousMargin');
    if (contMarginChk) contMarginChk.checked = UI.state.useContinuousMargin;

    const dropLimitInput = document.getElementById('inputMaxDrop');
    if (dropLimitInput) dropLimitInput.value = UI.state.maxVoltageDrop;
  }

  // 4. Tipo de Fornecimento
  document.querySelectorAll('input[name="supplyType"]').forEach(radio => {
    radio.addEventListener('change', function () {
      UI.state.supplyType = this.value;
      UI.state.chargers.forEach(ch => {
        if (UI.state.supplyType === 'monofasica') {
          ch.phaseConfig = 'L1-N';
        } else if (UI.state.supplyType === 'bifasica' && ch.phaseConfig === '3F') {
          ch.phaseConfig = 'L1-L2';
        }
      });
      toggleCustomVoltageInputs();
      toggleDemandInputs();
      UI.renderChargersList();
      UI.recalculateAndRender();
    });
  });

  // 5. Seletor de Tensão
  const voltPreset = document.getElementById('voltagePreset');
  if (voltPreset) {
    voltPreset.addEventListener('change', function () {
      UI.state.voltagePreset = this.value;
      toggleCustomVoltageInputs();
      UI.recalculateAndRender();
    });
  }

  function toggleCustomVoltageInputs() {
    const isCustom = UI.state.voltagePreset === 'custom';
    const customContainer = document.getElementById('customVoltageContainer');
    if (customContainer) {
      customContainer.style.display = isCustom ? 'flex' : 'none';
    }
  }

  const inputVfn = document.getElementById('inputVoltageFN');
  if (inputVfn) {
    inputVfn.addEventListener('input', function () {
      UI.state.voltagePhaseNeutral = parseFloat(this.value) || 220;
      UI.state.voltageSingle = UI.state.voltagePhaseNeutral;
      UI.recalculateAndRender();
    });
  }

  const inputVff = document.getElementById('inputVoltageFF');
  if (inputVff) {
    inputVff.addEventListener('input', function () {
      UI.state.voltagePhasePhase = parseFloat(this.value) || 380;
      UI.recalculateAndRender();
    });
  }

  // 6. Distância
  const inputDist = document.getElementById('inputDistance');
  if (inputDist) {
    inputDist.addEventListener('input', function () {
      UI.state.distance = parseFloat(this.value) || 0;
      UI.recalculateAndRender();
    });
  }

  // 7. Disjuntor Geral
  const inputMainBreaker = document.getElementById('inputMainBreaker');
  const chkMainBreakerUnknown = document.getElementById('chkMainBreakerUnknown');

  if (inputMainBreaker) {
    inputMainBreaker.addEventListener('input', function () {
      UI.state.mainBreaker = parseFloat(this.value) || 0;
      UI.state.mainBreakerKnown = true;
      if (chkMainBreakerUnknown) chkMainBreakerUnknown.checked = false;
      UI.recalculateAndRender();
    });
  }

  if (chkMainBreakerUnknown) {
    chkMainBreakerUnknown.addEventListener('change', function () {
      UI.state.mainBreakerKnown = !this.checked;
      if (inputMainBreaker) {
        inputMainBreaker.disabled = this.checked;
        if (this.checked) inputMainBreaker.value = '';
        else inputMainBreaker.value = UI.state.mainBreaker || 100;
      }
      UI.recalculateAndRender();
    });
  }

  // 8. Demanda Existente
  const chkDemandUnknown = document.getElementById('chkDemandUnknown');
  if (chkDemandUnknown) {
    chkDemandUnknown.addEventListener('change', function () {
      UI.state.demandKnown = !this.checked;
      toggleDemandInputs();
      UI.recalculateAndRender();
    });
  }

  const selectDemandMode = document.getElementById('selectDemandMode');
  if (selectDemandMode) {
    selectDemandMode.addEventListener('change', function () {
      UI.state.demandMode = this.value;
      toggleDemandInputs();
      UI.recalculateAndRender();
    });
  }

  const selectDemandUnit = document.getElementById('selectDemandUnit');
  if (selectDemandUnit) {
    selectDemandUnit.addEventListener('change', function () {
      UI.state.demandUnit = this.value;
      UI.recalculateAndRender();
    });
  }

  const inputDemandTotal = document.getElementById('inputDemandTotal');
  if (inputDemandTotal) {
    inputDemandTotal.addEventListener('input', function () {
      UI.state.demandTotal = parseFloat(this.value) || 0;
      UI.recalculateAndRender();
    });
  }

  const inputDemandL1 = document.getElementById('inputDemandL1');
  const inputDemandL2 = document.getElementById('inputDemandL2');
  const inputDemandL3 = document.getElementById('inputDemandL3');

  if (inputDemandL1) {
    inputDemandL1.addEventListener('input', function () {
      UI.state.demandPhases.L1 = parseFloat(this.value) || 0;
      UI.recalculateAndRender();
    });
  }
  if (inputDemandL2) {
    inputDemandL2.addEventListener('input', function () {
      UI.state.demandPhases.L2 = parseFloat(this.value) || 0;
      UI.recalculateAndRender();
    });
  }
  if (inputDemandL3) {
    inputDemandL3.addEventListener('input', function () {
      UI.state.demandPhases.L3 = parseFloat(this.value) || 0;
      UI.recalculateAndRender();
    });
  }

  function toggleDemandInputs() {
    const isKnown = UI.state.demandKnown;
    const isPerPhase = UI.state.demandMode === 'per_phase';
    const totalBox = document.getElementById('demandTotalBox');
    const phaseBox = document.getElementById('demandPhaseBox');
    const modeSelectBox = document.getElementById('demandModeBox');

    if (modeSelectBox) modeSelectBox.style.display = isKnown ? 'block' : 'none';

    if (totalBox) {
      totalBox.style.display = (isKnown && !isPerPhase) ? 'block' : 'none';
    }
    if (phaseBox) {
      phaseBox.style.display = (isKnown && isPerPhase) ? 'flex' : 'none';
    }
  }

  // 9. Parâmetros de Cabo e Instalação
  const selectCableInsul = document.getElementById('selectCableInsulation');
  if (selectCableInsul) {
    selectCableInsul.addEventListener('change', function () {
      UI.state.cableInsulation = this.value;
      UI.recalculateAndRender();
    });
  }

  const selectInstallMethod = document.getElementById('selectInstallMethod');
  if (selectInstallMethod) {
    selectInstallMethod.addEventListener('change', function () {
      UI.state.installationMethod = this.value;
      UI.recalculateAndRender();
    });
  }

  const selectGrouping = document.getElementById('selectGrouping');
  if (selectGrouping) {
    selectGrouping.addEventListener('change', function () {
      UI.state.groupingCircuits = parseInt(this.value, 10) || 1;
      UI.recalculateAndRender();
    });
  }

  const selectAmbientTemp = document.getElementById('selectAmbientTemp');
  if (selectAmbientTemp) {
    selectAmbientTemp.addEventListener('change', function () {
      UI.state.ambientTemp = parseFloat(this.value) || 30;
      UI.recalculateAndRender();
    });
  }

  const chkContinuousMargin = document.getElementById('chkContinuousMargin');
  if (chkContinuousMargin) {
    chkContinuousMargin.addEventListener('change', function () {
      UI.state.useContinuousMargin = this.checked;
      UI.recalculateAndRender();
    });
  }

  const inputMaxDrop = document.getElementById('inputMaxDrop');
  if (inputMaxDrop) {
    inputMaxDrop.addEventListener('input', function () {
      UI.state.maxVoltageDrop = parseFloat(this.value) || 4.0;
      UI.recalculateAndRender();
    });
  }

  // 10. Manipulação de Carregadores Dinâmicos
  const btnAddCharger = document.getElementById('btnAddCharger');
  if (btnAddCharger) {
    btnAddCharger.addEventListener('click', function () {
      if (UI.state.chargers.length >= 4) return;
      const newId = Date.now();
      const num = UI.state.chargers.length + 1;
      let defPhase = '3F';
      if (UI.state.supplyType === 'monofasica') defPhase = 'L1-N';
      else if (UI.state.supplyType === 'bifasica') defPhase = num % 2 === 0 ? 'L2-N' : 'L1-N';

      UI.state.chargers.push({
        id: newId,
        name: `Carregador ${num} (Vaga ${String.fromCharCode(64 + num)})`,
        nominalCurrent: 32,
        enabled: true,
        phaseConfig: defPhase
      });

      UI.renderChargersList();
      UI.recalculateAndRender();
    });
  }

  const chargersContainer = document.getElementById('chargersContainer');
  if (chargersContainer) {
    chargersContainer.addEventListener('input', function (e) {
      const target = e.target;
      const id = target.dataset.id;
      if (!id) return;
      const ch = UI.state.chargers.find(c => String(c.id) === String(id));
      if (!ch) return;

      if (target.dataset.action === 'update-name') {
        ch.name = target.value;
        UI.recalculateAndRender();
      } else if (target.dataset.action === 'update-current') {
        ch.nominalCurrent = parseFloat(target.value) || 0;
        UI.recalculateAndRender();
      }
    });

    chargersContainer.addEventListener('change', function (e) {
      const target = e.target;
      const id = target.dataset.id;
      if (!id) return;
      const ch = UI.state.chargers.find(c => String(c.id) === String(id));
      if (!ch) return;

      if (target.dataset.action === 'toggle-charger') {
        ch.enabled = target.checked;
        const card = target.closest('.charger-card');
        if (card) {
          card.classList.toggle('is-active', ch.enabled);
          card.classList.toggle('is-disabled', !ch.enabled);
        }
        UI.recalculateAndRender();
      } else if (target.dataset.action === 'update-phase') {
        ch.phaseConfig = target.value;
        UI.recalculateAndRender();
      }
    });

    chargersContainer.addEventListener('click', function (e) {
      const target = e.target;
      const id = target.dataset.id;
      if (!id) return;
      const ch = UI.state.chargers.find(c => String(c.id) === String(id));
      if (!ch) return;

      if (target.dataset.action === 'remove-charger') {
        UI.state.chargers = UI.state.chargers.filter(c => String(c.id) !== String(id));
        UI.renderChargersList();
        UI.recalculateAndRender();
      } else if (target.dataset.action === 'set-preset-current') {
        ch.nominalCurrent = parseFloat(target.dataset.val) || 32;
        UI.renderChargersList();
        UI.recalculateAndRender();
      }
    });
  }

  // 11. Eventos do Checklist de Conformidade
  const checklistContainer = document.getElementById('checklistContainer');
  if (checklistContainer) {
    checklistContainer.addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-check-pill');
      if (!btn) return;
      const itemId = btn.dataset.item;
      const val = btn.dataset.val;
      if (!itemId || !val) return;

      UI.state.checklistResponses[itemId] = val;

      const card = document.getElementById(`card-${itemId}`);
      if (card) {
        card.querySelectorAll('.btn-check-pill').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        card.className = `checklist-card status-border-${val}`;

        let riskBox = card.querySelector('.checklist-risk-alert');
        if (val === 'inadequado') {
          const itemDef = Compliance.CHECKLIST_ITEMS.find(i => i.id === itemId);
          if (!riskBox && itemDef) {
            riskBox = document.createElement('div');
            riskBox.className = 'checklist-risk-alert';
            riskBox.innerHTML = `<strong>⚠️ Risco e Consequência:</strong> ${itemDef.inadequateRisk}`;
            card.appendChild(riskBox);
          }
        } else if (riskBox) {
          riskBox.remove();
        }
      }

      UI.recalculateAndRender();
    });
  }

  const btnCheckAllAdequate = document.getElementById('btnCheckAllAdequate');
  if (btnCheckAllAdequate) {
    btnCheckAllAdequate.addEventListener('click', function () {
      Compliance.CHECKLIST_ITEMS.forEach(item => {
        UI.state.checklistResponses[item.id] = 'adequado';
      });
      UI.renderChecklist();
      UI.recalculateAndRender();
    });
  }

  const btnResetChecklist = document.getElementById('btnResetChecklist');
  if (btnResetChecklist) {
    btnResetChecklist.addEventListener('click', function () {
      Compliance.CHECKLIST_ITEMS.forEach(item => {
        UI.state.checklistResponses[item.id] = item.defaultStatus || 'nao_verificado';
      });
      UI.renderChecklist();
      UI.recalculateAndRender();
    });
  }

  // 12. Modal de Dossiê, Laudo e Relatório
  const btnCloseReport = document.getElementById('btnCloseReport');
  if (btnCloseReport) {
    btnCloseReport.addEventListener('click', UI.closeReportModal);
  }

  const btnPrintReportModal = document.getElementById('btnPrintReportModal');
  if (btnPrintReportModal) {
    btnPrintReportModal.addEventListener('click', UI.printReport);
  }

  const btnShareModal = document.getElementById('btnShareModal');
  if (btnShareModal) {
    btnShareModal.addEventListener('click', UI.shareQuickSummary);
  }

  const btnCopyModal = document.getElementById('btnCopyModal');
  if (btnCopyModal) {
    btnCopyModal.addEventListener('click', UI.copySummaryToClipboard);
  }

  // Alternância de tipos de documentos no Modal
  const docTabBtns = document.querySelectorAll('.doc-tab-btn');
  docTabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const docType = this.dataset.doc;
      docTabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      UI.openReportModal(docType);
    });
  });

  // Re-renderização live dos metadados no modal
  const metaInputs = document.querySelectorAll('.meta-field input');
  metaInputs.forEach(input => {
    input.addEventListener('input', function () {
      UI.openReportModal(UI.state.activeDocType);
    });
  });

  const reportModal = document.getElementById('reportModal');
  if (reportModal) {
    reportModal.addEventListener('click', function (e) {
      if (e.target === this) {
        UI.closeReportModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && reportModal && reportModal.classList.contains('is-open')) {
      UI.closeReportModal();
    }
  });

  // 13. Inicialização Completa
  syncFormInputsWithState();
  UI.renderChargersList();
  UI.renderChecklist();
  UI.recalculateAndRender();

  console.log('⚡ Ligvolt SPA com Central de Laudos, Memória de Cálculo e Pedido para Concessionária inicializado.');
});
