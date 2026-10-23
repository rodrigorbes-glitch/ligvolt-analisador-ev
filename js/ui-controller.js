/**
 * LIGVOLT - Controlador de Interface do Usuário (UI Controller) - Redesign Light Mode SaaS
 * Gerencia inputs, reatividade, renderização do checklist agrupado, cenários e laudos
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
    activeDocType: 'relatorio',
    showAdaptations: false,
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

      // Estima potência ativa do carregador
      let voltage = state.voltagePreset === '127_220' ? (ch.phaseConfig === '3F' || ch.phaseConfig.includes('-L') ? 220 : 127) : (ch.phaseConfig === '3F' ? 380 : (ch.phaseConfig.includes('-L') ? 380 : 220));
      let pKw = ch.phaseConfig === '3F' 
        ? ((Math.sqrt(3) * voltage * ch.nominalCurrent * 0.99) / 1000).toFixed(1)
        : ((voltage * ch.nominalCurrent * 0.99) / 1000).toFixed(1);

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
    renderSizingResults(calcResult);
    renderScenariosComparison(calcResult);

    return { calcResult, diagnostic };
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
   * Renderiza os resultados de dimensionamento elétrico
   */
  function renderSizingResults(calcResult) {
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

    const { chargers, phaseSummary, input } = calcResult;
    const phaseBarsHtml = renderPhaseLoadMeters(phaseSummary, input.mainBreaker, input.supplyType);

    summaryContainer.innerHTML = `
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
   * Renderiza a comparação entre Cenário A e Cenário B (Dois Cartões Comparativos Limpos)
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
                <td>${scenarioA.cableDescription}</td>
              </tr>
              <tr>
                <td>Disjuntor Geral QGBT:</td>
                <td>${scenarioA.breakerRating}A (${scenarioA.breakerPoles})</td>
              </tr>
              <tr>
                <td>Queda de Tensão:</td>
                <td>${scenarioA.voltageDropPercent}% (no alimentador)</td>
              </tr>
              <tr>
                <td>Condutor Proteção (PE):</td>
                <td>${scenarioA.peSection} mm²</td>
              </tr>
              <tr>
                <td>Proteções dos Carregadores:</td>
                <td>Disjuntores + DRs 30mA locais no subquadro</td>
              </tr>
            </table>
          </div>

          <div>
            <button type="button" class="scenario-details-btn" data-action="toggle-scenario-drawer" data-target="drawerA">
              Ver Detalhes do Cenário A ▼
            </button>
            <div class="scenario-drawer" id="drawerA">
              <p><strong>Vantagens Técnicas:</strong></p>
              <ul style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                ${comparison.scenarioAAdvantages.map(adv => `<li>${adv}</li>`).join('')}
              </ul>
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
                <td>${scenarioB.chargersCount} cabos dedicados em paralelo</td>
              </tr>
              <tr>
                <td>Disjuntores:</td>
                <td>${chargers.map(c => `${c.recommendedBreaker}A`).join(', ')} (no quadro geral)</td>
              </tr>
              <tr>
                <td>Queda de Tensão Média:</td>
                <td>${(chargers.reduce((acc, c) => acc + c.voltageDropPercent, 0) / chargers.length).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Fator de Agrupamento:</td>
                <td>${input.fGroup.toFixed(2)} (gera derating térmico)</td>
              </tr>
              <tr>
                <td>Local das Proteções:</td>
                <td>Instalados no quadro principal distante</td>
              </tr>
            </table>
          </div>

          <div>
            <button type="button" class="scenario-details-btn" data-action="toggle-scenario-drawer" data-target="drawerB">
              Ver Detalhes do Cenário B ▼
            </button>
            <div class="scenario-drawer" id="drawerB">
              <p><strong>Vantagens Técnicas:</strong></p>
              <ul style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                ${comparison.scenarioBAdvantages.map(adv => `<li>${adv}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind dos botões de gaveta de detalhes
    container.querySelectorAll('[data-action="toggle-scenario-drawer"]').forEach(btn => {
      btn.addEventListener('click', function () {
        const targetId = this.dataset.target;
        const drawer = document.getElementById(targetId);
        if (drawer) {
          const isOpen = drawer.classList.toggle('is-open');
          this.textContent = isOpen ? 'Ocultar Detalhes ▲' : (targetId === 'drawerA' ? 'Ver Detalhes do Cenário A ▼' : 'Ver Detalhes do Cenário B ▼');
        }
      });
    });
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

    if (state.activeDocType === 'relatorio') {
      content.innerHTML = Report.buildReportHTML(calcResult, diagnostic, state.checklistResponses, state.reportMetadata);
    } else if (state.activeDocType === 'laudo') {
      content.innerHTML = Dossier.buildTechnicalOpinion(calcResult, diagnostic, state.checklistResponses, state.reportMetadata);
    } else if (state.activeDocType === 'memoria') {
      content.innerHTML = Dossier.buildCalculationMemory(calcResult, state.reportMetadata);
    } else if (state.activeDocType === 'concessionaria') {
      content.innerHTML = Dossier.buildConcessionaireRequest(calcResult, state.reportMetadata);
    } else if (state.activeDocType === 'dossie') {
      content.innerHTML = `
        ${Report.buildReportHTML(calcResult, diagnostic, state.checklistResponses, state.reportMetadata)}
        <div style="page-break-before: always; margin-top: 30px; border-top: 2px dashed #94A3B8; padding-top: 20px;"></div>
        ${Dossier.buildTechnicalOpinion(calcResult, diagnostic, state.checklistResponses, state.reportMetadata)}
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
