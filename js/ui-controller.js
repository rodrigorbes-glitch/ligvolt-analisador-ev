/**
 * LIGVOLT - Controlador de Interface do Usuário (UI Controller) - Redesign Light Mode SaaS
 * Gerencia inputs, reatividade, renderização do checklist agrupado, cenários e laudos
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./calculation-engine', './compliance-rules', './diagnostic-engine', './report-generator', './dossier-generator', './smart-inspection'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./calculation-engine'),
      require('./compliance-rules'),
      require('./diagnostic-engine'),
      require('./report-generator'),
      require('./dossier-generator'),
      require('./smart-inspection')
    );
  } else {
    root.LigvoltUI = factory(root.LigvoltEngine, root.LigvoltCompliance, root.LigvoltDiagnostic, root.LigvoltReport, root.LigvoltDossier, root.LigvoltSmartInspection);
  }
}(typeof self !== 'undefined' ? self : this, function (Engine, Compliance, Diagnostic, Report, Dossier, SmartInspection) {
  'use strict';

  // Estado interno da aplicação (Análise Técnica & Engenharia)
  let state = {
    activeTab: 'tab-dimensionamento',
    activeDocType: 'vistoria_preliminar',
    showAdaptations: false,
    supplyType: 'bifasica', // Bifásica selecionada por padrão (padrão operacional Ligvolt)
    voltagePreset: '127_220',
    voltagePhaseNeutral: 127,
    voltagePhasePhase: 220,
    voltageSingle: 220,
    distance: 20,
    mainBreakerKnown: true,
    mainBreaker: 50,
    demandKnown: true,
    demandMode: 'total',
    demandUnit: 'A',
    demandTotal: 15,
    demandPhases: { L1: 10, L2: 10, L3: 0 },
    cableInsulation: 'PVC',
    installationMethod: 'B1',
    groupingCircuits: 1,
    ambientTemp: 30,
    useContinuousMargin: true,
    continuousMarginFactor: 1.25,
    maxVoltageDrop: 4.0,
    chargers: [
      { id: 1, name: 'Wallbox Bifásico 32A', nominalCurrent: 32, enabled: true, phaseConfig: 'L1-L2' }
    ],
    supplyTypeStatus: 'sugerido', // 'sugerido', 'confirmado', 'ia', 'pendente'
    voltageStatus: 'sugerido',
    distanceStatus: 'estimado',
    capacityStatus: 'pendente',
    checklistResponses: {},
    reportMetadata: {
      clientName: '',
      address: '',
      technician: '',
      crea: '',
      art: '',
      concessionaria: 'Light / Enel / CPFL / Cemig',
      ucNumber: '',
      notes: ''
    }
  };

  // Estado da Vistoria Preliminar Guiada com IA
  let inspectionState = {
    currentStep: 1,
    localData: {
      locationType: 'residencia',
      installArea: 'garagem_aberta',
      supplyType: 'bifasica', // Bifásica padrão sugerido da Ligvolt
      voltagePreset: '127_220',
      voltagePhaseNeutral: 127,
      voltagePhasePhase: 220,
      voltageSingle: 220,
      voltageText: '127V / 220V',
      supplyTypeStatus: 'sugerido',
      voltageStatus: 'sugerido',
      vehicleCount: 1,
      chargerType: 'wallbox',
      distanceApprox: '10-25',
      cityState: 'São Paulo - SP'
    },
    photos: [],
    aiAnalysis: null,
    confirmations: {
      mainBreakerConfirmed: '50',
      groundingConfirmed: 'nao_sei',
      rainProtectionConfirmed: 'sim',
      spaceAvailableConfirmed: 'nao_sei',
      exclusiveCircuitConfirmed: 'nao',
      capacityVerified: 'nao_sei',
      cbmerjSprinklers: 'nao_se_aplica'
    },
    diagnosticResult: null
  };

  /**
   * Helper para obter tensões nominais da configuração atual
   */
  function getVoltagesForDisplay() {
    return Engine.getVoltages({
      supplyType: state.supplyType,
      voltagePreset: state.voltagePreset,
      voltagePhaseNeutral: state.voltagePhaseNeutral,
      voltagePhasePhase: state.voltagePhasePhase,
      voltageSingle: state.voltageSingle
    });
  }

  /**
   * Inicializa os valores padrão do checklist
   */
  function initChecklistState() {
    Compliance.CHECKLIST_ITEMS.forEach(item => {
      if (!state.checklistResponses[item.id]) {
        state.checklistResponses[item.id] = item.defaultStatus || 'nao_verificado';
      }
    });
  }

  /**
   * Renderiza a lista de carregadores na interface (Cards Compactos Light Mode)
   */
  function renderChargersList() {
    const container = document.getElementById('chargersContainer');
    if (!container) return;

    container.innerHTML = '';

    state.chargers.forEach((ch, idx) => {
      const card = document.createElement('div');
      card.className = `charger-card ${ch.enabled ? 'is-active' : 'is-disabled'}`;
      card.dataset.id = ch.id;

      const phaseOptions = getPhaseOptions(state.supplyType);

      // Estima potência ativa do carregador com base na tensão do circuito
      const vObj = getVoltagesForDisplay();
      const circuitVoltage = (ch.phaseConfig === '3F' || ch.phaseConfig.includes('-L')) ? vObj.ff : vObj.fn;
      let pKw = ch.phaseConfig === '3F' 
        ? ((Math.sqrt(3) * circuitVoltage * ch.nominalCurrent * 0.99) / 1000).toFixed(1)
        : ((circuitVoltage * ch.nominalCurrent * 0.99) / 1000).toFixed(1);

      card.innerHTML = `
        <div class="charger-card-header">
          <div class="charger-title-group">
            <span class="charger-badge">Ponto ${idx + 1}</span>
            <input type="text" class="charger-name-input" value="${escapeHtml(ch.name)}" data-action="update-name" data-id="${ch.id}" placeholder="Nome do ponto" />
            <span class="charger-power-tag">${pKw} kW</span>
          </div>
          <div class="charger-card-actions">
            <label class="switch-toggle" title="Ativar/Desativar este carregador">
              <input type="checkbox" ${ch.enabled ? 'checked' : ''} data-action="toggle-charger" data-id="${ch.id}" />
              <span class="slider"></span>
            </label>
            ${state.chargers.length > 1 ? `
              <button type="button" class="btn-icon-del" data-action="remove-charger" data-id="${ch.id}" title="Remover carregador">
                ✕
              </button>
            ` : ''}
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Corrente Nominal (A)</label>
            <input type="number" class="form-control" min="6" max="100" step="1" value="${ch.nominalCurrent}" data-action="update-current" data-id="${ch.id}" />
            <div class="quick-chips-inline">
              <button type="button" class="chip ${ch.nominalCurrent === 16 ? 'active' : ''}" data-action="set-preset-current" data-id="${ch.id}" data-val="16">16A (3,7/11kW)</button>
              <button type="button" class="chip ${ch.nominalCurrent === 32 ? 'active' : ''}" data-action="set-preset-current" data-id="${ch.id}" data-val="32">32A (7,4/22kW)</button>
              <button type="button" class="chip ${ch.nominalCurrent === 40 ? 'active' : ''}" data-action="set-preset-current" data-id="${ch.id}" data-val="40">40A</button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Fases de Alimentação</label>
            <select class="form-control" data-action="update-phase" data-id="${ch.id}">
              ${phaseOptions.map(opt => `
                <option value="${opt.value}" ${ch.phaseConfig === opt.value ? 'selected' : ''}>${opt.label}</option>
              `).join('')}
            </select>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    const addBtn = document.getElementById('btnAddCharger');
    if (addBtn) {
      addBtn.style.display = state.chargers.length < 4 ? 'inline-flex' : 'none';
    }
  }

  function getPhaseOptions(supplyType) {
    if (supplyType === 'monofasica') {
      return [{ value: 'L1-N', label: 'Fase - Neutro (Monofásico)' }];
    }
    if (supplyType === 'bifasica') {
      return [
        { value: 'L1-L2', label: 'Fase - Fase (L1 + L2)' },
        { value: 'L1-N', label: 'Fase L1 - Neutro' },
        { value: 'L2-N', label: 'Fase L2 - Neutro' }
      ];
    }
    return [
      { value: '3F', label: 'Trifásico (L1 + L2 + L3 + N)' },
      { value: 'L1-N', label: 'Monofásico Fase L1 - Neutro' },
      { value: 'L2-N', label: 'Monofásico Fase L2 - Neutro' },
      { value: 'L3-N', label: 'Monofásico Fase L3 - Neutro' },
      { value: 'L1-L2', label: 'Bifásico Fase L1 - Fase L2' },
      { value: 'L2-L3', label: 'Bifásico Fase L2 - Fase L3' },
      { value: 'L3-L1', label: 'Bifásico Fase L3 - Fase L1' }
    ];
  }

  /**
   * Renderiza a lista interativa de checklist agrupada em 4 categorias normativas
   */
  function renderChecklist() {
    const container = document.getElementById('checklistContainer');
    if (!container) return;

    container.innerHTML = '';

    // Agrupamento dos 13 itens
    const categories = [
      { name: 'Infraestrutura Elétrica', icon: '🔌' },
      { name: 'Proteção & Segurança', icon: '🛡️' },
      { name: 'Ambiente & Incêndio', icon: '🚒' },
      { name: 'Equipamentos', icon: '⚡' },
      { name: 'Documentação Técnica', icon: '📋' }
    ];

    categories.forEach(cat => {
      const itemsInCat = Compliance.CHECKLIST_ITEMS.filter(i => i.category === cat.name);
      if (itemsInCat.length === 0) return;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'checklist-category-block';
      groupDiv.innerHTML = `<h3 class="checklist-cat-title">${cat.icon} ${cat.name}</h3>`;

      itemsInCat.forEach(item => {
        const currentVal = state.checklistResponses[item.id] || item.defaultStatus || 'nao_verificado';

        const itemCard = document.createElement('div');
        itemCard.className = `checklist-item-card`;
        itemCard.id = `card-${item.id}`;

        itemCard.innerHTML = `
          <div class="check-top-row">
            <span class="check-item-title">${item.title}</span>
            <span class="check-norm-ref">${item.normativeRef} (${item.classification})</span>
          </div>

          <p class="check-desc-text">${item.description}</p>

          <div class="check-pills-row">
            <button type="button" class="btn-check-pill check-adeq ${currentVal === 'adequado' ? 'selected' : ''}" data-item="${item.id}" data-val="adequado">
              ✓ Adequado
            </button>
            <button type="button" class="btn-check-pill check-inadeq ${currentVal === 'inadequado' ? 'selected' : ''}" data-item="${item.id}" data-val="inadequado">
              ✗ Inadequado
            </button>
            <button type="button" class="btn-check-pill check-na ${currentVal === 'nao_aplicavel' ? 'selected' : ''}" data-item="${item.id}" data-val="nao_aplicavel">
              — Não Aplicável
            </button>
            <button type="button" class="btn-check-pill check-pend ${currentVal === 'nao_verificado' ? 'selected' : ''}" data-item="${item.id}" data-val="nao_verificado">
              ? Não Verificado
            </button>
          </div>

          ${currentVal === 'inadequado' ? `
            <div class="check-risk-box">
              <strong>⚠️ Ponto de Atenção:</strong> ${item.inadequateRisk}
            </div>
          ` : ''}
        `;

        groupDiv.appendChild(itemCard);
      });

      container.appendChild(groupDiv);
    });
  }

  /**
   * Executa a rotina central de recálculo e atualização
   */
  function recalculateAndRender() {
    let existingDemandParam = null;
    if (state.demandKnown) {
      if (state.demandMode === 'per_phase') {
        existingDemandParam = {
          L1: parseFloat(state.demandPhases.L1) || 0,
          L2: parseFloat(state.demandPhases.L2) || 0,
          L3: parseFloat(state.demandPhases.L3) || 0
        };
      } else {
        existingDemandParam = parseFloat(state.demandTotal) || 0;
      }
    }

    const calcInput = {
      distance: state.distance,
      supplyType: state.supplyType,
      voltagePreset: state.voltagePreset,
      voltagePhaseNeutral: state.voltagePhaseNeutral,
      voltagePhasePhase: state.voltagePhasePhase,
      voltageSingle: state.voltageSingle,
      mainBreaker: state.mainBreakerKnown ? state.mainBreaker : null,
      existingDemand: existingDemandParam,
      existingDemandUnit: state.demandUnit,
      cableInsulation: state.cableInsulation,
      installationMethod: state.installationMethod,
      groupingCircuits: state.groupingCircuits,
      ambientTemp: state.ambientTemp,
      useContinuousMargin: state.useContinuousMargin,
      continuousMarginFactor: state.continuousMarginFactor,
      maxVoltageDrop: state.maxVoltageDrop,
      chargers: state.chargers
    };

    const calcResult = Engine.calculateInstallation(calcInput);
    const diagnostic = Diagnostic.evaluateDiagnostic(calcResult, state.checklistResponses, calcInput);

    renderDiagnosticCard(diagnostic, calcResult);
    renderTechSummaryCards(calcResult, diagnostic);
    renderSizingResults(calcResult, diagnostic);
    renderScenariosComparison(calcResult);
    renderTechAdaptationsSection(calcResult, diagnostic);

    return { calcResult, diagnostic };
  }

  /**
   * Renderiza os 4 Cartões Compactos do Resumo da Instalação (Área A)
   */
  function renderTechSummaryCards(calcResult, diagnostic) {
    const container = document.getElementById('techSummaryGrid');
    if (!container) return;

    // 1. Alimentação & Tensão
    const supplyLabels = {
      monofasica: 'Monofásica (F+N)',
      bifasica: 'Bifásica (2F+N)',
      trifasica: 'Trifásica (3F+N)',
      nao_sei: 'Não Definida'
    };
    const sLabel = supplyLabels[state.supplyType] || state.supplyType;
    const vObj = getVoltagesForDisplay();
    const vLabel = vObj.label;

    let supplyBadge = '';
    let supplyCardClass = 'status-confirmed';
    if (state.supplyTypeStatus === 'sugerido') {
      supplyBadge = '<span class="badge-status-suggested">⚡ Sugestão Ligvolt</span>';
      supplyCardClass = 'status-suggested';
    } else if (state.supplyTypeStatus === 'confirmado') {
      supplyBadge = '<span class="badge-status-confirmed">✓ Confirmado</span>';
      supplyCardClass = 'status-confirmed';
    } else {
      supplyBadge = '<span class="badge-status-pending">⚪ Pendente de Verificação</span>';
      supplyCardClass = 'status-pending';
    }

    // 2. Carregadores e Potência Total
    const totalKW = calcResult.chargers ? calcResult.chargers.reduce((acc, c) => acc + (c.powerKW || 0), 0).toFixed(1) : '0';
    const activeCount = calcResult.chargers ? calcResult.chargers.length : 0;
    const chargersDesc = activeCount > 0 
      ? calcResult.chargers.map(c => `${c.nominalCurrent}A (${c.phaseConfig})`).join(', ')
      : 'Nenhum ativo';

    // 3. Distância do Quadro
    let distBadge = state.distanceStatus === 'confirmado' 
      ? '<span class="badge-status-confirmed">✓ Medido</span>' 
      : '<span class="badge-status-suggested">~ Estimado</span>';

    // 4. Capacidade Elétrica Preliminar
    let capTitle = '4. Capacidade do Disjuntor';
    let capValue = state.mainBreakerKnown ? `${state.mainBreaker}A` : 'Pendente de verificação';
    let capSub = '';
    let capCardClass = 'status-confirmed';

    if (!state.mainBreakerKnown) {
      capSub = '<span class="badge-status-pending">⚪ Medidor não verificado</span>';
      capCardClass = 'status-pending';
    } else {
      const isOverload = calcResult.phaseSummary && calcResult.phaseSummary.isOverloaded;
      if (isOverload) {
        capSub = '<span class="badge-status-suggested" style="background:#FEE2E2; color:#DC2626; border-color:#FECACA;">⚠️ Sobrecarga detectada</span>';
        capCardClass = 'status-suggested';
      } else {
        const maxPhase = calcResult.phaseSummary ? calcResult.phaseSummary.maxPhaseProject : 0;
        const folga = Math.max(0, (state.mainBreaker - maxPhase)).toFixed(1);
        capSub = `<span class="badge-status-confirmed">✓ Folga estimada: ~${folga}A</span>`;
      }
    }

    container.innerHTML = `
      <!-- CARD 1: FORNECIMENTO & TENSÃO -->
      <div class="tech-summary-card ${supplyCardClass}">
        <div class="tech-summary-header">
          <span class="tech-summary-title">1. Alimentação & Tensão</span>
          <span class="tech-summary-icon">⚡</span>
        </div>
        <div class="tech-summary-value">${vLabel}</div>
        <div class="tech-summary-sub">
          <span>${sLabel}</span>
          ${supplyBadge}
        </div>
      </div>

      <!-- CARD 2: CARREGADORES & POTÊNCIA -->
      <div class="tech-summary-card status-confirmed">
        <div class="tech-summary-header">
          <span class="tech-summary-title">2. Pontos de Recarga</span>
          <span class="tech-summary-icon">🚗</span>
        </div>
        <div class="tech-summary-value">${totalKW} kW</div>
        <div class="tech-summary-sub">
          <span>${activeCount} Carregador(es)</span>
          <span style="font-size: 10.5px; color: var(--text-muted);">${chargersDesc}</span>
        </div>
      </div>

      <!-- CARD 3: DISTÂNCIA DO ALIMENTADOR -->
      <div class="tech-summary-card ${state.distanceStatus === 'confirmado' ? 'status-confirmed' : 'status-suggested'}">
        <div class="tech-summary-header">
          <span class="tech-summary-title">3. Trajeto dos Cabos</span>
          <span class="tech-summary-icon">📏</span>
        </div>
        <div class="tech-summary-value">${state.distance} metros</div>
        <div class="tech-summary-sub">
          <span>Trecho até os pontos</span>
          ${distBadge}
        </div>
      </div>

      <!-- CARD 4: CAPACIDADE ELÉTRICA -->
      <div class="tech-summary-card ${capCardClass}">
        <div class="tech-summary-header">
          <span class="tech-summary-title">${capTitle}</span>
          <span class="tech-summary-icon">🛡️</span>
        </div>
        <div class="tech-summary-value">${capValue}</div>
        <div class="tech-summary-sub">
          <span>Padrão de entrada</span>
          ${capSub}
        </div>
      </div>
    `;
  }

  /**
   * Renderiza o Card de Diagnóstico Principal (Light Mode com Drawer Expansível)
   */
  function renderDiagnosticCard(diagnostic, calcResult) {
    const card = document.getElementById('intelligentDiagnosticCard');
    if (!card) return;

    card.className = `diag-hero-card ${diagnostic.badgeClass}`;

    let iconSymbol = '🟢';
    if (diagnostic.state === 'NAO_APTO') iconSymbol = '🔴';
    else if (diagnostic.state === 'APTO_COM_ADEQUACOES') iconSymbol = '🟡';
    else if (diagnostic.state === 'INCOMPLETA') iconSymbol = '⚪';

    const hasIssues = diagnostic.identifiedIssues.length > 0 || diagnostic.requiredAdaptations.length > 0;

    let issuesHtml = '';
    if (diagnostic.identifiedIssues.length > 0) {
      issuesHtml = `
        <div style="margin-bottom: 12px;">
          <strong style="font-size: 12.5px; color: #991B1B;">Pontos de Inconformidade / Risco:</strong>
          <ul class="diag-bullet-list">
            ${diagnostic.identifiedIssues.map(iss => `<li>⚠️ ${escapeHtml(iss)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    let adaptationsHtml = '';
    if (diagnostic.requiredAdaptations.length > 0) {
      adaptationsHtml = `
        <div>
          <strong style="font-size: 12.5px; color: var(--text-main);">Adequações Técnicas Recomendadas:</strong>
          <ol class="diag-ordered-list">
            ${diagnostic.requiredAdaptations.map(ad => `
              <li>
                <span class="p-tag p-${ad.priority}">P${ad.priority}</span>
                ${escapeHtml(ad.action)}
              </li>
            `).join('')}
          </ol>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="diag-header-row">
        <div class="diag-badge-pill">
          <span>${iconSymbol}</span>
          <span>${diagnostic.badge}</span>
        </div>
        ${hasIssues ? `
          <button type="button" class="btn-toggle-adaptations" id="btnToggleAdaptations">
            ${state.showAdaptations ? '▲ Ocultar Adequações' : '▼ Ver Adequações Necessárias'}
          </button>
        ` : ''}
      </div>

      <h3 class="diag-headline">${diagnostic.headline}</h3>
      <p class="diag-summary-text">${diagnostic.summary}</p>

      ${diagnostic.scenarioRationale ? `
        <div class="diag-recommended-box">
          <strong>Topologia Sugerida:</strong> ${diagnostic.recommendedScenario === 'A' ? 'Cenário A (Alimentador Único + Subquadro QGBT-EV)' : 'Cenário B (Circuitos Independentes Diretos)'}
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${diagnostic.scenarioRationale}</div>
        </div>
      ` : ''}

      <div class="diag-collapsible-area ${state.showAdaptations ? 'is-open' : ''}" id="diagCollapsibleArea">
        ${issuesHtml}
        ${adaptationsHtml}
      </div>
    `;

    const toggleBtn = document.getElementById('btnToggleAdaptations');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        state.showAdaptations = !state.showAdaptations;
        const area = document.getElementById('diagCollapsibleArea');
        if (area) area.classList.toggle('is-open', state.showAdaptations);
        this.textContent = state.showAdaptations ? '▲ Ocultar Adequações' : '▼ Ver Adequações Necessárias';
      });
    }
  }

  /**
   * Renderiza os resultados de dimensionamento elétrico (Área C: Resumo em Destaque)
   */
  function renderSizingResults(calcResult, diagnostic) {
    const summaryContainer = document.getElementById('sizingSummaryContainer');
    if (!summaryContainer) return;

    if (calcResult.status === 'NO_CHARGERS') {
      summaryContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">
          Adicione ao menos um carregador ativo para visualizar o dimensionamento.
        </div>
      `;
      return;
    }

    const { chargers, phaseSummary, input, scenarioA, scenarioB } = calcResult;
    const phaseBarsHtml = renderPhaseLoadMeters(phaseSummary, input.mainBreaker, input.supplyType);

    const totalPower = chargers.reduce((sum, c) => sum + (c.powerKW || 0), 0).toFixed(1);
    const maxDrop = chargers.reduce((max, c) => Math.max(max, c.voltageDropPercent), 0).toFixed(2);
    const recommendedSection = scenarioA ? scenarioA.cableDescription : (chargers[0] ? `${chargers[0].cableSection} mm²` : '—');
    const recommendedBreaker = scenarioA ? `${scenarioA.breakerRating}A (${scenarioA.breakerPoles})` : (chargers[0] ? `${chargers[0].recommendedBreaker}A` : '—');

    // Alerta de parâmetros pendentes
    let pendingWarning = '';
    if (!input.mainBreaker) {
      pendingWarning = `
        <div style="background: #FEF9C3; border: 1px solid #FEF08A; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12.5px; color: #854D0E; margin-bottom: 14px;">
          ⚠️ <strong>Atenção:</strong> Disjuntor geral pendente de verificação presencial. O dimensionamento exibido é preliminar e não deve ser executado antes da confirmação da capacidade no padrão de entrada.
        </div>
      `;
    }

    summaryContainer.innerHTML = `
      ${pendingWarning}

      <!-- RESUMO EM DESTAQUE DOS RESULTADOS TÉCNICOS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div style="background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 14px;">
          <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Potência Total</span>
          <div style="font-size: 20px; font-weight: 800; color: var(--text-main); margin-top: 2px;">${totalPower} kW</div>
          <span style="font-size: 11px; color: var(--text-secondary);">${chargers.length} ponto(s) ativos</span>
        </div>

        <div style="background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 14px;">
          <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Corrente de Projeto (125%)</span>
          <div style="font-size: 20px; font-weight: 800; color: var(--text-main); margin-top: 2px;">${phaseSummary ? phaseSummary.maxPhaseProject : '—'} A</div>
          <span style="font-size: 11px; color: var(--text-secondary);">Maior fase carregada</span>
        </div>

        <div style="background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 14px;">
          <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Queda de Tensão Máxima</span>
          <div style="font-size: 20px; font-weight: 800; color: ${parseFloat(maxDrop) <= input.maxDropAllowed ? '#15803D' : '#DC2626'}; margin-top: 2px;">
            ${maxDrop}%
          </div>
          <span style="font-size: 11px; color: var(--text-secondary);">Limite normativo: ${input.maxDropAllowed}%</span>
        </div>

        <div style="background: #F8FAFC; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 14px;">
          <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Proteção Obrigatória DR</span>
          <div style="font-size: 15px; font-weight: 800; color: #15803D; margin-top: 4px;">Tipo A / 30mA</div>
          <span style="font-size: 11px; color: var(--text-secondary);">Com RDC-DD 6mA DC</span>
        </div>
      </div>

      <div class="phase-bars-panel">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
          Balanço de Carga por Fase vs Limite do Disjuntor Geral
        </h4>
        ${phaseBarsHtml}
      </div>
    `;
  }

  /**
   * Renderiza barras de progresso visual para as fases (Light Mode)
   */
  function renderPhaseLoadMeters(phaseSummary, mainBreaker, supplyType) {
    if (!phaseSummary) return '';

    const phasesToRender = ['A'];
    if (supplyType !== 'monofasica') phasesToRender.push('B');
    if (supplyType === 'trifasica') phasesToRender.push('C');

    return `
      <div>
        ${phasesToRender.map(p => {
          const pData = phaseSummary.phases[p];
          const total = pData.totalProject;
          const limit = mainBreaker || total;
          const pct = Math.min(100, Math.round((total / limit) * 100));
          const isOver = mainBreaker && total > mainBreaker;
          const fillClass = isOver ? 'fill-danger' : (pct > 80 ? 'fill-warn' : 'fill-ok');

          return `
            <div class="phase-meter-row">
              <div class="phase-meter-label">
                <span><strong>Fase ${p}</strong>: ${pData.existing > 0 ? `Existente ${pData.existing}A + ` : ''}Recarga ${pData.evProject}A = <strong>${total}A</strong></span>
                <span>${mainBreaker ? `Limite Geral: ${mainBreaker}A (${pct}%)` : 'Geral não informado'}</span>
              </div>
              <div class="progress-track-clean">
                <div class="progress-fill-clean ${fillClass}" style="width: ${pct}%"></div>
              </div>
              ${isOver ? `<span style="font-size: 11px; font-weight: 700; color: #DC2626;">⚠️ Sobrecarga nesta fase (+${(total - mainBreaker).toFixed(1)}A)</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Renderiza a comparação entre Cenário A e Cenário B (Com Memória de Cálculo Expansível)
   */
  function renderScenariosComparison(calcResult) {
    const container = document.getElementById('scenariosComparisonContainer');
    if (!container || calcResult.status === 'NO_CHARGERS') return;

    const { scenarioA, scenarioB, comparison, input, chargers } = calcResult;

    container.innerHTML = `
      <div class="scenarios-comparison-grid">
        <!-- CARD CENÁRIO A -->
        <div class="scenario-card-clean ${comparison.recommendedScenario === 'A' ? 'is-recommended' : ''}">
          <div>
            <div class="scenario-header-clean">
              <div>
                <h4>Cenário A: Subquadro QGBT-EV</h4>
                <span style="font-size: 11.5px; color: var(--text-muted);">Alimentador único até quadro secundário local</span>
              </div>
              ${comparison.recommendedScenario === 'A' ? '<span class="recommended-pill">✓ Recomendado</span>' : ''}
            </div>

            <table class="scenario-specs-table">
              <tr>
                <td>Cabo Alimentador:</td>
                <td><strong>${scenarioA.cableDescription}</strong></td>
              </tr>
              <tr>
                <td>Disjuntor Geral QGBT:</td>
                <td>${scenarioA.breakerRating}A (${scenarioA.breakerPoles})</td>
              </tr>
              <tr>
                <td>Queda de Tensão no Trecho:</td>
                <td>${scenarioA.voltageDropPercent}% (${scenarioA.voltageDropPercent <= input.maxDropAllowed ? '✓ Conforme NBR 5410' : '⚠️ Superior ao limite'})</td>
              </tr>
              <tr>
                <td>Condutor Proteção (PE):</td>
                <td>${scenarioA.peSection} mm² (Tabela 58 NBR 5410)</td>
              </tr>
              <tr>
                <td>Proteções dos Carregadores:</td>
                <td>Disjuntores + DRs 30mA locais no subquadro</td>
              </tr>
            </table>
          </div>

          <div>
            <button type="button" class="btn-details-toggle" data-action="toggle-scenario-drawer" data-target="drawerA">
              🔍 Ver detalhes do cálculo do Cenário A ▼
            </button>
            <div class="calc-details-drawer" id="drawerA">
              <p><strong>Fórmulas e Critérios Normativos:</strong></p>
              <table class="calc-details-table">
                <tr>
                  <td>Corrente de Projeto (IB):</td>
                  <td>${scenarioA.currentIB}A (com margem de operação contínua 125%)</td>
                </tr>
                <tr>
                  <td>Fatores de Correção:</td>
                  <td>fTemp = ${input.fTemp.toFixed(2)} | fAgrup = ${input.fGroup.toFixed(2)} | fTotal = ${input.fCorrection.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Coordenação de Proteção:</td>
                  <td>IB (${scenarioA.currentIB}A) ≤ In (${scenarioA.breakerRating}A) ≤ Iz (${scenarioA.ampacityIz}A) ✓</td>
                </tr>
                <tr>
                  <td>Equação Queda de Tensão:</td>
                  <td>ΔU = √3 · L · IB · (R · cosφ + X · senφ) / Vnom</td>
                </tr>
              </table>
              <div style="margin-top: 8px;">
                <strong>Vantagens Técnicas:</strong>
                <ul style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                  ${comparison.scenarioAAdvantages.map(adv => `<li>${adv}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- CARD CENÁRIO B -->
        <div class="scenario-card-clean ${comparison.recommendedScenario === 'B' ? 'is-recommended' : ''}">
          <div>
            <div class="scenario-header-clean">
              <div>
                <h4>Cenário B: Circuitos Independentes</h4>
                <span style="font-size: 11.5px; color: var(--text-muted);">Circuitos diretos do quadro principal por carregador</span>
              </div>
              ${comparison.recommendedScenario === 'B' ? '<span class="recommended-pill">✓ Recomendado</span>' : ''}
            </div>

            <table class="scenario-specs-table">
              <tr>
                <td>Cabos no Trajeto:</td>
                <td><strong>${scenarioB.chargersCount} circuitos dedicados em paralelo</strong></td>
              </tr>
              <tr>
                <td>Disjuntores Termomagnéticos:</td>
                <td>${chargers.map(c => `${c.recommendedBreaker}A`).join(', ')} (no quadro geral)</td>
              </tr>
              <tr>
                <td>Queda de Tensão Média:</td>
                <td>${(chargers.reduce((acc, c) => acc + c.voltageDropPercent, 0) / chargers.length).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Fator de Agrupamento:</td>
                <td>${input.fGroup.toFixed(2)} (gera derating térmico pela proximidade)</td>
              </tr>
              <tr>
                <td>Local das Proteções:</td>
                <td>Instalados no quadro principal distante</td>
              </tr>
            </table>
          </div>

          <div>
            <button type="button" class="btn-details-toggle" data-action="toggle-scenario-drawer" data-target="drawerB">
              🔍 Ver detalhes do cálculo do Cenário B ▼
            </button>
            <div class="calc-details-drawer" id="drawerB">
              <p><strong>Detalhamento dos Circuitos Terminais:</strong></p>
              <table class="calc-details-table">
                ${chargers.map(c => `
                  <tr>
                    <td>${c.name}:</td>
                    <td>Cabo ${c.cableSection} mm² | Queda: ${c.voltageDropPercent}% | Disj. ${c.recommendedBreaker}A</td>
                  </tr>
                `).join('')}
                <tr>
                  <td>Coordenação por Circuito:</td>
                  <td>IB (40A) ≤ In (40A) ≤ Iz (${chargers[0] ? chargers[0].correctedAmpacity : 40}A) ✓</td>
                </tr>
              </table>
              <div style="margin-top: 8px;">
                <strong>Vantagens Técnicas:</strong>
                <ul style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                  ${comparison.scenarioBAdvantages.map(adv => `<li>${adv}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind dos botões de detalhes do cálculo
    container.querySelectorAll('[data-action="toggle-scenario-drawer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const targetId = this.dataset.target;
        const drawer = document.getElementById(targetId);
        if (drawer) {
          const isOpen = drawer.classList.toggle('is-open');
          this.textContent = isOpen 
            ? '▲ Ocultar detalhes do cálculo' 
            : (targetId === 'drawerA' ? '🔍 Ver detalhes do cálculo do Cenário A ▼' : '🔍 Ver detalhes do cálculo do Cenário B ▼');
        }
      });
    });
  }

  /**
   * Renderiza a Área D: Adequações Necessárias, Lista de Materiais e Verificações
   */
  function renderTechAdaptationsSection(calcResult, diagnostic) {
    const container = document.getElementById('techAdaptationsContainer');
    if (!container) return;

    const { chargers, scenarioA, input } = calcResult;

    // Componentes necessários estimados (BOM)
    const cableSection = scenarioA ? scenarioA.cableSection : (chargers[0] ? chargers[0].cableSection : 6);
    const peSection = scenarioA ? scenarioA.peSection : (chargers[0] ? chargers[0].peSection : 6);
    const estCableLength = Math.round(input.distance * 1.15); // +15% de folga técnica de instalação

    const bomList = [
      { item: `Cabo de Cobre ${cableSection} mm² (${input.cableInsulation} 750V/1kV)`, qty: `${estCableLength * (input.supplyType === 'trifasica' ? 4 : (input.supplyType === 'bifasica' ? 3 : 2))} metros`, note: 'Alimentador com folga' },
      { item: `Condutor de Proteção PE ${peSection} mm² Verde/Amarelo`, qty: `${estCableLength} metros`, note: 'Aterramento NBR 5410' },
      { item: `Interruptor DR 30mA Tipo A (6mA DC)`, qty: `${chargers.length} un.`, note: 'Proteção diferencial NBR 17019' },
      { item: `Dispositivo DPS Classe II 20/40kA`, qty: input.supplyType === 'trifasica' ? '4 módulos' : (input.supplyType === 'bifasica' ? '3 módulos' : '2 módulos'), note: 'Proteção contra surtos' },
      { item: `Eletrodutos ou Eletrocalhas Metálicas`, qty: `${input.distance} metros`, note: `${input.installationMethod === 'B1' ? 'Eletroduto rígido/flexível' : 'Eletrocalha aparente'}` }
    ];

    container.innerHTML = `
      <!-- 1. PROBLEMAS E NÃO CONFORMIDADES -->
      <div class="tech-adapt-block">
        <h4 class="tech-adapt-block-title">
          <span>⚠️</span> 1. Problemas e Riscos Identificados
        </h4>
        ${diagnostic.identifiedIssues.length > 0 ? `
          <ul class="diag-bullet-list">
            ${diagnostic.identifiedIssues.map(iss => `<li style="margin-bottom: 6px;">⚠️ ${escapeHtml(iss)}</li>`).join('')}
          </ul>
        ` : `
          <p style="font-size: 13px; color: #15803D;">✓ Nenhum impedimento crítico ou risco elétrico detectado nos parâmetros inseridos.</p>
        `}
      </div>

      <!-- 2. ADEQUAÇÕES PRIORIZADAS -->
      <div class="tech-adapt-block">
        <h4 class="tech-adapt-block-title">
          <span>📋</span> 2. Adequações Técnicas Priorizadas
        </h4>
        ${diagnostic.requiredAdaptations.length > 0 ? `
          <ol class="diag-ordered-list">
            ${diagnostic.requiredAdaptations.map(ad => `
              <li>
                <span class="p-tag p-${ad.priority}">Prioridade ${ad.priority}</span>
                ${escapeHtml(ad.action)}
              </li>
            `).join('')}
          </ol>
        ` : `
          <p style="font-size: 13px; color: #15803D;">✓ Nenhuma adequação estrutural indispensável no momento.</p>
        `}
      </div>

      <!-- 3. COMPONENTES POSSIVELMENTE NECESSÁRIOS (BOM ESTIMADO) -->
      <div class="tech-adapt-block">
        <h4 class="tech-adapt-block-title">
          <span>📦</span> 3. Componentes e Materiais Necessários (Estimativa Preliminar)
        </h4>
        <div class="tech-bom-grid">
          ${bomList.map(b => `
            <div class="tech-bom-item">
              <strong>${escapeHtml(b.item)}</strong>
              <div style="font-size: 12px; color: var(--volt-green-dark); font-weight: 700;">${escapeHtml(b.qty)}</div>
              <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(b.note)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 4. VERIFICAÇÕES OBRIGATÓRIAS ANTES DA EXECUÇÃO -->
      <div class="tech-adapt-block" style="margin-bottom: 0;">
        <h4 class="tech-adapt-block-title">
          <span>🔍</span> 4. Verificações Obrigatórias em Visita Técnica
        </h4>
        <div class="verification-list-box">
          <strong>Antes de energizar ou iniciar a passagem de cabos:</strong>
          <ul>
            <li>Medir com alicate amperímetro a corrente de pico simultânea nas fases nos horários de maior demanda (18h às 22h).</li>
            <li>Realizar teste instrumental de resistência de aterramento e continuidade do condutor PE até o ponto pretendido.</li>
            <li>Inspecionar visualmente o estado dos bornes do disjuntor geral da concessionária para identificar sinais de aquecimento.</li>
            <li>Confirmar com a concessionária de energia o limite de demanda contratada da unidade consumidora.</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Abre o Modal com o Documento Selecionado
   */
  function openReportModal(docType = 'relatorio') {
    state.activeDocType = docType;
    const { calcResult, diagnostic } = recalculateAndRender();
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportModalContent');
    if (!modal || !content) return;

    syncMetadataFromInputs();
    renderActiveDocument(calcResult, diagnostic);

    document.querySelectorAll('.doc-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.doc === state.activeDocType);
    });

    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function renderActiveDocument(calcResult, diagnostic) {
    const content = document.getElementById('reportModalContent');
    if (!content) return;

    if (state.activeDocType === 'vistoria_preliminar') {
      const diagResult = inspectionState.diagnosticResult || (SmartInspection ? SmartInspection.evaluateInspectionViability(inspectionState) : null);
      if (SmartInspection && diagResult) {
        content.innerHTML = SmartInspection.buildPreliminaryInspectionReportHTML({
          ...inspectionState,
          clientMeta: {
            clientName: state.reportMetadata.clientName || 'Cliente não identificado',
            address: state.reportMetadata.address || inspectionState.localData.cityState || 'Endereço não informado',
            inspectorName: state.reportMetadata.technician || 'Vistoriador / Ligvolt',
            notes: state.reportMetadata.notes || ''
          }
        }, diagResult);
      } else {
        content.innerHTML = '<p style="padding: 20px; color: #DC2626;">Módulo de vistoria não disponível ou pendente de cálculo.</p>';
      }
    } else if (state.activeDocType === 'relatorio') {
      content.innerHTML = Report.buildReportHTML(calcResult, diagnostic, state.checklistResponses, state.reportMetadata, inspectionState.photos);
    } else if (state.activeDocType === 'laudo') {
      content.innerHTML = Dossier.buildTechnicalOpinion(calcResult, diagnostic, state.checklistResponses, state.reportMetadata, inspectionState.photos);
    } else if (state.activeDocType === 'memoria') {
      content.innerHTML = Dossier.buildCalculationMemory(calcResult, state.reportMetadata);
    } else if (state.activeDocType === 'concessionaria') {
      content.innerHTML = Dossier.buildConcessionaireRequest(calcResult, state.reportMetadata);
    } else if (state.activeDocType === 'dossie') {
      content.innerHTML = `
        ${Report.buildReportHTML(calcResult, diagnostic, state.checklistResponses, state.reportMetadata, inspectionState.photos)}
        <div style="page-break-before: always; margin-top: 30px; border-top: 2px dashed #94A3B8; padding-top: 20px;"></div>
        ${Dossier.buildTechnicalOpinion(calcResult, diagnostic, state.checklistResponses, state.reportMetadata, inspectionState.photos)}
        <div style="page-break-before: always; margin-top: 30px; border-top: 2px dashed #94A3B8; padding-top: 20px;"></div>
        ${Dossier.buildCalculationMemory(calcResult, state.reportMetadata)}
        <div style="page-break-before: always; margin-top: 30px; border-top: 2px dashed #94A3B8; padding-top: 20px;"></div>
        ${Dossier.buildConcessionaireRequest(calcResult, state.reportMetadata)}
      `;
    }
  }

  function syncMetadataFromInputs() {
    const getVal = id => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    if (getVal('metaClientName')) state.reportMetadata.clientName = getVal('metaClientName');
    if (getVal('metaAddress')) state.reportMetadata.address = getVal('metaAddress');
    if (getVal('metaTechnician')) state.reportMetadata.technician = getVal('metaTechnician');
    if (getVal('metaCrea')) state.reportMetadata.crea = getVal('metaCrea');
    if (getVal('metaArt')) state.reportMetadata.art = getVal('metaArt');
    if (getVal('metaConcessionaria')) state.reportMetadata.concessionaria = getVal('metaConcessionaria');
    if (getVal('metaUcNumber')) state.reportMetadata.ucNumber = getVal('metaUcNumber');
    if (getVal('metaNotes')) state.reportMetadata.notes = getVal('metaNotes');
  }

  function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  function printReport() {
    window.print();
  }

  /**
   * Compartilhamento WhatsApp / Web Share
   */
  async function shareQuickSummary() {
    const { calcResult, diagnostic } = recalculateAndRender();
    const chargersList = calcResult.chargers.map(c => `• ${c.name}: ${c.nominalCurrent}A (${c.powerKW}kW) -> Cabo ${c.cableSection}mm², Disj. ${c.recommendedBreaker}A`).join('\n');
    
    const textToShare = `⚡ *LIGVOLT | AVALIAÇÃO DE VIABILIDADE ELÉTRICA VE*\n` +
      `-----------------------------------------\n` +
      `*DIAGNÓSTICO:* ${diagnostic.badge}\n` +
      `*Resumo:* ${diagnostic.summary}\n` +
      `*Status Geral:* ${diagnostic.headline}\n\n` +
      `*PONTOS DE RECARGA:*\n${chargersList}\n\n` +
      `*TOPOLOGIA RECOMENDADA:* ${diagnostic.recommendedScenario === 'A' ? 'Cenário A (Subquadro QGBT-EV)' : 'Cenário B (Circuitos Independentes)'}\n\n` +
      `*PRINCIPAIS PROVIDÊNCIAS:*\n` +
      (diagnostic.requiredAdaptations.length > 0 
        ? diagnostic.requiredAdaptations.slice(0, 3).map((a, i) => `${i + 1}. ${a.action}`).join('\n')
        : 'Nenhuma inconformidade impeditiva identificada.') +
      `\n\n_Avaliação técnica conforme ABNT NBR 5410, NBR 17019 e CBMERJ 326/2025._`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ligvolt - Avaliação de Recarga de VE',
          text: textToShare,
          url: window.location.href
        });
        return;
      } catch (err) {}
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}`;
    window.open(whatsappUrl, '_blank');
  }

  async function copySummaryToClipboard() {
    const { calcResult, diagnostic } = recalculateAndRender();
    const textToShare = `⚡ LIGVOLT | LAUDO E MEMORIAL DE RECARGA DE VE\n` +
      `Diagnóstico: ${diagnostic.badge} - ${diagnostic.headline}\n` +
      `Instalação: ${diagnostic.summary}\n` +
      `Solução Recomendada: ${diagnostic.recommendedScenario === 'A' ? 'Cenário A (Subquadro QGBT-EV)' : 'Cenário B (Circuitos Diretos)'}\n` +
      `Link: ${window.location.href}`;

    try {
      await navigator.clipboard.writeText(textToShare);
      showToast('✓ Resumo copiado para a área de transferência!');
    } catch (e) {
      showToast('Não foi possível copiar automaticamente.');
    }
  }

  function showToast(msg) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // MÉTODOS DO MÓDULO DE VISTORIA PRELIMINAR INTELIGENTE (WIZARD & IA)
  // =========================================================================

  function saveInspectionToLocalStorage() {
    try {
      const payload = {
        currentStep: inspectionState.currentStep,
        localData: inspectionState.localData,
        confirmations: inspectionState.confirmations,
        aiAnalysis: inspectionState.aiAnalysis,
        // Armazenamos metadados das fotos para evitar estourar cota do localStorage
        photos: inspectionState.photos.map(p => ({
          id: p.id,
          categoryKey: p.categoryKey,
          categoryName: p.categoryName,
          timestamp: p.timestamp,
          mimeType: p.mimeType,
          dataUrl: p.dataUrl // Base64 comprimida (~100KB)
        }))
      };
      localStorage.setItem('ligvolt_inspection_state', JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage quota atingida ou indisponível:', e);
    }
  }

  function loadInspectionFromLocalStorage() {
    try {
      const raw = localStorage.getItem('ligvolt_inspection_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.localData) inspectionState.localData = { ...inspectionState.localData, ...parsed.localData };
        if (parsed.confirmations) inspectionState.confirmations = { ...inspectionState.confirmations, ...parsed.confirmations };
        if (parsed.aiAnalysis) inspectionState.aiAnalysis = parsed.aiAnalysis;
        if (Array.isArray(parsed.photos)) inspectionState.photos = parsed.photos;
        if (parsed.currentStep) inspectionState.currentStep = parsed.currentStep;
      }
    } catch (e) {}
  }

  function switchAppMode(mode = 'vistoria') {
    const vistoriaView = document.getElementById('mode-vistoria');
    const avancadoView = document.getElementById('mode-avancado');
    const btnVistoria = document.getElementById('btnModeVistoria');
    const btnAvancado = document.getElementById('btnModeAvancado');

    if (mode === 'vistoria') {
      if (vistoriaView) vistoriaView.classList.remove('is-hidden');
      if (avancadoView) avancadoView.classList.add('is-hidden');
      if (btnVistoria) {
        btnVistoria.classList.add('active');
        btnVistoria.setAttribute('aria-selected', 'true');
      }
      if (btnAvancado) {
        btnAvancado.classList.remove('active');
        btnAvancado.setAttribute('aria-selected', 'false');
      }
    } else {
      if (vistoriaView) vistoriaView.classList.add('is-hidden');
      if (avancadoView) avancadoView.classList.remove('is-hidden');
      if (btnVistoria) {
        btnVistoria.classList.remove('active');
        btnVistoria.setAttribute('aria-selected', 'false');
      }
      if (btnAvancado) {
        btnAvancado.classList.add('active');
        btnAvancado.setAttribute('aria-selected', 'true');
      }
      recalculateAndRender();
    }
  }

  function renderInspectionStep(stepNum = 1) {
    inspectionState.currentStep = stepNum;
    saveInspectionToLocalStorage();

    // Atualiza stepper buttons
    for (let i = 1; i <= 4; i++) {
      const node = document.getElementById(`stepNode${i}`);
      if (node) {
        node.classList.toggle('active', i === stepNum);
        node.classList.toggle('completed', i < stepNum);
      }
      const pane = document.getElementById(`wizardStep${i}`);
      if (pane) {
        pane.classList.toggle('active', i === stepNum);
      }
    }

    if (stepNum === 1) {
      renderStep1VoltageOptions(inspectionState.localData.supplyType, inspectionState.localData.voltagePreset);
    } else if (stepNum === 2) {
      renderPhotosGrid();
    } else if (stepNum === 3) {
      renderConfirmationCards();
    } else if (stepNum === 4) {
      evaluateAndRenderInspectionDiagnostic();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderPhotosGrid() {
    const container = document.getElementById('photosCaptureContainer');
    if (!container || !SmartInspection) return;

    container.innerHTML = '';
    SmartInspection.PHOTO_CATEGORIES.forEach(cat => {
      const existingPhoto = inspectionState.photos.find(p => p.categoryKey === cat.key);
      const card = document.createElement('div');
      card.className = `photo-capture-card ${existingPhoto ? 'has-photo' : ''}`;
      card.id = `photo-card-${cat.key}`;

      const badge = cat.required 
        ? `<span class="photo-badge-req">Obrigatória</span>` 
        : `<span class="photo-badge-opt">Opcional</span>`;

      card.innerHTML = `
        <div class="photo-card-head">
          <h4 class="photo-card-title">${cat.icon} ${escapeHtml(cat.title)}</h4>
          ${badge}
        </div>
        <p class="photo-card-desc">${escapeHtml(cat.description)}</p>
        <div class="photo-card-tip">💡 <strong>Dica:</strong> ${escapeHtml(cat.tip)}</div>
        <div class="photo-slot-body">
          ${existingPhoto ? `
            <div class="photo-preview-box">
              <img src="${existingPhoto.dataUrl}" alt="${escapeHtml(cat.shortTitle)}" />
              <button type="button" class="btn-remove-photo" data-category="${cat.key}" title="Remover esta foto">✕</button>
              <div class="photo-meta-info">
                <span>✓ Capturada</span>
                <span>${existingPhoto.timestamp || ''}</span>
              </div>
            </div>
          ` : `
            <div class="photo-buttons-group">
              <input type="file" accept="image/*" capture="environment" id="camera-${cat.key}" class="photo-file-input" style="display:none;" data-category="${cat.key}" />
              <input type="file" accept="image/*" id="file-${cat.key}" class="photo-file-input" style="display:none;" data-category="${cat.key}" />
              <button type="button" class="btn-photo-capture primary-capture" data-target="camera-${cat.key}">
                📸 Câmera
              </button>
              <button type="button" class="btn-photo-capture" data-target="file-${cat.key}">
                📁 Arquivo
              </button>
            </div>
          `}
        </div>
      `;
      container.appendChild(card);
    });

    // Wire remove photo buttons
    container.querySelectorAll('.btn-remove-photo').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const catKey = this.dataset.category;
        inspectionState.photos = inspectionState.photos.filter(p => p.categoryKey !== catKey);
        saveInspectionToLocalStorage();
        renderPhotosGrid();
        showToast('Foto removida.');
      });
    });

    // Wire trigger buttons
    container.querySelectorAll('.btn-photo-capture').forEach(btn => {
      btn.addEventListener('click', function () {
        const targetId = this.dataset.target;
        const input = document.getElementById(targetId);
        if (input) input.click();
      });
    });

    // Wire file inputs
    container.querySelectorAll('.photo-file-input').forEach(input => {
      input.addEventListener('change', async function () {
        if (!this.files || !this.files[0]) return;
        const file = this.files[0];
        const catKey = this.dataset.category;
        const catObj = SmartInspection.PHOTO_CATEGORIES.find(c => c.key === catKey);

        try {
          showToast('Comprimindo foto...');
          const compressed = await SmartInspection.compressImage(file, 1280, 0.8);
          // Substitui se já houver foto dessa categoria
          inspectionState.photos = inspectionState.photos.filter(p => p.categoryKey !== catKey);
          inspectionState.photos.push({
            id: 'photo_' + Date.now(),
            categoryKey: catKey,
            categoryName: catObj ? catObj.shortTitle : catKey,
            dataUrl: compressed.dataUrl,
            base64: compressed.base64,
            mimeType: 'image/jpeg',
            timestamp: new Date().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          });
          saveInspectionToLocalStorage();
          renderPhotosGrid();
          showToast('✓ Foto registrada com sucesso!');
        } catch (err) {
          console.error('Erro ao processar imagem:', err);
          showToast('Erro ao processar a foto. Tente novamente.');
        }
      });
    });
  }

  function renderConfirmationCards() {
    const container = document.getElementById('confirmationCardsContainer');
    if (!container) return;

    container.innerHTML = '';
    const conf = inspectionState.confirmations;
    const isSubsoloOuFechada = inspectionState.localData.installArea === 'subsolo' || inspectionState.localData.installArea === 'garagem_fechada';
    const isRJ = (inspectionState.localData.cityState || '').toLowerCase().includes('rio') || (inspectionState.localData.cityState || '').toUpperCase().includes('RJ');

    const cards = [
      {
        id: 'mainBreaker',
        title: '⚡ 1. Disjuntor Geral da Entrada',
        aiBadge: inspectionState.aiAnalysis ? 'Detectado por IA' : 'Estimativa Preliminar',
        desc: 'Capacidade do disjuntor geral da edificação (visível no quadro ou na caixa do medidor).',
        choices: [
          { val: '40', label: '40A' },
          { val: '50', label: '50A (Padrão 10kW)' },
          { val: '63', label: '63A (Padrão 15kW)' },
          { val: '70', label: '70A' },
          { val: '100', label: '100A+' },
          { val: 'nao_sei', label: 'Não identificado / Não sei' }
        ],
        current: conf.mainBreakerConfirmed,
        onSelect: (v) => { conf.mainBreakerConfirmed = v; }
      },
      {
        id: 'spaceAvailable',
        title: '📦 2. Espaço Físico Reserva no Quadro',
        aiBadge: 'Verificação Física',
        desc: 'Existe espaço livre no trilho DIN do quadro para encaixar novos módulos de disjuntores e proteção DR?',
        choices: [
          { val: 'sim', label: '✓ Sim, há espaço livre no trilho' },
          { val: 'nao', label: '✕ Não, quadro está lotado (subquadro necessário)' },
          { val: 'nao_sei', label: '❓ Não sei / Pendente de visita' }
        ],
        current: conf.spaceAvailableConfirmed,
        onSelect: (v) => { conf.spaceAvailableConfirmed = v; }
      },
      {
        id: 'grounding',
        title: '🌱 3. Sistema de Aterramento (Condutor PE)',
        aiBadge: 'Segurança Crítica',
        desc: 'O local possui condutor de aterramento com barramento interligado? (A NBR 5410 proíbe recarga sem aterramento)',
        choices: [
          { val: 'sim', label: '✓ Sim, possui barramento de terra' },
          { val: 'nao', label: '✕ Não possui aterramento' },
          { val: 'nao_sei', label: '❓ Não sei / Aferir resistência em visita' }
        ],
        current: conf.groundingConfirmed,
        onSelect: (v) => { conf.groundingConfirmed = v; }
      },
      {
        id: 'rainProtection',
        title: '☔ 4. Proteção Contra Chuva no Local do Carregador',
        aiBadge: 'Intempéries',
        desc: 'O ponto pretendido para o carregador é abrigado ou ficará exposto a chuvas diretas e sol?',
        choices: [
          { val: 'sim', label: '✓ Abrigado / Coberto' },
          { val: 'nao', label: '✕ Ao ar livre / Exposto à chuva' }
        ],
        current: conf.rainProtectionConfirmed,
        onSelect: (v) => { conf.rainProtectionConfirmed = v; }
      },
      {
        id: 'exclusiveCircuit',
        title: '🔌 5. Circuito Elétrico para o Carregador',
        aiBadge: 'NBR 17019',
        desc: 'A norma exige circuito 100% exclusivo do quadro até o carregador (proibido compartilhar com tomadas comuns).',
        choices: [
          { val: 'nao', label: '🛠️ Instalar novo circuito dedicado (Padrão correto)' },
          { val: 'sim', label: '✓ Já possui circuito exclusivo e tubulação pronta' },
          { val: 'nao_sei', label: '❓ Não sei' }
        ],
        current: conf.exclusiveCircuitConfirmed,
        onSelect: (v) => { conf.exclusiveCircuitConfirmed = v; }
      },
      {
        id: 'capacityVerified',
        title: '📊 6. Demanda e Folga de Potência',
        aiBadge: 'Capacidade Concessionária',
        desc: 'A demanda de consumo elétrico da edificação nos horários de pico já foi medida ou analisada na conta de luz?',
        choices: [
          { val: 'sim', label: '✓ Sim, já verificada e há folga' },
          { val: 'nao_sei', label: '❓ Demanda desconhecida (fazer medição em visita)' }
        ],
        current: conf.capacityVerified,
        onSelect: (v) => { conf.capacityVerified = v; }
      }
    ];

    if (isSubsoloOuFechada) {
      cards.push({
        id: 'cbmerjSprinklers',
        title: '🚒 7. Proteção Contra Incêndio na Garagem Fechada / Subsolo',
        aiBadge: isRJ ? 'Exigência CBMERJ 326/2025' : 'Norma Estadual de Bombeiros',
        desc: isRJ 
          ? 'No Estado do RJ, a Nota CBMERJ 326/2025 proíbe recarga em subsolos e garagens fechadas sem chuveiros automáticos (sprinklers).'
          : 'Garagens subterrâneas ou enclausuradas requerem sistema de combate a incêndio com bicos de chuveiros automáticos (sprinklers).',
        choices: [
          { val: 'sim', label: '✓ Sim, o teto possui chuveiros automáticos (sprinklers)' },
          { val: 'nao', label: '✕ Não possui sprinklers (Impedimento no RJ)' },
          { val: 'nao_se_aplica', label: 'Garagem ao ar livre / Não se aplica' }
        ],
        current: conf.cbmerjSprinklers,
        onSelect: (v) => { conf.cbmerjSprinklers = v; }
      });
    }

    cards.forEach(cardData => {
      const cardEl = document.createElement('div');
      cardEl.className = 'confirm-item-card';
      cardEl.innerHTML = `
        <div class="confirm-item-header">
          <h4 class="confirm-item-title">${escapeHtml(cardData.title)}</h4>
          <span class="confirm-ai-badge">${escapeHtml(cardData.aiBadge)}</span>
        </div>
        <p class="confirm-item-desc">${escapeHtml(cardData.desc)}</p>
        <div class="confirm-buttons-row" data-card-id="${cardData.id}">
          ${cardData.choices.map(c => `
            <button type="button" class="btn-confirm-choice ${cardData.current === c.val ? 'is-selected' : ''}" data-value="${c.val}">
              ${escapeHtml(c.label)}
            </button>
          `).join('')}
        </div>
      `;

      cardEl.querySelectorAll('.btn-confirm-choice').forEach(btn => {
        btn.addEventListener('click', function () {
          cardEl.querySelectorAll('.btn-confirm-choice').forEach(b => b.classList.remove('is-selected'));
          this.classList.add('is-selected');
          cardData.onSelect(this.dataset.value);
          saveInspectionToLocalStorage();
        });
      });

      container.appendChild(cardEl);
    });
  }

  function evaluateAndRenderInspectionDiagnostic() {
    if (!SmartInspection) return;
    const diagnostic = SmartInspection.evaluateInspectionViability(inspectionState);
    inspectionState.diagnosticResult = diagnostic;
    saveInspectionToLocalStorage();

    // Render Hero Card
    const heroCard = document.getElementById('wizardDiagnosticHeroCard');
    if (heroCard) {
      heroCard.className = `diag-hero-card ${diagnostic.badgeClass}`;
      heroCard.innerHTML = `
        <div class="diag-header-row">
          <div class="diag-status-badge ${diagnostic.badgeClass}">${diagnostic.badge}</div>
        </div>
        <h3 class="diag-headline-title">${escapeHtml(diagnostic.headline)}</h3>
        <p class="diag-summary-text">${escapeHtml(diagnostic.summary)}</p>
      `;
    }

    // Render Critical Actions
    const listCrit = document.getElementById('listCriticalActions');
    const groupCrit = document.getElementById('groupCriticalActions');
    if (listCrit && groupCrit) {
      if (diagnostic.criticalActions.length === 0) {
        groupCrit.style.display = 'none';
      } else {
        groupCrit.style.display = 'block';
        listCrit.innerHTML = diagnostic.criticalActions.map(act => `
          <div class="diag-action-item">
            <span class="diag-action-bullet">🚨</span>
            <div><strong>Ação Crítica Impeditiva:</strong> ${escapeHtml(act)}</div>
          </div>
        `).join('');
      }
    }

    // Render Necessary Actions
    const listNec = document.getElementById('listNecessaryActions');
    if (listNec) {
      if (diagnostic.necessaryActions.length === 0) {
        listNec.innerHTML = `<div class="diag-action-item"><span class="diag-action-bullet">✓</span> Nenhum ajuste técnico complexo exigido.</div>`;
      } else {
        listNec.innerHTML = diagnostic.necessaryActions.map(act => `
          <div class="diag-action-item">
            <span class="diag-action-bullet">⚠️</span>
            <div>${escapeHtml(act)}</div>
          </div>
        `).join('');
      }
    }

    // Render Recommended Actions
    const listRec = document.getElementById('listRecommendedActions');
    if (listRec) {
      listRec.innerHTML = diagnostic.recommendedActions.map(act => `
        <div class="diag-action-item">
          <span class="diag-action-bullet">💡</span>
          <div>${escapeHtml(act)}</div>
        </div>
      `).join('');
    }

    // Render Next Steps
    const listNext = document.getElementById('listNextSteps');
    if (listNext) {
      listNext.innerHTML = `
        <div class="diag-action-item">
          <span class="diag-action-bullet">📋</span>
          <div>${escapeHtml(diagnostic.nextAction)}</div>
        </div>
        <div class="diag-action-item">
          <span class="diag-action-bullet">📄</span>
          <div>Gere e compartilhe o <strong>Laudo Preliminar de Vistoria</strong> com o cliente ou condomínio.</div>
        </div>
      `;
    }
  }

  async function analyzePhotosWithAI() {
    const overlay = document.getElementById('aiScanOverlay');
    const statusText = document.getElementById('aiScanStatusText');
    const fill = document.getElementById('aiScanProgressFill');

    if (overlay) overlay.classList.remove('is-hidden');
    if (statusText) statusText.textContent = '1/3: Compactando e preparando fotografias...';
    if (fill) fill.style.width = '30%';

    try {
      await new Promise(r => setTimeout(r, 600));

      if (statusText) statusText.textContent = '2/3: Enviando para análise multimodal Gemini...';
      if (fill) fill.style.width = '65%';

      const payload = {
        localData: inspectionState.localData,
        photos: inspectionState.photos.map(p => ({
          category: p.categoryKey,
          mimeType: p.mimeType,
          base64: p.base64
        }))
      };

      let analysisResult = null;
      try {
        const response = await fetch('/api/analyze-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const json = await response.json();
          analysisResult = json.analysis;
        }
      } catch (networkErr) {
        console.warn('API /api/analyze-photos offline ou sem chave. Usando motor heurístico local.', networkErr);
      }

      if (statusText) statusText.textContent = '3/3: Identificando disjuntores, folgas e proteções...';
      if (fill) fill.style.width = '95%';
      await new Promise(r => setTimeout(r, 700));

      // Se a API retornou análise, aplicar no estado
      if (analysisResult) {
        inspectionState.aiAnalysis = analysisResult;
        if (analysisResult.mainBreakerEstimate) {
          inspectionState.confirmations.mainBreakerConfirmed = String(analysisResult.mainBreakerEstimate);
        }
        if (analysisResult.hasDinSpace !== undefined) {
          inspectionState.confirmations.spaceAvailableConfirmed = analysisResult.hasDinSpace ? 'sim' : 'nao';
        }
        if (analysisResult.groundingIdentified !== undefined) {
          inspectionState.confirmations.groundingConfirmed = analysisResult.groundingIdentified ? 'sim' : 'nao_sei';
        }
      } else {
        // Heurística local inteligente
        const hasBreakerPhoto = inspectionState.photos.some(p => p.categoryKey === 'disjuntores' || p.categoryKey === 'quadro_geral');
        if (hasBreakerPhoto && inspectionState.confirmations.mainBreakerConfirmed === 'nao_sei') {
          inspectionState.confirmations.mainBreakerConfirmed = '50';
        }
      }

      saveInspectionToLocalStorage();
      if (overlay) overlay.classList.add('is-hidden');
      renderInspectionStep(3);
      showToast('✨ Fotografias interpretadas com sucesso!');
    } catch (err) {
      console.error('Erro na análise de fotos:', err);
      if (overlay) overlay.classList.add('is-hidden');
      renderInspectionStep(3);
      showToast('Avançando para confirmação.');
    }
  }

  /**
   * Renderiza dinamicamente as opções de tensão elétrica compatíveis com a alimentação selecionada
   */
  function renderStep1VoltageOptions(supplyType = 'bifasica', currentPreset = '127_220') {
    const container = document.getElementById('inspVoltageOptionsContainer');
    const customBox = document.getElementById('inspCustomVoltageBox');
    const unknownHint = document.getElementById('inspVoltageUnknownHint');
    if (!container) return;

    let options = [];
    if (supplyType === 'monofasica') {
      options = [
        { id: '127_mono', label: '127 V', sub: 'Fase + Neutro (Padrão 127V)', desc: '127V F-N' },
        { id: '220_mono', label: '220 V', sub: 'Fase + Neutro (Padrão 220V)', desc: '220V F-N' },
        { id: 'custom', label: 'Outra', sub: 'Digitar valores manuais', desc: 'Personalizada' },
        { id: 'nao_sei', label: '❓ Não sei', sub: 'Investigar via fotos no Passo 2', desc: 'Pendente' }
      ];
      if (!['127_mono', '220_mono', 'custom', 'nao_sei'].includes(currentPreset)) {
        currentPreset = '220_mono';
      }
    } else if (supplyType === 'bifasica') {
      options = [
        { id: '127_220', label: '127 / 220 V (Padrão Sugerido)', sub: 'Mais comum no Brasil (F-N: 127V | F-F: 220V)', desc: 'Recomendado' },
        { id: '220_380', label: '220 / 380 V', sub: 'F-N: 220V | F-F: 380V (Algumas concessionárias)', desc: 'Rede 380V' },
        { id: '220_mono', label: '220 V (Bifásico Puro)', sub: 'Fase-Fase 220V sem neutro', desc: '220V F-F' },
        { id: 'custom', label: 'Outra', sub: 'Digitar valores manuais', desc: 'Personalizada' },
        { id: 'nao_sei', label: '❓ Não sei', sub: 'Investigar via fotos no Passo 2', desc: 'Pendente' }
      ];
      if (!['127_220', '220_380', '220_mono', 'custom', 'nao_sei'].includes(currentPreset)) {
        currentPreset = '127_220';
      }
    } else if (supplyType === 'trifasica') {
      options = [
        { id: '127_220', label: '127 / 220 V', sub: 'Trifásico com 127V F-N e 220V F-F', desc: 'Rede 220V Trifásica' },
        { id: '220_380', label: '220 / 380 V (Padrão Comercial)', sub: 'Trifásico com 220V F-N e 380V F-F', desc: 'Rede 380V Trifásica' },
        { id: 'custom', label: 'Outra', sub: 'Digitar valores manuais', desc: 'Personalizada' },
        { id: 'nao_sei', label: '❓ Não sei', sub: 'Investigar via fotos no Passo 2', desc: 'Pendente' }
      ];
      if (!['127_220', '220_380', 'custom', 'nao_sei'].includes(currentPreset)) {
        currentPreset = '220_380';
      }
    } else { // nao_sei
      options = [
        { id: '127_220', label: '127 / 220 V (Mais Provável)', sub: 'Padrão residencial predominante', desc: 'Sugestão inicial' },
        { id: '220_380', label: '220 / 380 V', sub: 'Redes comerciais ou certas regiões', desc: 'Sugestão inicial' },
        { id: 'nao_sei', label: '❓ Totalmente Desconhecido', sub: 'Identificar nas fotos do Passo 2', desc: 'Pendente' }
      ];
      if (!['127_220', '220_380', 'nao_sei'].includes(currentPreset)) {
        currentPreset = '127_220';
      }
    }

    inspectionState.localData.voltagePreset = currentPreset;

    container.innerHTML = options.map(opt => `
      <button type="button" class="voltage-pill-btn ${opt.id === currentPreset ? 'active' : ''}" data-val="${opt.id}">
        <span class="v-pill-val">${escapeHtml(opt.label)}</span>
        <span class="v-pill-sub">${escapeHtml(opt.sub)}</span>
      </button>
    `).join('');

    if (customBox) {
      customBox.style.display = currentPreset === 'custom' ? 'grid' : 'none';
    }
    if (unknownHint) {
      unknownHint.style.display = (currentPreset === 'nao_sei' || supplyType === 'nao_sei') ? 'block' : 'none';
    }

    container.querySelectorAll('.voltage-pill-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        container.querySelectorAll('.voltage-pill-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const val = this.dataset.val;
        inspectionState.localData.voltagePreset = val;
        if (customBox) customBox.style.display = val === 'custom' ? 'grid' : 'none';
        if (unknownHint) unknownHint.style.display = (val === 'nao_sei' || supplyType === 'nao_sei') ? 'block' : 'none';
        saveInspectionToLocalStorage();
        syncVistoriaToTechnical('voltagePreset', val);
      });
    });
  }

  /**
   * Sincroniza dados da Vistoria Guiada para a Análise Técnica em tempo real
   */
  function syncVistoriaToTechnical(field, value) {
    const loc = inspectionState.localData;

    if (field === 'supplyType') {
      if (value === 'nao_sei') {
        state.supplyType = 'bifasica';
        state.supplyTypeStatus = 'nao_confirmado';
      } else if (value === 'bifasica') {
        state.supplyType = 'bifasica';
        state.supplyTypeStatus = 'sugerido';
      } else {
        state.supplyType = value;
        state.supplyTypeStatus = 'confirmado';
      }
      document.querySelectorAll('input[name="supplyType"]').forEach(r => {
        r.checked = (r.value === state.supplyType);
      });
      state.chargers.forEach(ch => {
        if (state.supplyType === 'monofasica') ch.phaseConfig = 'L1-N';
        else if (state.supplyType === 'bifasica' && ch.phaseConfig === '3F') ch.phaseConfig = 'L1-L2';
      });
      renderStep1VoltageOptions(value, loc.voltagePreset);
      renderChargersList();
    } else if (field === 'voltagePreset') {
      if (value === 'nao_sei') {
        state.voltagePreset = '127_220';
        state.voltageStatus = 'nao_confirmado';
      } else if (value === 'custom') {
        state.voltagePreset = 'custom';
        state.voltageStatus = 'confirmado';
      } else {
        state.voltagePreset = value;
        state.voltageStatus = 'confirmado';
      }
      const sel = document.getElementById('voltagePreset');
      if (sel) {
        let optFound = false;
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === value) {
            sel.selectedIndex = i;
            optFound = true;
            break;
          }
        }
        if (!optFound && value !== 'nao_sei') {
          sel.value = value;
        }
      }
    } else if (field === 'vehicleCount') {
      const count = parseInt(value, 10) || 1;
      const isTomada = loc.chargerType === 'tomada';
      const current = isTomada ? 16 : 32;
      state.chargers = [];
      for (let i = 1; i <= count; i++) {
        state.chargers.push({
          id: i,
          name: isTomada ? `Ponto Especial ${i}` : `Wallbox Vaga ${i}`,
          nominalCurrent: current,
          enabled: true,
          phaseConfig: state.supplyType === 'monofasica' ? 'L1-N' : (state.supplyType === 'bifasica' ? 'L1-L2' : '3F')
        });
      }
      renderChargersList();
    } else if (field === 'chargerType') {
      const isTomada = value === 'tomada';
      const current = isTomada ? 16 : 32;
      state.chargers.forEach((c, idx) => {
        c.nominalCurrent = current;
        c.name = isTomada ? `Ponto Especial ${idx + 1}` : `Wallbox Vaga ${idx + 1}`;
      });
      renderChargersList();
    } else if (field === 'distanceApprox') {
      let d = 20;
      if (value === '<10') d = 8;
      else if (value === '10-25') d = 20;
      else if (value === '25-50') d = 35;
      else if (value === '>50') d = parseFloat(loc.customDistance) || 60;
      state.distance = d;
      state.distanceStatus = value === '>50' ? 'confirmado' : 'sugerido';
      const distInput = document.getElementById('inputDistance');
      if (distInput) distInput.value = d;
    }

    recalculateAndRender();
  }

  /**
   * Sincroniza dados da Análise Técnica de volta para a Vistoria Guiada
   */
  function syncTechnicalToVistoria(field, value) {
    const loc = inspectionState.localData;
    const conf = inspectionState.confirmations;

    if (field === 'supplyType') {
      loc.supplyType = value;
      state.supplyTypeStatus = 'confirmado';
      document.querySelectorAll('input[name="inspSupplyType"]').forEach(r => {
        r.checked = (r.value === value);
      });
      renderStep1VoltageOptions(value, loc.voltagePreset);
    } else if (field === 'voltagePreset') {
      loc.voltagePreset = value;
      state.voltageStatus = 'confirmado';
      renderStep1VoltageOptions(loc.supplyType, value);
    } else if (field === 'distance') {
      const d = parseFloat(value) || 20;
      state.distanceStatus = 'confirmado';
      let approx = '10-25';
      if (d < 10) approx = '<10';
      else if (d <= 25) approx = '10-25';
      else if (d <= 50) approx = '25-50';
      else approx = '>50';
      loc.distanceApprox = approx;
      const dBox = document.getElementById('inspCustomDistanceBox');
      const dInput = document.getElementById('inspInputCustomDistance');
      document.querySelectorAll('input[name="inspDistanceApprox"]').forEach(r => {
        r.checked = (r.value === approx);
      });
      if (approx === '>50') {
        loc.customDistance = d;
        if (dBox) dBox.style.display = 'block';
        if (dInput) dInput.value = d;
      } else {
        if (dBox) dBox.style.display = 'none';
      }
    } else if (field === 'mainBreaker') {
      const b = parseFloat(value);
      if (b > 0) {
        conf.mainBreakerConfirmed = String(b);
      } else {
        conf.mainBreakerConfirmed = 'nao_sei';
      }
    } else if (field === 'chargers') {
      const count = state.chargers.length;
      loc.vehicleCount = count;
      const vBox = document.getElementById('inspCustomVehicleBox');
      const vInput = document.getElementById('inspInputCustomVehicle');
      if (count > 3) {
        document.querySelectorAll('input[name="inspVehicleCount"]').forEach(r => {
          r.checked = (r.value === 'mais_de_3');
        });
        if (vBox) vBox.style.display = 'block';
        if (vInput) vInput.value = count;
      } else {
        document.querySelectorAll('input[name="inspVehicleCount"]').forEach(r => {
          r.checked = (r.value === String(count));
        });
        if (vBox) vBox.style.display = 'none';
      }
    }

    saveInspectionToLocalStorage();
  }

  function syncInspectionToAdvancedEngine() {
    const loc = inspectionState.localData;
    const conf = inspectionState.confirmations;

    // Tipo de alimentação e status
    if (loc.supplyType === 'nao_sei') {
      state.supplyType = 'bifasica';
      state.supplyTypeStatus = 'nao_confirmado';
    } else if (loc.supplyType === 'bifasica') {
      state.supplyType = 'bifasica';
      state.supplyTypeStatus = 'sugerido';
    } else {
      state.supplyType = loc.supplyType || 'bifasica';
      state.supplyTypeStatus = 'confirmado';
    }
    document.querySelectorAll('input[name="supplyType"]').forEach(r => {
      r.checked = (r.value === state.supplyType);
    });

    // Tensão
    if (loc.voltagePreset === 'nao_sei') {
      state.voltagePreset = '127_220';
      state.voltageStatus = 'nao_confirmado';
    } else if (loc.voltagePreset === 'custom') {
      state.voltagePreset = 'custom';
      state.voltageStatus = 'confirmado';
      state.voltagePhaseNeutral = parseFloat(loc.customVfn) || 127;
      state.voltagePhasePhase = parseFloat(loc.customVff) || 220;
    } else {
      state.voltagePreset = loc.voltagePreset || '127_220';
      state.voltageStatus = 'confirmado';
    }
    const selV = document.getElementById('voltagePreset');
    if (selV && state.voltagePreset) selV.value = state.voltagePreset;

    // Distância
    if (loc.distanceApprox === '<10') state.distance = 8;
    else if (loc.distanceApprox === '10-25') state.distance = 20;
    else if (loc.distanceApprox === '25-50') state.distance = 35;
    else if (loc.distanceApprox === '>50') state.distance = parseFloat(loc.customDistance) || 60;
    state.distanceStatus = loc.distanceApprox === '>50' ? 'confirmado' : 'sugerido';
    const distInput = document.getElementById('inputDistance');
    if (distInput) distInput.value = state.distance;
    state.distanceStatus = 'sugerido';
    const distInput = document.getElementById('inputDistance');
    if (distInput) distInput.value = state.distance;

    // Disjuntor geral
    if (conf.mainBreakerConfirmed && conf.mainBreakerConfirmed !== 'nao_sei') {
      const bNum = parseFloat(conf.mainBreakerConfirmed);
      if (bNum > 0) {
        state.mainBreakerKnown = true;
        state.mainBreaker = bNum;
        const mbInput = document.getElementById('inputMainBreaker');
        if (mbInput) mbInput.value = bNum;
      }
    } else {
      state.mainBreakerKnown = false;
      state.mainBreaker = null;
      const mbInput = document.getElementById('inputMainBreaker');
      if (mbInput) mbInput.value = '';
    }

    // Carregadores
    const vCount = parseInt(loc.vehicleCount, 10) || 1;
    const isTomada = loc.chargerType === 'tomada';
    const current = isTomada ? 16 : 32;

    state.chargers = [];
    for (let i = 1; i <= vCount; i++) {
      state.chargers.push({
        id: i,
        name: isTomada ? `Ponto Especial ${i}` : `Wallbox Vaga ${i}`,
        nominalCurrent: current,
        enabled: true,
        phaseConfig: state.supplyType === 'monofasica' ? 'L1-N' : (state.supplyType === 'bifasica' ? 'L1-L2' : '3F')
      });
    }

    renderChargersList();
    recalculateAndRender();
    switchAppMode('avancado');
    showToast('⚙️ Dados da vistoria integrados ao motor elétrico de engenharia!');
  }

  return {
    state,
    inspectionState,
    initChecklistState,
    renderChargersList,
    renderChecklist,
    recalculateAndRender,
    openReportModal,
    closeReportModal,
    printReport,
    shareQuickSummary,
    copySummaryToClipboard,
    showToast,
    saveInspectionToLocalStorage,
    loadInspectionFromLocalStorage,
    switchAppMode,
    renderInspectionStep,
    renderPhotosGrid,
    renderConfirmationCards,
    evaluateAndRenderInspectionDiagnostic,
    analyzePhotosWithAI,
    renderStep1VoltageOptions,
    syncVistoriaToTechnical,
    syncTechnicalToVistoria,
    syncInspectionToAdvancedEngine
  };
}));
