/**
 * LIGVOLT - Gerador de Relatório Técnico Preliminar
 * Gera visualização em tela e formatação específica para Impressão e PDF
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LigvoltReport = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Constrói o HTML completo do relatório técnico preliminar
   */
  function buildReportHTML(calcResult, diagnostic, checklistResponses, metadata) {
    const meta = metadata || {};
    const clientName = meta.clientName || 'Cliente / Condomínio não identificado';
    const address = meta.address || 'Endereço não informado';
    const technician = meta.technician || 'Responsável Técnico não informado';
    const notes = meta.notes || '';
    const dateFormatted = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const { input, chargers, phaseSummary, scenarioA, scenarioB, comparison } = calcResult;

    // Diagnóstico
    let badgeBg = '#9DEC0F';
    let badgeColor = '#0E1116';
    if (diagnostic.state === 'NAO_APTO') {
      badgeBg = '#FF4D4D';
      badgeColor = '#FFFFFF';
    } else if (diagnostic.state === 'APTO_COM_ADEQUACOES') {
      badgeBg = '#FFD026';
      badgeColor = '#0E1116';
    } else if (diagnostic.state === 'INCOMPLETA') {
      badgeBg = '#8C93A0';
      badgeColor = '#FFFFFF';
    }

    // Lista de materiais estimados
    const materials = generateBillOfMaterials(calcResult);

    let html = `
    <div class="report-document" id="printableReport">
      <!-- CABEÇALHO DO RELATÓRIO -->
      <div class="report-header">
        <div class="report-brand">
          <div class="brand-logo">
            <span class="logo-symbol">⚡</span>
            <span class="logo-name">LIG<span class="logo-highlight">VOLT</span></span>
          </div>
          <span class="report-type-badge">RELATÓRIO TÉCNICO PRELIMINAR</span>
        </div>
        <div class="report-meta-header">
          <p><strong>Emissão:</strong> ${dateFormatted}</p>
          <p><strong>Normas de Referência:</strong> ABNT NBR 5410, ABNT NBR 17019, IEC 61851, CBMERJ 326/2025</p>
        </div>
      </div>

      <!-- DADOS DA INSTALAÇÃO -->
      <div class="report-section">
        <h3 class="section-title">1. Identificação da Instalação e Responsabilidade</h3>
        <table class="report-table">
          <tr>
            <td style="width: 25%"><strong>Cliente / Edificação:</strong></td>
            <td style="width: 45%">${escapeHtml(clientName)}</td>
            <td style="width: 15%"><strong>Data:</strong></td>
            <td style="width: 15%">${dateFormatted.split(' ')[0]}</td>
          </tr>
          <tr>
            <td><strong>Endereço / Local:</strong></td>
            <td colspan="3">${escapeHtml(address)}</td>
          </tr>
          <tr>
            <td><strong>Avaliador / Técnico:</strong></td>
            <td colspan="3">${escapeHtml(technician)}</td>
          </tr>
          ${notes ? `<tr><td><strong>Observações:</strong></td><td colspan="3">${escapeHtml(notes)}</td></tr>` : ''}
        </table>
      </div>

      <!-- DIAGNÓSTICO DE VIABILIDADE CONSOLIDADO -->
      <div class="report-section">
        <h3 class="section-title">2. Diagnóstico de Viabilidade Técnica</h3>
        <div class="report-diag-box" style="border-left: 6px solid ${badgeBg};">
          <div class="report-diag-header">
            <span class="report-diag-badge" style="background: ${badgeBg}; color: ${badgeColor};">
              ${diagnostic.badge}
            </span>
            <span class="report-diag-headline">${diagnostic.headline}</span>
          </div>
          <p class="report-diag-summary">${diagnostic.summary}</p>
        </div>
      </div>

      <!-- PROBLEMAS E ADEQUAÇÕES -->
      <div class="report-section">
        <h3 class="section-title">3. Parecer Técnico e Adequações Prioritárias</h3>
        
        ${diagnostic.identifiedIssues.length > 0 ? `
          <div class="issues-box">
            <h4 class="sub-title">Pontos de Atenção / Inconformidades Identificadas:</h4>
            <ul class="report-list">
              ${diagnostic.identifiedIssues.map(iss => `<li>⚠️ ${escapeHtml(iss)}</li>`).join('')}
            </ul>
          </div>
        ` : '<p class="text-success">Nenhuma não conformidade ou sobrecarga detectada nos parâmetros informados.</p>'}

        ${diagnostic.requiredAdaptations.length > 0 ? `
          <div class="adaptations-box" style="margin-top: 15px;">
            <h4 class="sub-title">Plano de Adequações Necessárias (Ordem de Prioridade):</h4>
            <ol class="report-ordered-list">
              ${diagnostic.requiredAdaptations.map(ad => `
                <li>
                  <span class="priority-tag priority-${ad.priority}">Prioridade ${ad.priority}</span>
                  ${escapeHtml(ad.action)}
                </li>
              `).join('')}
            </ol>
          </div>
        ` : ''}

        ${diagnostic.pendingVerifications.length > 0 ? `
          <div class="pending-box" style="margin-top: 15px;">
            <h4 class="sub-title">Pendências e Vistorias em Campo Obrigatórias:</h4>
            <ul class="report-list">
              ${diagnostic.pendingVerifications.map(p => `<li>🔍 ${escapeHtml(p)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <!-- DADOS INFORMADOS E PARÂMETROS ELÉTRICOS -->
      <div class="report-section">
        <h3 class="section-title">4. Parâmetros de Entrada e Condições de Instalação</h3>
        <table class="report-table">
          <tr>
            <td><strong>Distância do Quadro:</strong></td>
            <td>${input.distance} metros</td>
            <td><strong>Tipo de Alimentação:</strong></td>
            <td>${formatSupplyType(input.supplyType)} (${input.voltageV.label})</td>
          </tr>
          <tr>
            <td><strong>Disjuntor Geral Existente:</strong></td>
            <td>${input.mainBreaker ? `${input.mainBreaker} A` : 'Pendente de verificação'}</td>
            <td><strong>Método de Instalação:</strong></td>
            <td>Método ${input.installMethod} (${formatMethod(input.installMethod)})</td>
          </tr>
          <tr>
            <td><strong>Isolação dos Cabos:</strong></td>
            <td>${input.cableInsulation} (Temp. máx: ${input.cableInsulation === 'XLPE' ? '90°C' : '70°C'})</td>
            <td><strong>Temperatura Ambiente:</strong></td>
            <td>${input.ambientTemp}°C (Fator temp: ${input.fTemp.toFixed(2)})</td>
          </tr>
          <tr>
            <td><strong>Circuitos Agrupados:</strong></td>
            <td>${input.grouping} circuito(s) (Fator agrupamento: ${input.fGroup.toFixed(2)})</td>
            <td><strong>Critério Operação Contínua:</strong></td>
            <td>Margem de ${((input.continuousMargin - 1) * 100).toFixed(0)}% (Fator ${input.continuousMargin})</td>
          </tr>
        </table>
      </div>

      <!-- CARREGADORES E BALANÇO DE FASES -->
      <div class="report-section">
        <h3 class="section-title">5. Carregadores Dimensionados e Balanço de Fases</h3>
        <table class="report-table" style="margin-bottom: 12px;">
          <thead>
            <tr>
              <th>Ponto de Recarga</th>
              <th>Configuração</th>
              <th>Corrente Nom.</th>
              <th>Corrente Proj. (125%)</th>
              <th>Potência</th>
              <th>Cabo de Fase</th>
              <th>Cabo PE</th>
              <th>Disjuntor Dedicado</th>
              <th>Queda Tens. (%)</th>
            </tr>
          </thead>
          <tbody>
            ${chargers.map(ch => `
              <tr>
                <td><strong>${escapeHtml(ch.name)}</strong></td>
                <td>${ch.phaseConfig}</td>
                <td>${ch.nominalCurrent} A</td>
                <td>${ch.projectCurrent} A</td>
                <td>${ch.powerKW} kW</td>
                <td>${ch.cableSection} mm²</td>
                <td>${ch.peSection} mm²</td>
                <td>${ch.recommendedBreaker} A</td>
                <td>${ch.voltageDropPercent}% (${ch.voltageDropVolts}V)</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Balanço de Fases -->
        <h4 class="sub-title">Distribuição de Cargas por Fase no Quadro Geral:</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>Fase</th>
              <th>Demanda Existente (A)</th>
              <th>Demanda Recarga Projeto (A)</th>
              <th>Demanda Total Combinada (A)</th>
              <th>Limite do Disjuntor Geral</th>
              <th>Status da Fase</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Fase A (L1)</strong></td>
              <td>${phaseSummary.phases.A.existing} A</td>
              <td>${phaseSummary.phases.A.evProject} A</td>
              <td><strong>${phaseSummary.phases.A.totalProject} A</strong></td>
              <td>${input.mainBreaker ? `${input.mainBreaker} A` : 'Pendente'}</td>
              <td>${getPhaseStatusBadge(phaseSummary.phases.A.totalProject, input.mainBreaker)}</td>
            </tr>
            ${input.supplyType !== 'monofasica' ? `
            <tr>
              <td><strong>Fase B (L2)</strong></td>
              <td>${phaseSummary.phases.B.existing} A</td>
              <td>${phaseSummary.phases.B.evProject} A</td>
              <td><strong>${phaseSummary.phases.B.totalProject} A</strong></td>
              <td>${input.mainBreaker ? `${input.mainBreaker} A` : 'Pendente'}</td>
              <td>${getPhaseStatusBadge(phaseSummary.phases.B.totalProject, input.mainBreaker)}</td>
            </tr>` : ''}
            ${input.supplyType === 'trifasica' ? `
            <tr>
              <td><strong>Fase C (L3)</strong></td>
              <td>${phaseSummary.phases.C.existing} A</td>
              <td>${phaseSummary.phases.C.evProject} A</td>
              <td><strong>${phaseSummary.phases.C.totalProject} A</strong></td>
              <td>${input.mainBreaker ? `${input.mainBreaker} A` : 'Pendente'}</td>
              <td>${getPhaseStatusBadge(phaseSummary.phases.C.totalProject, input.mainBreaker)}</td>
            </tr>` : ''}
          </tbody>
        </table>
        ${input.supplyType === 'trifasica' ? `
          <p class="phase-unbalance-note">
            <strong>Desbalanceamento entre Fases:</strong> ${phaseSummary.unbalancePercent}% 
            ${phaseSummary.unbalancePercent > 20 ? '(Atenção: superior a 20%, recomenda-se balancear)' : '(Dentro dos limites aceitáveis)'}
          </p>
        ` : ''}
      </div>

      <!-- COMPARATIVO CENÁRIO A vs CENÁRIO B -->
      <div class="report-section">
        <h3 class="section-title">6. Comparativo de Topologias de Alimentação</h3>
        
        <div class="recommendation-callout">
          <strong>Topologia Recomendada pelo Sistema:</strong> 
          <span class="scenario-pill">${comparison.recommendedScenario === 'A' ? 'Cenário A (Alimentador Único + Subquadro QGBT-EV)' : 'Cenário B (Circuitos Independentes Diretos)'}</span>
          <p class="scenario-rationale">${comparison.rationale}</p>
        </div>

        <table class="report-table" style="margin-top: 15px;">
          <thead>
            <tr>
              <th>Parâmetro</th>
              <th>Cenário A: Subquadro QGBT-EV</th>
              <th>Cenário B: Circuitos Independentes Diretos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Condutor Principal no Trajeto Longo</strong></td>
              <td>${scenarioA.cableDescription}</td>
              <td>${chargers.length} circuitos independentes paralelos</td>
            </tr>
            <tr>
              <td><strong>Disjuntor de Alimentação Geral</strong></td>
              <td>${scenarioA.breakerRating} A (${scenarioA.breakerPoles})</td>
              <td>${chargers.length} disjuntores dedicados no quadro geral</td>
            </tr>
            <tr>
              <td><strong>Queda de Tensão no Trecho Longo</strong></td>
              <td>${scenarioA.voltageDropPercent}% (no alimentador)</td>
              <td>Entre ${Math.min(...chargers.map(c => c.voltageDropPercent))}% e ${Math.max(...chargers.map(c => c.voltageDropPercent))}%</td>
            </tr>
            <tr>
              <td><strong>Ocupação de Tubulações / Eletrocalhas</strong></td>
              <td>Otimizada (1 único cabo alimentador)</td>
              <td>Elevada (${chargers.length} cabos longos paralelos)</td>
            </tr>
            <tr>
              <td><strong>Proteções Locais e Manobra</strong></td>
              <td>Centralizadas no Subquadro junto às vagas</td>
              <td>No quadro geral distante</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- LISTA DE COMPONENTES ESTIMADOS -->
      <div class="report-section">
        <h3 class="section-title">7. Lista Estimada de Materiais e Componentes</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Especificação Técnica Normativa</th>
              <th>Qtd Estimada</th>
              <th>Aplicação</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map((m, idx) => `
              <tr>
                <td>${idx + 1}. ${escapeHtml(m.name)}</td>
                <td>${escapeHtml(m.spec)}</td>
                <td><strong>${m.qty}</strong></td>
                <td>${escapeHtml(m.application)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- RESUMO DO CHECKLIST DE SEGURANÇA -->
      <div class="report-section">
        <h3 class="section-title">8. Resumo da Vistoria de Segurança e Conformidade</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Item Normativo</th>
              <th>Classificação</th>
              <th>Status Avaliado</th>
              <th>Referência Técnica</th>
            </tr>
          </thead>
          <tbody>
            ${LigvoltCompliance.CHECKLIST_ITEMS.map(item => {
              const val = checklistResponses[item.id] || item.defaultStatus || 'nao_verificado';
              return `
                <tr>
                  <td><strong>${escapeHtml(item.title)}</strong></td>
                  <td>${item.classification}</td>
                  <td>${formatChecklistBadge(val)}</td>
                  <td><small>${item.normativeRef}</small></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- NOTAS NORMATIVAS E DISCLAIMER LEGAL -->
      <div class="report-section report-disclaimer-box">
        <h4 style="margin-top: 0; color: #1a1d24;">⚠️ Aviso Legal e Restrições Técnicas</h4>
        <p>
          Este documento constitui um <strong>relatório de pré-dimensionamento e triagem técnica preliminar</strong> baseado nos dados fornecidos pelo usuário e nas diretrizes das normas técnicas ABNT NBR 5410 (Instalações Elétricas em Baixa Tensão), ABNT NBR 17019 (Instalações Elétricas em Locais Especiais - Alimentação de Veículos Elétricos), IEC 61851 e Nota CHEMG 326/2025 do CBMERJ.
        </p>
        <p>
          <strong>Este estudo preliminar não substitui nem dispensa:</strong>
        </p>
        <ol>
          <li>A elaboração de Projeto Elétrico Executivo detalhado por Engenheiro Eletricista devidamente registrado no CREA com emissão de ART.</li>
          <li>Vistoria técnica presencial com medição real de grandezas elétricas (tensão, corrente, impedância de loop de aterramento).</li>
          <li>Consulta formal e eventual solicitação de aumento de carga junto à concessionária de distribuição de energia elétrica local.</li>
          <li>Aprovação junto ao Corpo de Bombeiros Militar quando exigido pelas características da edificação.</li>
        </ol>
      </div>

      <!-- ASSINATURAS -->
      <div class="report-signatures">
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>Engenheiro Eletricista / Responsável Técnico</strong></p>
          <p>CREA / Reg.: __________________________</p>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>Cliente / Representante Legal</strong></p>
          <p>Condomínio / Edificação</p>
        </div>
      </div>
    </div>
    `;

    return html;
  }

  /**
   * Gera a lista estimada de componentes (BOM)
   */
  function generateBillOfMaterials(calcResult) {
    const { input, chargers, scenarioA, scenarioB, comparison } = calcResult;
    const items = [];

    if (comparison.recommendedScenario === 'A') {
      items.push({
        name: 'Cabo Alimentador de Fase e Neutro',
        spec: `Cabo de Cobre ${input.cableInsulation} 0,6/1kV seção ${scenarioA.cableSection} mm²`,
        qty: `${Math.round(scenarioA.estimatedCableRunMeters * (input.supplyType === 'trifasica' ? 4 : 2))} m`,
        application: 'Alimentação do Quadro Secundário QGBT-EV'
      });
      items.push({
        name: 'Condutor de Proteção (PE - Terra)',
        spec: `Cabo de Cobre ${input.cableInsulation} Verde/Amarelo seção ${scenarioA.peSection} mm²`,
        qty: `${Math.round(scenarioA.estimatedCableRunMeters)} m`,
        application: 'Continuidade de aterramento até o QGBT-EV'
      });
      items.push({
        name: 'Disjuntor Termomagnético Geral do Alimentador',
        spec: `Disjuntor ${scenarioA.breakerRating}A, Curva C, Icu >= 10kA (${scenarioA.breakerPoles})`,
        qty: '1 un',
        application: 'Instalado no Quadro Geral (QGBT) existente'
      });
      items.push({
        name: 'Quadro de Distribuição Secundário (QGBT-EV)',
        spec: `Invólucro metálico ou termoplástico IP54/65 com barramentos de cobre e trilhos DIN`,
        qty: '1 un',
        application: 'Acomodação das proteções locais junto às vagas de recarga'
      });
      items.push({
        name: 'Conjunto DPS Classe II',
        spec: `DPS Classe II, In >= 20kA, Imax >= 40kA, Uc 275V com sinalização de status`,
        qty: input.supplyType === 'trifasica' ? '4 un (3F+N)' : '2 un',
        application: 'Proteção contra surtos atmosféricos no QGBT-EV'
      });
      items.push({
        name: 'Disjuntores Termomagnéticos dos Carregadores',
        spec: chargers.map(c => `${c.name}: ${c.recommendedBreaker}A (${c.breakerPoles})`).join('; '),
        qty: `${chargers.length} un`,
        application: 'Proteção de sobrecorrente individual por carregador no QGBT-EV'
      });
      items.push({
        name: 'Interruptores DR de Alta Sensibilidade',
        spec: 'DR 30mA Tipo A com proteção contra fuga CC de 6mA (RDC-DD) ou Tipo B',
        qty: `${chargers.length} un`,
        application: 'Proteção diferencial individual obrigatória (NBR 17019)'
      });
      items.push({
        name: 'Botão de Desligamento de Emergência',
        spec: 'Botão de parada de emergência cogumelo tipo gira-para-destravar com contato NF',
        qty: '1 un',
        application: 'Desenergização rápida dos carregadores em caso de sinistro'
      });
    } else {
      // Cenário B
      chargers.forEach(c => {
        items.push({
          name: `Cabo de Alimentação - ${c.name}`,
          spec: `Cabo de Cobre ${input.cableInsulation} 0,6/1kV ${c.cableConductorsText}`,
          qty: `${Math.round(input.distance * (c.isThreePhase ? 5 : 3))} m`,
          application: `Alimentação direta desde o quadro geral até o ${c.name}`
        });
        items.push({
          name: `Disjuntor Dedicado - ${c.name}`,
          spec: `Disjuntor ${c.recommendedBreaker}A, Curva C (${c.breakerPoles})`,
          qty: '1 un',
          application: `Instalação no quadro geral existente`
        });
        items.push({
          name: `Interruptor DR Dedicado - ${c.name}`,
          spec: 'DR 30mA Tipo A (compatível RDC-DD 6mA) ou Tipo B',
          qty: '1 un',
          application: `Instalação no quadro geral existente para o ${c.name}`
        });
      });
      items.push({
        name: 'Conjunto DPS Classe II',
        spec: 'DPS Classe II 20kA/40kA se não houver proteção coordenada no quadro geral',
        qty: '1 kit',
        application: 'Quadro Geral'
      });
    }

    items.push({
      name: 'Infraestrutura de Eletrodutos / Eletrocalhas',
      spec: input.installMethod === 'F' ? 'Eletrocalha perfurada galvanizada com septo divisor' : 'Eletroduto rígido de aço galvanizado ou PVC antichama reforçado',
      qty: `${Math.round(input.distance)} m`,
      application: 'Proteção mecânica dos condutores no trajeto'
    });
    items.push({
      name: 'Balizadores / Proteção Mecânica de Vagas',
      spec: 'Batentes de solo emborrachados ou tubos de aço de proteção contra impacto de manobra',
      qty: `${chargers.length} conj`,
      application: 'Proteção física dos carregadores'
    });

    return items;
  }

  function formatSupplyType(type) {
    if (type === 'monofasica') return 'Monofásica (F+N)';
    if (type === 'bifasica') return 'Bifásica (2F ou 2F+N)';
    return 'Trifásica (3F+N)';
  }

  function formatMethod(method) {
    if (method === 'B1') return 'Eletroduto embutido em alvenaria ou aparente sobre parede';
    if (method === 'B2') return 'Cabo multipolar em eletroduto sobre parede';
    if (method === 'C') return 'Cabos fixados diretamente em parede';
    if (method === 'F') return 'Bandeja perfurada / Eletrocalha ao ar livre';
    return method;
  }

  function getPhaseStatusBadge(current, mainBreaker) {
    if (!mainBreaker) {
      return '<span class="status-pill status-gray">Pendente de Verificação</span>';
    }
    if (current > mainBreaker) {
      return `<span class="status-pill status-red">SOBRECARGA (+${(current - mainBreaker).toFixed(1)}A)</span>`;
    }
    const margin = (mainBreaker - current).toFixed(1);
    return `<span class="status-pill status-green">OK (${margin}A livre)</span>`;
  }

  function formatChecklistBadge(status) {
    if (status === 'adequado') {
      return '<span class="status-pill status-green">✓ Adequado</span>';
    }
    if (status === 'inadequado') {
      return '<span class="status-pill status-red">✗ Inadequado</span>';
    }
    if (status === 'nao_aplicavel') {
      return '<span class="status-pill status-gray">N/A</span>';
    }
    return '<span class="status-pill status-yellow">? Não Verificado</span>';
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
    buildReportHTML,
    generateBillOfMaterials
  };
}));
