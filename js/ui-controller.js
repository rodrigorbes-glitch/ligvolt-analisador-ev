/**
 * LIGVOLT - Controlador de Interface do Usuário (UI Controller)
 * Gerencia inputs, reatividade, renderização do checklist, cenários, laudos e compartilhamento
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./calculation-engine', './compliance-rules', './diagnostic-engine', './report-generator', './dossier-generator'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./calculation-engine'),
      require('./compliance-rules'),
      require('./diagnostic-engine'),
      require('./report-generator'),
      require('./dossier-generator')
    );
  } else {
    root.LigvoltUI = factory(root.LigvoltEngine, root.LigvoltCompliance, root.LigvoltDiagnostic, root.LigvoltReport, root.LigvoltDossier);
  }
}(typeof self !== 'undefined' ? self : this, function (Engine, Compliance, Diagnostic, Report, Dossier) {
  'use strict';

  // Estado interno da aplicação
  let state = {
    activeTab: 'tab-dimensionamento',
    activeDocType: 'relatorio', // 'relatorio', 'laudo', 'memoria', 'concessionaria', 'dossie'
    supplyType: 'trifasica',
    voltagePreset: '220_380',
    voltagePhaseNeutral: 220,
    voltagePhasePhase: 380,
    voltageSingle: 220,
    distance: 25,
    mainBreakerKnown: true,
    mainBreaker: 100,
    demandKnown: true,
    demandMode: 'per_phase',
    demandUnit: 'A',
    demandTotal: 40,
    demandPhases: { L1: 30, L2: 25, L3: 20 },
    cableInsulation: 'PVC',
    installationMethod: 'B1',
    groupingCircuits: 1,
    ambientTemp: 30,
    useContinuousMargin: true,
    continuousMarginFactor: 1.25,
    maxVoltageDrop: 4.0,
    chargers: [
      { id: 1, name: 'Carregador 1 (Vaga A)', nominalCurrent: 32, enabled: true, phaseConfig: '3F' },
      { id: 2, name: 'Carregador 2 (Vaga B)', nominalCurrent: 32, enabled: true, phaseConfig: '3F' }
    ],
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
   * Renderiza a lista de carregadores na interface
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

      card.innerHTML = `
        <div class="charger-card-header">
          <div class="charger-title-group">
            <span class="charger-badge">Ponto ${idx + 1}</span>
            <input type="text" class="charger-name-input" value="${escapeHtml(ch.name)}" data-action="update-name" data-id="${ch.id}" placeholder="Nome do ponto" />
          </div>
          <div class="charger-card-actions">
            <label class="switch-toggle" title="Ativar/Desativar este carregador">
              <input type="checkbox" ${ch.enabled ? 'checked' : ''} data-action="toggle-charger" data-id="${ch.id}" />
              <span class="slider round"></span>
            </label>
            ${state.chargers.length > 1 ? `
              <button type="button" class="btn-icon btn-remove-charger" data-action="remove-charger" data-id="${ch.id}" title="Remover carregador">
                ✕
              </button>
            ` : ''}
          </div>
        </div>

        <div class="charger-card-body">
          <div class="form-row">
            <div class="form-col">
              <label class="form-label">Corrente Nominal (A)</label>
              <div class="input-with-presets">
                <input type="number" class="form-control" min="6" max="100" step="1" value="${ch.nominalCurrent}" data-action="update-current" data-id="${ch.id}" />
                <div class="quick-chips">
                  <button type="button" class="chip ${ch.nominalCurrent === 16 ? 'active' : ''}" data-action="set-preset-current" data-id="${ch.id}" data-val="16">16A</button>
                  <button type="button" class="chip ${ch.nominalCurrent === 32 ? 'active' : ''}" data-action="set-preset-current" data-id="${ch.id}" data-val="32">32A</button>
                  <button type="button" class="chip ${ch.nominalCurrent === 40 ? 'active' : ''}" data-action="set-preset-current" data-id="${ch.id}" data-val="40">40A</button>
                </div>
              </div>
            </div>

            <div class="form-col">
              <label class="form-label">Fases de Alimentação</label>
              <select class="form-control" data-action="update-phase" data-id="${ch.id}">
                ${phaseOptions.map(opt => `
                  <option value="${opt.value}" ${ch.phaseConfig === opt.value ? 'selected' : ''}>${opt.label}</option>
                `).join('')}
              </select>
            </div>
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
   * Renderiza a lista interativa de checklist de conformidade
   */
  function renderChecklist() {
    const container = document.getElementById('checklistContainer');
    if (!container) return;

    container.innerHTML = '';

    Compliance.CHECKLIST_ITEMS.forEach(item => {
      const currentVal = state.checklistResponses[item.id] || item.defaultStatus || 'nao_verificado';

      const card = document.createElement('div');
      card.className = `checklist-card status-border-${currentVal}`;
      card.id = `card-${item.id}`;

      let classBadge = 'badge-norm';
      if (item.classification.includes('CBMERJ') || item.classification.includes('Bombeiros')) {
        classBadge = 'badge-fire';
      } else if (item.classification.includes('Recomendação')) {
        classBadge = 'badge-rec';
      }

      card.innerHTML = `
        <div class="checklist-card-top">
          <div class="checklist-header-title">
            <span class="checklist-title-text">${item.title}</span>
            <span class="norm-ref-pill ${classBadge}">${item.classification}</span>
          </div>
          <span class="norm-reference"><small>${item.normativeRef}</small></span>
        </div>

        <p class="checklist-desc">${item.description}</p>

        <div class="checklist-options-group">
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
          <div class="checklist-risk-alert">
            <strong>⚠️ Risco e Consequência:</strong> ${item.inadequateRisk}
          </div>
        ` : ''}
      `;

      container.appendChild(card);
    });
  }

  /**
   * Executa a rotina central de recálculo e atualização de todas as seções
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
    renderSizingResults(calcResult);
    renderScenariosComparison(calcResult);

    return { calcResult, diagnostic };
  }

  /**
   * Renderiza o Card de Diagnóstico Inteligente destacado
   */
  function renderDiagnosticCard(diagnostic, calcResult) {
    const card = document.getElementById('intelligentDiagnosticCard');
    if (!card) return;

    card.className = `diag-hero-card ${diagnostic.badgeClass}`;

    let iconSymbol = '🟢';
    if (diagnostic.state === 'NAO_APTO') iconSymbol = '🔴';
    else if (diagnostic.state === 'APTO_COM_ADEQUACOES') iconSymbol = '🟡';
    else if (diagnostic.state === 'INCOMPLETA') iconSymbol = '⚪';

    let issuesHtml = '';
    if (diagnostic.identifiedIssues.length > 0) {
      issuesHtml = `
        <div class="diag-issues-section">
          <h4 class="diag-section-title">Inconformidades ou Riscos Identificados:</h4>
          <ul class="diag-bullet-list">
            ${diagnostic.identifiedIssues.map(iss => `<li>⚠️ ${escapeHtml(iss)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    let adaptationsHtml = '';
    if (diagnostic.requiredAdaptations.length > 0) {
      adaptationsHtml = `
        <div class="diag-adaptations-section">
          <h4 class="diag-section-title">Adequações Necessárias para Viabilizar:</h4>
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

    let pendingHtml = '';
    if (diagnostic.pendingVerifications.length > 0) {
      pendingHtml = `
        <div class="diag-pending-section">
          <span class="pending-hint">🔍 <strong>Vistorias pendentes:</strong> ${diagnostic.pendingVerifications.length} item(ns) dependem de confirmação presencial.</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="diag-top-banner">
        <div class="diag-status-pill ${diagnostic.badgeClass}">
          <span class="diag-icon">${iconSymbol}</span>
          <span class="diag-badge-text">${diagnostic.badge}</span>
        </div>
        <div class="diag-actions-group">
          <button type="button" class="btn-primary-action" id="btnOpenReport">
            📄 Central de Laudos & Dossiê
          </button>
          <button type="button" class="btn-share-quick" id="btnShareQuick" title="Compartilhar no WhatsApp ou copiar resumo">
            📲 Compartilhar
          </button>
        </div>
      </div>

      <div class="diag-headline-box">
        <h3 class="diag-headline">${diagnostic.headline}</h3>
        <p class="diag-summary-text">${diagnostic.summary}</p>
      </div>

      ${diagnostic.scenarioRationale ? `
        <div class="diag-recommended-solution">
          <strong>Solução Recomendada:</strong> ${diagnostic.recommendedScenario === 'A' ? 'Cenário A (Alimentador Único + Subquadro QGBT-EV)' : 'Cenário B (Circuitos Independentes Diretos)'}.
          <span class="solution-details">${diagnostic.scenarioRationale}</span>
        </div>
      ` : ''}

      ${issuesHtml}
      ${adaptationsHtml}
      ${pendingHtml}
    `;

    // Re-bind dos botões
    const reportBtn = document.getElementById('btnOpenReport');
    if (reportBtn) reportBtn.addEventListener('click', () => openReportModal('relatorio'));

    const shareBtn = document.getElementById('btnShareQuick');
    if (shareBtn) shareBtn.addEventListener('click', shareQuickSummary);
  }

  /**
   * Renderiza os resultados de dimensionamento elétrico
   */
  function renderSizingResults(calcResult) {
    const summaryContainer = document.getElementById('sizingSummaryContainer');
    if (!summaryContainer) return;

    if (calcResult.status === 'NO_CHARGERS') {
      summaryContainer.innerHTML = `
        <div class="empty-state">
          <p>Adicione ao menos um carregador ativo para visualizar o dimensionamento de cabos e proteções.</p>
        </div>
      `;
      return;
    }

    const { chargers, phaseSummary, input } = calcResult;
    const phaseBarsHtml = renderPhaseLoadMeters(phaseSummary, input.mainBreaker, input.supplyType);

    const chargersCardsHtml = chargers.map((ch, idx) => `
      <div class="sized-charger-box">
        <div class="sized-ch-header">
          <div>
            <strong>${escapeHtml(ch.name)}</strong>
            <span class="badge-tech">${ch.powerKW} kW • ${ch.nominalCurrent}A (${ch.phaseConfig})</span>
          </div>
          <span class="drop-badge ${ch.voltageDropCompliant ? 'drop-ok' : 'drop-warn'}">
            Queda: ${ch.voltageDropPercent}% (${ch.voltageDropVolts}V)
          </span>
        </div>

        <div class="sized-specs-grid">
          <div class="spec-item">
            <span class="spec-label">Condutor de Fase / Neutro</span>
            <span class="spec-value">${ch.cableSection} mm² (Cobre ${input.cableInsulation})</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Condutor Proteção (PE)</span>
            <span class="spec-value">${ch.peSection} mm² (NBR 5410 Tab. 58)</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Disjuntor Recomendado</span>
            <span class="spec-value"><strong>${ch.recommendedBreaker} A</strong> (${ch.breakerPoles})</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Corrente de Projeto (IB)</span>
            <span class="spec-value">${ch.projectCurrent} A (Margem ${((input.continuousMargin - 1) * 100).toFixed(0)}%)</span>
          </div>
          <div class="spec-item spec-span-2">
            <span class="spec-label">Proteção Diferencial Residual (DR)</span>
            <span class="spec-value spec-small">${ch.drSpec}</span>
          </div>
        </div>
      </div>
    `).join('');

    summaryContainer.innerHTML = `
      <div class="phase-meter-panel">
        <h4 class="sub-title">Distribuição de Carga por Fase vs Limite do Disjuntor Geral</h4>
        ${phaseBarsHtml}
      </div>

      <div class="sized-chargers-list">
        <h4 class="sub-title" style="margin-top: 20px;">Dimensionamento Individual por Ponto de Recarga</h4>
        ${chargersCardsHtml}
      </div>
    `;
  }

  /**
   * Renderiza barras de progresso visual para as fases
   */
  function renderPhaseLoadMeters(phaseSummary, mainBreaker, supplyType) {
    if (!phaseSummary) return '';

    const phasesToRender = ['A'];
    if (supplyType !== 'monofasica') phasesToRender.push('B');
    if (supplyType === 'trifasica') phasesToRender.push('C');

    return `
      <div class="phase-bars-container">
        ${phasesToRender.map(p => {
          const pData = phaseSummary.phases[p];
          const total = pData.totalProject;
          const limit = mainBreaker || total;
          const pct = Math.min(100, Math.round((total / limit) * 100));
          const isOver = mainBreaker && total > mainBreaker;
          const colorClass = isOver ? 'bar-danger' : (pct > 80 ? 'bar-warning' : 'bar-normal');

          return `
            <div class="phase-meter-row">
              <div class="phase-meter-label">
                <strong>Fase ${p}</strong>
                <span class="phase-meter-values">
                  ${pData.existing > 0 ? `Existente: ${pData.existing}A + ` : ''}
                  Recarga: ${pData.evProject}A = <strong>${total}A</strong>
                  ${mainBreaker ? ` / Geral: ${mainBreaker}A` : ''}
                </span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${colorClass}" style="width: ${pct}%"></div>
              </div>
              ${isOver ? `<span class="overload-pill">⚠️ SOBRECARGA (+${(total - mainBreaker).toFixed(1)}A)</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      ${supplyType === 'trifasica' ? `
        <div class="unbalance-footer">
          <span>Desbalanço entre fases: <strong>${phaseSummary.unbalancePercent}%</strong></span>
          ${phaseSummary.unbalancePercent > 20 ? '<span class="text-warn"> (Recomenda-se redistribuir fases)</span>' : ''}
        </div>
      ` : ''}
    `;
  }

  /**
   * Renderiza a comparação entre Cenário A e Cenário B
   */
  function renderScenariosComparison(calcResult) {
    const container = document.getElementById('scenariosComparisonContainer');
    if (!container || calcResult.status === 'NO_CHARGERS') return;

    const { scenarioA, scenarioB, comparison, input } = calcResult;

    container.innerHTML = `
      <div class="comparison-banner ${comparison.recommendedScenario === 'A' ? 'recommends-a' : 'recommends-b'}">
        <div class="recommendation-badge">
          RECOMENDAÇÃO TÉCNICA: ${comparison.recommendedScenario === 'A' ? 'CENÁRIO A (Alimentador Único + Subquadro QGBT-EV)' : 'CENÁRIO B (Circuitos Independentes Diretos)'}
        </div>
        <p class="recommendation-text">${comparison.rationale}</p>
      </div>

      <div class="scenarios-grid">
        <div class="scenario-card ${comparison.recommendedScenario === 'A' ? 'is-recommended' : ''}">
          <div class="scenario-card-header">
            <h4>Cenário A: Subquadro QGBT-EV</h4>
            <span class="scenario-tag">Recomendado p/ Múltiplos ou Distâncias > 15m</span>
          </div>

          <div class="scenario-card-body">
            <ul class="scenario-props">
              <li>
                <strong>Cabo Alimentador Geral:</strong>
                <span>${scenarioA.cableDescription}</span>
              </li>
              <li>
                <strong>Disjuntor no Quadro Geral:</strong>
                <span>${scenarioA.breakerRating}A (${scenarioA.breakerPoles})</span>
              </li>
              <li>
                <strong>Queda de Tensão no Alimentador:</strong>
                <span>${scenarioA.voltageDropPercent}%</span>
              </li>
              <li>
                <strong>Condutor PE do Alimentador:</strong>
                <span>${scenarioA.peSection} mm²</span>
              </li>
              <li>
                <strong>Proteções Locais no Subquadro:</strong>
                <span>Disjuntor + DR 30mA individual por carregador</span>
              </li>
              <li>
                <strong>Proteção contra Surtos:</strong>
                <span>1x Conjunto DPS Classe II centralizado no subquadro</span>
              </li>
              <li>
                <strong>Desligamento de Emergência:</strong>
                <span>Botão de parada cogumelo integrado na área de recarga</span>
              </li>
            </ul>

            <div class="scenario-benefits">
              <strong>Vantagens Técnicas:</strong>
              <ul>
                ${comparison.scenarioAAdvantages.map(adv => `<li>✓ ${adv}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>

        <div class="scenario-card ${comparison.recommendedScenario === 'B' ? 'is-recommended' : ''}">
          <div class="scenario-card-header">
            <h4>Cenário B: Circuitos Independentes Diretos</h4>
            <span class="scenario-tag">Recomendado p/ 1 Carregador ou Distância Curta</span>
          </div>

          <div class="scenario-card-body">
            <ul class="scenario-props">
              <li>
                <strong>Circuitos Paralelos no Trajeto:</strong>
                <span>${scenarioB.chargersCount} cabos dedicados percorrendo ${input.distance}m</span>
              </li>
              <li>
                <strong>Disjuntores e DRs:</strong>
                <span>Todos instalados no quadro geral principal distante</span>
              </li>
              <li>
                <strong>Ocupação de Tubulações:</strong>
                <span>${scenarioB.conduitOccupancy}</span>
              </li>
              <li>
                <strong>Fator de Agrupamento Aplicável:</strong>
                <span>${input.fGroup.toFixed(2)} (induz derating térmico dos cabos)</span>
              </li>
            </ul>

            <div class="scenario-benefits">
              <strong>Vantagens Técnicas:</strong>
              <ul>
                ${comparison.scenarioBAdvantages.map(adv => `<li>✓ ${adv}</li>`).join('')}
              </ul>
            </div>
          </div>
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

    // Renderiza o documento ativo
    renderActiveDocument(calcResult, diagnostic);

    // Marca o botão da aba do modal como ativo
    document.querySelectorAll('.doc-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.doc === state.activeDocType);
    });

    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function renderActiveDocument(calcResult, diagnostic) {
    const content = document.getElementById('reportModalContent');
    if (!content) return;

    if (state.activeDocType === 'relatorio') {
      content.innerHTML = Report.buildReportHTML(calcResult, diagnostic, state.checklistResponses, state.reportMetadata);
    } else if (state.activeDocType === 'laudo') {
      content.innerHTML = Dossier.buildTechnicalOpinion(calcResult, diagnostic, state.checklistResponses, state.reportMetadata);
    } else if (state.activeDocType === 'memoria') {
      content.innerHTML = Dossier.buildCalculationMemory(calcResult, state.reportMetadata);
    } else if (state.activeDocType === 'concessionaria') {
      content.innerHTML = Dossier.buildConcessionaireRequest(calcResult, state.reportMetadata);
    } else if (state.activeDocType === 'dossie') {
      // Dossiê Completo Unificado
      content.innerHTML = `
        ${Report.buildReportHTML(calcResult, diagnostic, state.checklistResponses, state.reportMetadata)}
        <div style="page-break-before: always; margin-top: 40px; border-top: 2px dashed #94A3B8; padding-top: 20px;"></div>
        ${Dossier.buildTechnicalOpinion(calcResult, diagnostic, state.checklistResponses, state.reportMetadata)}
        <div style="page-break-before: always; margin-top: 40px; border-top: 2px dashed #94A3B8; padding-top: 20px;"></div>
        ${Dossier.buildCalculationMemory(calcResult, state.reportMetadata)}
        <div style="page-break-before: always; margin-top: 40px; border-top: 2px dashed #94A3B8; padding-top: 20px;"></div>
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
   * Compartilhamento Rápido (WhatsApp / Web Share API / Copiar Texto)
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
      `*TOPOLOGIA RECOMENDADA:* ${diagnostic.recommendedScenario === 'A' ? 'Cenário A (Alimentador Único + Subquadro QGBT-EV)' : 'Cenário B (Circuitos Independentes)'}\n\n` +
      `*PRINCIPAIS PROVIDÊNCIAS:*\n` +
      (diagnostic.requiredAdaptations.length > 0 
        ? diagnostic.requiredAdaptations.slice(0, 3).map((a, i) => `${i + 1}. ${a.action}`).join('\n')
        : 'Nenhuma inconformidade impeditiva identificada.') +
      `\n\n_Avaliação técnica preliminar conforme ABNT NBR 5410, NBR 17019 e CBMERJ 326/2025._`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ligvolt - Avaliação de Recarga de VE',
          text: textToShare,
          url: window.location.href
        });
        return;
      } catch (err) {
        // Fallback se cancelado ou não suportado
      }
    }

    // Fallback WhatsApp
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}`;
    window.open(whatsappUrl, '_blank');
  }

  /**
   * Copia o resumo técnico para a área de transferência
   */
  async function copySummaryToClipboard() {
    const { calcResult, diagnostic } = recalculateAndRender();
    const textToShare = `⚡ LIGVOLT | LAUDO E MEMORIAL DE RECARGA DE VE\n` +
      `Diagnóstico: ${diagnostic.badge} - ${diagnostic.headline}\n` +
      `Instalação: ${diagnostic.summary}\n` +
      `Solução Recomendada: ${diagnostic.recommendedScenario === 'A' ? 'Cenário A (Subquadro QGBT-EV)' : 'Cenário B (Circuitos Diretos)'}\n` +
      `Link da ferramenta: ${window.location.href}`;

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

  return {
    state,
    initChecklistState,
    renderChargersList,
    renderChecklist,
    recalculateAndRender,
    openReportModal,
    closeReportModal,
    printReport,
    shareQuickSummary,
    copySummaryToClipboard,
    showToast
  };
}));
