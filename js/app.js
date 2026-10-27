/**
 * LIGVOLT - Aplicação Principal (App Entry Point) - Redesign Light Mode SaaS
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

  // 1. Vinculação das Abas Principais (Dimensionamento e Segurança)
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
    if (preset === 'bifasica-padrao') {
      UI.state.supplyType = 'bifasica';
      UI.state.voltagePreset = '127_220';
      UI.state.distance = 20;
      UI.state.mainBreakerKnown = true;
      UI.state.mainBreaker = 50;
      UI.state.demandKnown = true;
      UI.state.demandMode = 'total';
      UI.state.demandTotal = 15;
      UI.state.chargers = [
        { id: 1, name: 'Wallbox Residencial (F-F)', nominalCurrent: 32, enabled: true, phaseConfig: 'L1-L2' }
      ];
    } else if (preset === 'res-mono-32') {
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
    UI.showToast('✓ Cenário aplicado com sucesso!');
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
      UI.syncTechnicalToVistoria('supplyType', this.value);
    });
  });

  // 5. Seletor de Tensão
  const voltPreset = document.getElementById('voltagePreset');
  if (voltPreset) {
    voltPreset.addEventListener('change', function () {
      UI.state.voltagePreset = this.value;
      toggleCustomVoltageInputs();
      UI.recalculateAndRender();
      UI.syncTechnicalToVistoria('voltagePreset', this.value);
    });
  }

  function toggleCustomVoltageInputs() {
    const isCustom = UI.state.voltagePreset === 'custom';
    const customContainer = document.getElementById('customVoltageContainer');
    if (customContainer) {
      customContainer.style.display = isCustom ? 'grid' : 'none';
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
      UI.syncTechnicalToVistoria('distance', this.value);
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
      UI.syncTechnicalToVistoria('mainBreaker', this.value);
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

    if (modeSelectBox) modeSelectBox.style.display = isKnown ? 'grid' : 'none';

    if (totalBox) {
      totalBox.style.display = (isKnown && !isPerPhase) ? 'block' : 'none';
    }
    if (phaseBox) {
      phaseBox.style.display = (isKnown && isPerPhase) ? 'grid' : 'none';
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

  // Acordeão de Configurações Avançadas
  const btnToggleAdvanced = document.getElementById('btnToggleAdvanced');
  const accordionContent = document.getElementById('accordionAdvancedContent');
  const accordionArrow = document.getElementById('accordionArrow');

  if (btnToggleAdvanced && accordionContent) {
    btnToggleAdvanced.addEventListener('click', function () {
      const isOpen = accordionContent.classList.toggle('is-open');
      if (accordionArrow) accordionArrow.textContent = isOpen ? '▲' : '▼';
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

        let riskBox = card.querySelector('.check-risk-box');
        if (val === 'inadequado') {
          const itemDef = Compliance.CHECKLIST_ITEMS.find(i => i.id === itemId);
          if (!riskBox && itemDef) {
            riskBox = document.createElement('div');
            riskBox.className = 'check-risk-box';
            riskBox.innerHTML = `<strong>⚠️ Ponto de Atenção:</strong> ${itemDef.inadequateRisk}`;
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
  const btnExportHeader = document.getElementById('btnExportHeader');
  if (btnExportHeader) {
    btnExportHeader.addEventListener('click', () => {
      // Se estiver na vistoria, abre o laudo de vistoria; se no avançado, abre o relatório de engenharia
      const isVistoria = document.getElementById('mode-vistoria') && !document.getElementById('mode-vistoria').classList.contains('is-hidden');
      UI.openReportModal(isVistoria ? 'vistoria_preliminar' : 'relatorio');
    });
  }

  const btnExportBottom = document.getElementById('btnExportBottom');
  if (btnExportBottom) btnExportBottom.addEventListener('click', () => UI.openReportModal('relatorio'));

  const btnShareBottom = document.getElementById('btnShareBottom');
  if (btnShareBottom) btnShareBottom.addEventListener('click', UI.shareQuickSummary);

  const btnCloseReport = document.getElementById('btnCloseReport');
  if (btnCloseReport) btnCloseReport.addEventListener('click', UI.closeReportModal);

  const btnPrintReportModal = document.getElementById('btnPrintReportModal');
  if (btnPrintReportModal) btnPrintReportModal.addEventListener('click', UI.printReport);

  const btnShareModal = document.getElementById('btnShareModal');
  if (btnShareModal) btnShareModal.addEventListener('click', UI.shareQuickSummary);

  const btnCopyModal = document.getElementById('btnCopyModal');
  if (btnCopyModal) btnCopyModal.addEventListener('click', UI.copySummaryToClipboard);

  const docTabBtns = document.querySelectorAll('.doc-tab-btn');
  docTabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const docType = this.dataset.doc;
      docTabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      UI.openReportModal(docType);
    });
  });

  const metaInputs = document.querySelectorAll('.meta-field input');
  metaInputs.forEach(input => {
    input.addEventListener('input', function () {
      UI.openReportModal(UI.state.activeDocType);
    });
  });

  // Limpar / Reset Geral
  function resetAllForm() {
    UI.state.distance = 25;
    UI.state.supplyType = 'trifasica';
    UI.state.voltagePreset = '220_380';
    UI.state.mainBreakerKnown = true;
    UI.state.mainBreaker = 100;
    UI.state.demandKnown = true;
    UI.state.demandMode = 'per_phase';
    UI.state.demandPhases = { L1: 30, L2: 25, L3: 20 };
    UI.state.chargers = [
      { id: 1, name: 'Carregador 1 (Vaga A)', nominalCurrent: 32, enabled: true, phaseConfig: '3F' },
      { id: 2, name: 'Carregador 2 (Vaga B)', nominalCurrent: 32, enabled: true, phaseConfig: '3F' }
    ];
    Compliance.CHECKLIST_ITEMS.forEach(item => {
      UI.state.checklistResponses[item.id] = item.defaultStatus || 'nao_verificado';
    });
    syncFormInputsWithState();
    UI.renderChargersList();
    UI.renderChecklist();
    UI.recalculateAndRender();
    UI.showToast('↺ Formulário reiniciado com os parâmetros padrão.');
  }

  const btnResetHeader = document.getElementById('btnResetHeader');
  if (btnResetHeader) {
    btnResetHeader.addEventListener('click', function () {
      const isVistoria = document.getElementById('mode-vistoria') && !document.getElementById('mode-vistoria').classList.contains('is-hidden');
      if (isVistoria) {
        resetInspectionForm();
      } else {
        resetAllForm();
      }
    });
  }

  const btnResetBottom = document.getElementById('btnResetBottom');
  if (btnResetBottom) btnResetBottom.addEventListener('click', resetAllForm);

  // =========================================================================
  // VINCULAÇÃO DE EVENTOS: VISTORIA PRELIMINAR INTELIGENTE (WIZARD & IA)
  // =========================================================================

  // 1. Alternador de Modo (Vistoria Guiada vs Modo Avançado)
  const btnModeVistoria = document.getElementById('btnModeVistoria');
  if (btnModeVistoria) {
    btnModeVistoria.addEventListener('click', () => UI.switchAppMode('vistoria'));
  }

  const btnModeAvancado = document.getElementById('btnModeAvancado');
  if (btnModeAvancado) {
    btnModeAvancado.addEventListener('click', () => UI.switchAppMode('avancado'));
  }

  const btnReturnToVistoria = document.getElementById('btnReturnToVistoria');
  if (btnReturnToVistoria) {
    btnReturnToVistoria.addEventListener('click', () => UI.switchAppMode('vistoria'));
  }

  const btnOpenInAdvancedMode = document.getElementById('btnOpenInAdvancedMode');
  if (btnOpenInAdvancedMode) {
    btnOpenInAdvancedMode.addEventListener('click', () => UI.syncInspectionToAdvancedEngine());
  }

  // 2. Navegação do Wizard (Etapas 1, 2, 3, 4)
  function readStep1Data() {
    const loc = UI.inspectionState.localData;
    const getRadioVal = name => {
      const el = document.querySelector(`input[name="${name}"]:checked`);
      return el ? el.value : '';
    };

    loc.locationType = getRadioVal('inspLocationType') || 'residencia';
    loc.installArea = getRadioVal('inspInstallArea') || 'garagem_aberta';
    loc.supplyType = getRadioVal('inspSupplyType') || 'bifasica';
    const activeVoltBtn = document.querySelector('#inspVoltageOptionsContainer .voltage-pill-btn.active');
    if (activeVoltBtn) loc.voltagePreset = activeVoltBtn.dataset.val;
    const vfnInput = document.getElementById('inspCustomVfn') || document.getElementById('inspInputVoltageFN');
    if (vfnInput) loc.customVfn = parseFloat(vfnInput.value) || 127;
    const vffInput = document.getElementById('inspCustomVff') || document.getElementById('inspInputVoltageFF');
    if (vffInput) loc.customVff = parseFloat(vffInput.value) || 220;

    const vRadio = getRadioVal('inspVehicleCount');
    if (vRadio === 'mais_de_3') {
      const customVInput = document.getElementById('inspInputCustomVehicle');
      loc.vehicleCount = Math.max(4, parseInt(customVInput?.value || '4', 10));
    } else {
      loc.vehicleCount = parseInt(vRadio || '1', 10);
    }

    loc.chargerType = getRadioVal('inspChargerType') || 'wallbox';

    const dRadio = getRadioVal('inspDistanceApprox');
    if (dRadio === '>50') {
      const customDInput = document.getElementById('inspInputCustomDistance');
      loc.distanceApprox = '>50';
      loc.customDistance = Math.max(51, parseFloat(customDInput?.value || '60'));
    } else {
      loc.distanceApprox = dRadio || '10-25';
    }

    const cityInput = document.getElementById('inspCityStateInput');
    if (cityInput && cityInput.value.trim()) {
      loc.cityState = cityInput.value.trim();
    }
    UI.saveInspectionToLocalStorage();
  }

  function syncStep1InputsFromState() {
    const loc = UI.inspectionState.localData;
    const setRadio = (name, val) => {
      const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
      if (el) el.checked = true;
    };

    if (loc.locationType) setRadio('inspLocationType', loc.locationType);
    if (loc.installArea) setRadio('inspInstallArea', loc.installArea);
    setRadio('inspSupplyType', loc.supplyType || 'bifasica');
    UI.renderStep1VoltageOptions(loc.supplyType || 'bifasica', loc.voltagePreset || '127_220');

    const vfnInput = document.getElementById('inspCustomVfn') || document.getElementById('inspInputVoltageFN');
    if (vfnInput && loc.customVfn) vfnInput.value = loc.customVfn;
    const vffInput = document.getElementById('inspCustomVff') || document.getElementById('inspInputVoltageFF');
    if (vffInput && loc.customVff) vffInput.value = loc.customVff;

    const vBox = document.getElementById('inspCustomVehicleBox');
    const vInput = document.getElementById('inspInputCustomVehicle');
    if (loc.vehicleCount > 3) {
      setRadio('inspVehicleCount', 'mais_de_3');
      if (vBox) vBox.style.display = 'block';
      if (vInput) vInput.value = loc.vehicleCount;
    } else {
      setRadio('inspVehicleCount', String(loc.vehicleCount || 1));
      if (vBox) vBox.style.display = 'none';
    }

    if (loc.chargerType) setRadio('inspChargerType', loc.chargerType);

    const dBox = document.getElementById('inspCustomDistanceBox');
    const dInput = document.getElementById('inspInputCustomDistance');
    if (loc.distanceApprox === '>50') {
      setRadio('inspDistanceApprox', '>50');
      if (dBox) dBox.style.display = 'block';
      if (dInput && loc.customDistance) dInput.value = loc.customDistance;
    } else {
      setRadio('inspDistanceApprox', loc.distanceApprox || '10-25');
      if (dBox) dBox.style.display = 'none';
    }

    const cityInput = document.getElementById('inspCityStateInput');
    if (cityInput && loc.cityState) {
      cityInput.value = loc.cityState;
    }
  }

  // Sincronização em tempo real dos seletores da Etapa 1 da Vistoria com a Análise Técnica
  document.querySelectorAll('input[name="inspSupplyType"]').forEach(r => {
    r.addEventListener('change', function () {
      UI.inspectionState.localData.supplyType = this.value;
      UI.renderStep1VoltageOptions(this.value, UI.inspectionState.localData.voltagePreset);
      UI.syncVistoriaToTechnical('supplyType', this.value);
    });
  });

  document.querySelectorAll('input[name="inspVehicleCount"]').forEach(r => {
    r.addEventListener('change', function () {
      const vBox = document.getElementById('inspCustomVehicleBox');
      const vInput = document.getElementById('inspInputCustomVehicle');
      if (this.value === 'mais_de_3') {
        if (vBox) vBox.style.display = 'block';
        const count = Math.max(4, parseInt(vInput?.value || '4', 10));
        UI.inspectionState.localData.vehicleCount = count;
        UI.syncVistoriaToTechnical('vehicleCount', count);
      } else {
        if (vBox) vBox.style.display = 'none';
        const count = parseInt(this.value, 10);
        UI.inspectionState.localData.vehicleCount = count;
        UI.syncVistoriaToTechnical('vehicleCount', count);
      }
    });
  });

  const inspCustomVInput = document.getElementById('inspInputCustomVehicle');
  if (inspCustomVInput) {
    inspCustomVInput.addEventListener('input', function () {
      const count = Math.max(4, parseInt(this.value || '4', 10));
      UI.inspectionState.localData.vehicleCount = count;
      UI.syncVistoriaToTechnical('vehicleCount', count);
    });
  }

  document.querySelectorAll('input[name="inspChargerType"]').forEach(r => {
    r.addEventListener('change', function () {
      UI.inspectionState.localData.chargerType = this.value;
      UI.syncVistoriaToTechnical('chargerType', this.value);
    });
  });

  document.querySelectorAll('input[name="inspDistanceApprox"]').forEach(r => {
    r.addEventListener('change', function () {
      const dBox = document.getElementById('inspCustomDistanceBox');
      const dInput = document.getElementById('inspInputCustomDistance');
      if (this.value === '>50') {
        if (dBox) dBox.style.display = 'block';
        const dist = Math.max(51, parseFloat(dInput?.value || '60'));
        UI.inspectionState.localData.distanceApprox = '>50';
        UI.inspectionState.localData.customDistance = dist;
        UI.syncVistoriaToTechnical('distanceApprox', '>50');
      } else {
        if (dBox) dBox.style.display = 'none';
        UI.inspectionState.localData.distanceApprox = this.value;
        UI.syncVistoriaToTechnical('distanceApprox', this.value);
      }
    });
  });

  const inspCustomDInput = document.getElementById('inspInputCustomDistance');
  if (inspCustomDInput) {
    inspCustomDInput.addEventListener('input', function () {
      const dist = Math.max(1, parseFloat(this.value || '60'));
      UI.inspectionState.localData.customDistance = dist;
      UI.state.distance = dist;
      const distField = document.getElementById('inputDistance');
      if (distField) distField.value = dist;
      UI.recalculateAndRender();
    });
  }

  const inspVfn = document.getElementById('inspCustomVfn') || document.getElementById('inspInputVoltageFN');
  if (inspVfn) {
    inspVfn.addEventListener('input', function () {
      UI.inspectionState.localData.customVfn = parseFloat(this.value) || 127;
      UI.state.voltagePhaseNeutral = UI.inspectionState.localData.customVfn;
      UI.recalculateAndRender();
    });
  }

  const inspVff = document.getElementById('inspCustomVff') || document.getElementById('inspInputVoltageFF');
  if (inspVff) {
    inspVff.addEventListener('input', function () {
      UI.inspectionState.localData.customVff = parseFloat(this.value) || 220;
      UI.state.voltagePhasePhase = UI.inspectionState.localData.customVff;
      UI.recalculateAndRender();
    });
  }

  const btnNextStep1 = document.getElementById('btnNextStep1');
  if (btnNextStep1) {
    btnNextStep1.addEventListener('click', function () {
      readStep1Data();
      UI.renderInspectionStep(2);
    });
  }

  const btnBackStep2 = document.getElementById('btnBackStep2');
  if (btnBackStep2) {
    btnBackStep2.addEventListener('click', () => UI.renderInspectionStep(1));
  }

  const btnSkipPhotos = document.getElementById('btnSkipPhotos');
  if (btnSkipPhotos) {
    btnSkipPhotos.addEventListener('click', () => UI.renderInspectionStep(3));
  }

  const btnAnalyzeAI = document.getElementById('btnAnalyzeAI');
  if (btnAnalyzeAI) {
    btnAnalyzeAI.addEventListener('click', () => UI.analyzePhotosWithAI());
  }

  const btnBackStep3 = document.getElementById('btnBackStep3');
  if (btnBackStep3) {
    btnBackStep3.addEventListener('click', () => UI.renderInspectionStep(2));
  }

  const btnEvaluateFinal = document.getElementById('btnEvaluateFinal');
  if (btnEvaluateFinal) {
    btnEvaluateFinal.addEventListener('click', () => UI.renderInspectionStep(4));
  }

  const btnGenerateInspectionPDF = document.getElementById('btnGenerateInspectionPDF');
  if (btnGenerateInspectionPDF) {
    btnGenerateInspectionPDF.addEventListener('click', () => UI.openReportModal('vistoria_preliminar'));
  }

  function resetInspectionForm() {
    UI.inspectionState.photos = [];
    UI.inspectionState.aiAnalysis = null;
    UI.inspectionState.diagnosticResult = null;
    UI.inspectionState.confirmations = {
      mainBreakerConfirmed: '50',
      groundingConfirmed: 'nao_sei',
      rainProtectionConfirmed: 'sim',
      spaceAvailableConfirmed: 'nao_sei',
      exclusiveCircuitConfirmed: 'nao',
      capacityVerified: 'nao_sei',
      cbmerjSprinklers: 'nao_se_aplica'
    };
    UI.saveInspectionToLocalStorage();
    UI.renderInspectionStep(1);
    UI.showToast('↺ Vistoria reiniciada com sucesso.');
  }

  const btnRestartInspection = document.getElementById('btnRestartInspection');
  if (btnRestartInspection) {
    btnRestartInspection.addEventListener('click', resetInspectionForm);
  }

  // Stepper Header Direct Click Navigation
  for (let s = 1; s <= 4; s++) {
    const node = document.getElementById(`stepNode${s}`);
    if (node) {
      node.addEventListener('click', function () {
        if (s > 1) readStep1Data();
        UI.renderInspectionStep(s);
      });
    }
  }

  // Fechar modal ao clicar fora ou com Escape
  const reportModal = document.getElementById('reportModal');
  if (reportModal) {
    reportModal.addEventListener('click', function (e) {
      if (e.target === this) UI.closeReportModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && reportModal && reportModal.classList.contains('is-open')) {
      UI.closeReportModal();
    }
  });

  // 13. Inicialização Completa
  UI.loadInspectionFromLocalStorage();
  syncStep1InputsFromState();
  syncFormInputsWithState();
  UI.renderChargersList();
  UI.renderChecklist();
  UI.recalculateAndRender();

  // Inicia por padrão no Modo Vistoria Guiada
  UI.switchAppMode('vistoria');
  UI.renderInspectionStep(UI.inspectionState.currentStep || 1);

  console.log('⚡ LIGVOLT Light Mode SaaS & Vistoria Inteligente inicializados com sucesso.');
});
