/**
 * LIGVOLT - Gerador de Laudo Técnico, Memória de Cálculo e Documentação para Concessionária
 * Atende requisitos de homologação e pedido de aumento de carga
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LigvoltDossier = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Constrói o Laudo Técnico Pericial de Engenharia
   */
  function buildTechnicalOpinion(calcResult, diagnostic, checklistResponses, meta) {
    const dateFormatted = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const client = meta.clientName || 'Cliente / Condomínio não identificado';
    const address = meta.address || 'Endereço não informado';
    const technician = meta.technician || 'Engenheiro Eletricista Responsável';
    const crea = meta.crea || 'CREA-XX 000000/D';
    const art = meta.art || 'ART nº 2026/00000000 (Pendente de emissão)';
    const concessionaria = meta.concessionaria || 'Concessionária Local de Energia';
    const ucNumber = meta.ucNumber || 'Nº da Unidade Consumidora (UC) não informado';

    const { input, chargers, phaseSummary, comparison } = calcResult;

    return `
    <div class="dossier-document" id="printableTechnicalOpinion">
      <div class="report-header">
        <div class="report-brand">
          <div class="brand-logo">
            <span class="logo-symbol">⚡</span>
            <span class="logo-name">LIG<span class="logo-highlight">VOLT</span></span>
          </div>
          <span class="report-type-badge">LAUDO TÉCNICO DE ENGENHARIA ELÉTRICA</span>
        </div>
        <div class="report-meta-header">
          <p><strong>Emissão:</strong> ${dateFormatted}</p>
          <p><strong>Ref. Normativa:</strong> ABNT NBR 5410, NBR 17019, IEC 61851, CBMERJ 326/2025</p>
        </div>
      </div>

      <div class="report-section">
        <h3 class="section-title">1. Identificação Geral e Dados Cadastrais</h3>
        <table class="report-table">
          <tr>
            <td style="width: 25%"><strong>Unidade Consumidora (UC):</strong></td>
            <td style="width: 40%"><strong>${escapeHtml(ucNumber)}</strong></td>
            <td style="width: 15%"><strong>Concessionária:</strong></td>
            <td style="width: 20%">${escapeHtml(concessionaria)}</td>
          </tr>
          <tr>
            <td><strong>Cliente / Edificação:</strong></td>
            <td>${escapeHtml(client)}</td>
            <td><strong>Data do Laudo:</strong></td>
            <td>${dateFormatted.split(' ')[0]}</td>
          </tr>
          <tr>
            <td><strong>Endereço da Instalação:</strong></td>
            <td colspan="3">${escapeHtml(address)}</td>
          </tr>
          <tr>
            <td><strong>Responsável Técnico:</strong></td>
            <td>${escapeHtml(technician)}</td>
            <td><strong>Registro / ART:</strong></td>
            <td>${escapeHtml(crea)} | ${escapeHtml(art)}</td>
          </tr>
        </table>
      </div>

      <div class="report-section">
        <h3 class="section-title">2. Objeto e Finalidade da Perícia</h3>
        <p style="margin-bottom: 8px;">
          O presente Laudo Técnico tem por objetivo atestar formalmente a viabilidade técnica, os riscos eletrotermomecânicos e as condicionantes normativas para a implantação de <strong>${chargers.length} ponto(s) de recarga de veículos elétricos (VE)</strong> nas dependências da edificação supracitada, considerando os limites operacionais da infraestrutura predial existente e do padrão de entrada junto à concessionária de energia.
        </p>
      </div>

      <div class="report-section">
        <h3 class="section-title">3. Parecer Conclusivo de Viabilidade</h3>
        <div class="report-diag-box" style="border-left: 6px solid ${getBadgeColor(diagnostic.state)};">
          <div class="report-diag-header">
            <span class="report-diag-badge" style="background: ${getBadgeColor(diagnostic.state)}; color: ${diagnostic.state === 'NAO_APTO' ? '#fff' : '#0E1116'};">
              ${diagnostic.badge}
            </span>
            <span class="report-diag-headline">${diagnostic.headline}</span>
          </div>
          <p class="report-diag-summary">${diagnostic.summary}</p>
        </div>
      </div>

      <div class="report-section">
        <h3 class="section-title">4. Fundamentação Técnica e Riscos Inerentes</h3>
        <p>A recarga de veículos elétricos constitui carga especial contínua de elevada potência e longa duração (superior a 3 a 8 horas contínuas sob regime nominal). Diante disto, foram avaliados:</p>
        <ul class="report-list" style="margin-top: 8px;">
          <li><strong>Capacidade Residual da Entrada:</strong> Carga existente de ${formatPhasesSummary(phaseSummary.phases)} somada à carga de projeto dos carregadores (${phaseSummary.maxEvPhase}A na fase mais solicitada). Disjuntor geral da edificação: ${input.mainBreaker ? `${input.mainBreaker}A` : 'Pendente de verificação presencial'}.</li>
          <li><strong>Coordenação de Proteção contra Sobrecarga:</strong> Previsão de disjuntores em coordenação térmica com a ampacidade corrigida dos condutores ($I_B \\le I_n \\le I_z$), impedindo degradação da isolação por aquecimento prolongado.</li>
          <li><strong>Proteção Contra Choques Elétricos e Correntes Contínuas:</strong> Exigência compulsória de Interruptor Diferencial Residual (DR) 30mA Tipo A associado a dispositivo de detecção CC de 6mA (RDC-DD conforme IEC 62955) ou DR Tipo B individualizado por carregador, em virtude de componentes de corrente contínua que saturam o núcleo magnético de DRs comuns do Tipo AC.</li>
          <li><strong>Diretriz do CBMERJ (Nota CHEMG 326/2025):</strong> Vistoria de localização contra sinistros em garagens fechadas ou subsolos, com verificação de rotas de fuga, desobstrução e presença de chuveiros automáticos (sprinklers).</li>
        </ul>
      </div>

      <div class="report-section">
        <h3 class="section-title">5. Prescrições Obrigatórias de Execução</h3>
        <ol class="report-ordered-list">
          ${diagnostic.requiredAdaptations.map(ad => `
            <li>
              <span class="priority-tag priority-${ad.priority}">Prioridade ${ad.priority}</span>
              ${escapeHtml(ad.action)}
            </li>
          `).join('')}
        </ol>
      </div>

      <div class="report-signatures">
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>${escapeHtml(technician)}</strong></p>
          <p>Engenheiro Eletricista Responsável</p>
          <p>${escapeHtml(crea)}</p>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>${escapeHtml(client)}</strong></p>
          <p>Representante Legal / Síndico(a)</p>
          <p>Ciente das condicionantes do laudo</p>
        </div>
      </div>
    </div>
    `;
  }

  /**
   * Constrói a Memória de Cálculo Elétrica Completa e Passo a Passo
   */
  function buildCalculationMemory(calcResult, meta) {
    const { input, chargers, phaseSummary, scenarioA, scenarioB, comparison } = calcResult;
    const dateFormatted = new Date().toLocaleDateString('pt-BR');

    return `
    <div class="dossier-document" id="printableCalculationMemory">
      <div class="report-header">
        <div class="report-brand">
          <div class="brand-logo">
            <span class="logo-symbol">⚡</span>
            <span class="logo-name">LIG<span class="logo-highlight">VOLT</span></span>
          </div>
          <span class="report-type-badge">MEMÓRIA DE CÁLCULO ELÉTRICO NORMATIVO</span>
        </div>
        <div class="report-meta-header">
          <p><strong>Data:</strong> ${dateFormatted}</p>
          <p><strong>Base Normativa:</strong> ABNT NBR 5410:2004 / NBR 17019:2022</p>
        </div>
      </div>

      <div class="report-section">
        <h3 class="section-title">1. Dados e Fórmulas de Projeto Adotadas</h3>
        <p style="margin-bottom: 8px;">O dimensionamento elétrico foi desenvolvido aplicando simultaneamente os critérios da <strong>Capacidade de Condução de Corrente (Ampacidade)</strong>, da <strong>Queda de Tensão Admissível</strong> e da <strong>Coordenação com os Dispositivos de Proteção</strong>.</p>
        
        <table class="report-table">
          <tr>
            <td><strong>Material Condutor:</strong> Cobre eletrolítico padrão ABNT</td>
            <td><strong>Resistividade:</strong> $\\rho_{${input.cableInsulation}} = ${input.cableInsulation === 'XLPE' ? '0,0230' : '0,0215'}\\,\\Omega\\cdot\\text{mm}^2/\\text{m}$</td>
          </tr>
          <tr>
            <td><strong>Isolação do Cabo:</strong> ${input.cableInsulation} (${input.cableInsulation === 'XLPE' ? '90°C' : '70°C'})</td>
            <td><strong>Reatância Média ($x$):</strong> $0,00008\\,\\Omega/\\text{m}$ ($0,08\\,\\text{m}\\Omega/\\text{m}$)</td>
          </tr>
          <tr>
            <td><strong>Método de Instalação:</strong> Método ${input.installMethod}</td>
            <td><strong>Fator de Potência (cos $\\varphi$):</strong> 0,99 (PFC ativo de recarga de VE)</td>
          </tr>
          <tr>
            <td><strong>Fator de Correção Térmica ($F_t$):</strong> ${input.fTemp.toFixed(2)} (${input.ambientTemp}°C)</td>
            <td><strong>Fator de Agrupamento ($F_a$):</strong> ${input.fGroup.toFixed(2)} (${input.grouping} circuito(s))</td>
          </tr>
          <tr>
            <td><strong>Fator de Correção Total ($F_{corr}$):</strong> $F_t \\times F_a = ${(input.fTemp * input.fGroup).toFixed(2)}</td>
            <td><strong>Critério Carga Contínua:</strong> Fator ${input.continuousMargin} (${((input.continuousMargin - 1) * 100).toFixed(0)}% de margem)</td>
          </tr>
        </table>
      </div>

      <div class="report-section">
        <h3 class="section-title">2. Equações Normativas Empregadas</h3>
        <div class="math-box" style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
          <p><strong>1. Corrente de Projeto ($I_B$):</strong> $I_B = I_{nom} \\times k_{cont}$, onde $k_{cont} = ${input.continuousMargin}$.</p>
          <p><strong>2. Corrente Corrigida Mínima do Condutor ($I_z'$):</strong> $I_z' \\ge \\frac{I_B}{F_t \\times F_a}$.</p>
          <p><strong>3. Queda de Tensão Monofásica / Bifásica ($\\Delta U$):</strong> $\\Delta U = 2 \\cdot I_B \\cdot L \\cdot \\left(\\frac{\\rho}{S} \\cos\\varphi + x \\sin\\varphi\\right)$.</p>
          <p><strong>4. Queda de Tensão Trifásica ($\\Delta U$):</strong> $\\Delta U = \\sqrt{3} \\cdot I_B \\cdot L \\cdot \\left(\\frac{\\rho}{S} \\cos\\varphi + x \\sin\\varphi\\right)$.</p>
          <p><strong>5. Queda de Tensão Percentual ($\\Delta U\\%$):</strong> $\\Delta U\\% = \\frac{\\Delta U}{V_{nominal}} \\times 100 \\le ${input.maxDropAllowed}\\%$.</p>
          <p><strong>6. Coordenação do Disjuntor:</strong> $I_B \\le I_n \\le I_z$ e $I_2 \\le 1,45 \\times I_z$.</p>
          <p><strong>7. Condutor de Proteção (PE - NBR 5410 Tab. 58):</strong> $S \\le 16 \\Rightarrow S_{PE} = S$; $16 < S \\le 35 \\Rightarrow S_{PE} = 16$; $S > 35 \\Rightarrow S_{PE} = S/2$.</p>
        </div>
      </div>

      <div class="report-section">
        <h3 class="section-title">3. Memorial de Cálculo Individualizado dos Pontos de Recarga</h3>
        ${chargers.map((ch, idx) => `
          <div style="margin-bottom: 14px; border: 1px solid #E2E8F0; padding: 12px; border-radius: 6px;">
            <h4 style="color: #0E1116; font-size: 13px; margin-bottom: 6px;">3.${idx + 1}. ${escapeHtml(ch.name)} (${ch.phaseConfig})</h4>
            <table class="report-table">
              <tr>
                <td><strong>Corrente Nominal ($I_{nom}$):</strong> ${ch.nominalCurrent} A</td>
                <td><strong>Corrente de Projeto ($I_B$):</strong> ${ch.projectCurrent} A (${ch.nominalCurrent}A x ${input.continuousMargin})</td>
              </tr>
              <tr>
                <td><strong>Ampacidade Requerida ($I_z'$):</strong> ${(ch.projectCurrent / (input.fTemp * input.fGroup)).toFixed(1)} A</td>
                <td><strong>Ampacidade do Cabo Escolhido ($I_z$):</strong> ${ch.correctedAmpacity} A (Base: ${ch.baseAmpacity}A)</td>
              </tr>
              <tr>
                <td><strong>Seção de Fase Dimensionada:</strong> <strong>${ch.cableSection} mm²</strong></td>
                <td><strong>Seção do Condutor PE:</strong> <strong>${ch.peSection} mm²</strong> (Tab. 58 NBR 5410)</td>
              </tr>
              <tr>
                <td><strong>Queda de Tensão Calculada:</strong> ${ch.voltageDropPercent}% (${ch.voltageDropVolts} V)</td>
                <td><strong>Limite Admissível de Queda:</strong> ${input.maxDropAllowed}% (${ch.voltageDropCompliant ? 'CONFORME' : 'NÃO CONFORME'})</td>
              </tr>
              <tr>
                <td><strong>Disjuntor Termomagnético ($I_n$):</strong> <strong>${ch.recommendedBreaker} A</strong> (${ch.breakerPoles})</td>
                <td><strong>Coordenação Verificada:</strong> ${ch.projectCurrent}A $\\le$ ${ch.recommendedBreaker}A $\\le$ ${ch.correctedAmpacity}A (OK)</td>
              </tr>
              <tr>
                <td colspan="2"><strong>Proteção Residual DR:</strong> ${ch.drSpec}</td>
              </tr>
            </table>
          </div>
        `).join('')}
      </div>

      <div class="report-section">
        <h3 class="section-title">4. Memorial do Alimentador Principal (Cenário A - QGBT-EV)</h3>
        <table class="report-table">
          <tr>
            <td><strong>Corrente de Projeto do Alimentador:</strong></td>
            <td><strong>${scenarioA.feederProjectCurrent} A</strong> (Pico na fase mais carregada)</td>
          </tr>
          <tr>
            <td><strong>Condutor Alimentador Recomendado:</strong></td>
            <td><strong>${scenarioA.cableDescription}</strong></td>
          </tr>
          <tr>
            <td><strong>Condutor de Proteção (PE):</strong></td>
            <td><strong>${scenarioA.peSection} mm²</strong> de cobre</td>
          </tr>
          <tr>
            <td><strong>Disjuntor no Quadro Geral:</strong></td>
            <td><strong>${scenarioA.breakerRating} A</strong> (${scenarioA.breakerPoles})</td>
          </tr>
          <tr>
            <td><strong>Queda de Tensão no Alimentador (${input.distance}m):</strong></td>
            <td><strong>${scenarioA.voltageDropPercent}%</strong> (Margem segura para quadros secundários)</td>
          </tr>
        </table>
      </div>
    </div>
    `;
  }

  /**
   * Constrói o Memorial Descritivo e Documentação para Pedido de Aumento de Carga e Homologação
   */
  function buildConcessionaireRequest(calcResult, meta) {
    const { input, chargers, phaseSummary } = calcResult;
    const dateFormatted = new Date().toLocaleDateString('pt-BR');
    const client = meta.clientName || 'Cliente / Condomínio';
    const address = meta.address || 'Endereço da Instalação';
    const concessionaria = meta.concessionaria || 'Concessionária Distribuidora Local';
    const ucNumber = meta.ucNumber || 'Nº da UC';
    const technician = meta.technician || 'Engenheiro Eletricista';
    const crea = meta.crea || 'CREA-XX 000000/D';
    const art = meta.art || 'ART nº 2026/00000000';

    // Potência total instalada dos carregadores
    const totalEvPowerKW = chargers.reduce((acc, c) => acc + c.powerKW, 0);
    const totalEvPowerKVA = (totalEvPowerKW / 0.99).toFixed(1);

    // Corrente máxima combinada por fase
    const maxPhaseTotal = phaseSummary.maxTotalPhase;
    const mainBreaker = input.mainBreaker || 100;
    const requiredBreaker = Math.max(mainBreaker, Math.ceil(maxPhaseTotal / 10) * 10);

    return `
    <div class="dossier-document" id="printableConcessionaireRequest">
      <div class="report-header">
        <div class="report-brand">
          <div class="brand-logo">
            <span class="logo-symbol">⚡</span>
            <span class="logo-name">LIG<span class="logo-highlight">VOLT</span></span>
          </div>
          <span class="report-type-badge">MEMORIAL DESCRITIVO PARA PEDIDO DE AUMENTO DE CARGA</span>
        </div>
        <div class="report-meta-header">
          <p><strong>Destinatário:</strong> ${escapeHtml(concessionaria)}</p>
          <p><strong>Data:</strong> ${dateFormatted}</p>
        </div>
      </div>

      <div class="report-section">
        <h3 class="section-title">1. Dados da Unidade Consumidora (UC) e Requerente</h3>
        <table class="report-table">
          <tr>
            <td style="width: 25%"><strong>Unidade Consumidora (UC):</strong></td>
            <td style="width: 40%"><strong>${escapeHtml(ucNumber)}</strong></td>
            <td style="width: 15%"><strong>Concessionária:</strong></td>
            <td style="width: 20%">${escapeHtml(concessionaria)}</td>
          </tr>
          <tr>
            <td><strong>Titular / Razão Social:</strong></td>
            <td>${escapeHtml(client)}</td>
            <td><strong>Data:</strong></td>
            <td>${dateFormatted}</td>
          </tr>
          <tr>
            <td><strong>Endereço da Ligação:</strong></td>
            <td colspan="3">${escapeHtml(address)}</td>
          </tr>
          <tr>
            <td><strong>Responsável Técnico:</strong></td>
            <td>${escapeHtml(technician)}</td>
            <td><strong>Registro CREA:</strong></td>
            <td>${escapeHtml(crea)}</td>
          </tr>
        </table>
      </div>

      <div class="report-section">
        <h3 class="section-title">2. Justificativa do Pedido de Aumento de Carga</h3>
        <p style="margin-bottom: 8px;">
          Vem pelo presente instrumento formalizar perante a concessionária distribuidora <strong>${escapeHtml(concessionaria)}</strong> a solicitação de estudo de viabilidade e <strong>Aumento de Carga / Adequação do Padrão de Entrada</strong> para atendimento à infraestrutura de alimentação de estações de recarga de veículos elétricos (VE), atendendo aos normativos da ABNT NBR 5410, NBR 17019 e Resoluções Normativas da ANEEL.
        </p>
      </div>

      <div class="report-section">
        <h3 class="section-title">3. Relação de Cargas e Balanço de Demanda</h3>
        <table class="report-table" style="margin-bottom: 12px;">
          <thead>
            <tr>
              <th>Discriminação da Carga</th>
              <th>Quantidade</th>
              <th>Potência Unitária (kW)</th>
              <th>Potência Total (kW)</th>
              <th>Demanda Estimada (kVA)</th>
            </tr>
          </thead>
          <tbody>
            ${chargers.map((ch, idx) => `
              <tr>
                <td>Estação de Recarga de VE - Ponto ${idx + 1} (${ch.phaseConfig})</td>
                <td>1 un</td>
                <td>${ch.powerKW} kW</td>
                <td>${ch.powerKW} kW</td>
                <td>${(ch.powerKW / 0.99).toFixed(1)} kVA</td>
              </tr>
            `).join('')}
            <tr style="background: #F1F5F9; font-weight: bold;">
              <td colspan="3">CARGA ADICIONAL TOTAL DE RECARGA DE VE</td>
              <td>${totalEvPowerKW.toFixed(1)} kW</td>
              <td>${totalEvPowerKVA} kVA</td>
            </tr>
          </tbody>
        </table>

        <h4 class="sub-title">Balanço de Correntes por Fase no Padrão de Entrada:</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>Fase</th>
              <th>Carga Existente Estimada</th>
              <th>Carga de Recarga de VE</th>
              <th>Demanda Total Solicitada</th>
              <th>Capacidade Atual</th>
              <th>Situação da Entrada</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Fase A (L1)</strong></td>
              <td>${phaseSummary.phases.A.existing} A</td>
              <td>${phaseSummary.phases.A.evProject} A</td>
              <td><strong>${phaseSummary.phases.A.totalProject} A</strong></td>
              <td>${mainBreaker} A</td>
              <td>${phaseSummary.phases.A.totalProject > mainBreaker ? '<span class="status-pill status-red">Exige Aumento de Carga</span>' : '<span class="status-pill status-green">Compatível</span>'}</td>
            </tr>
            ${input.supplyType !== 'monofasica' ? `
            <tr>
              <td><strong>Fase B (L2)</strong></td>
              <td>${phaseSummary.phases.B.existing} A</td>
              <td>${phaseSummary.phases.B.evProject} A</td>
              <td><strong>${phaseSummary.phases.B.totalProject} A</strong></td>
              <td>${mainBreaker} A</td>
              <td>${phaseSummary.phases.B.totalProject > mainBreaker ? '<span class="status-pill status-red">Exige Aumento de Carga</span>' : '<span class="status-pill status-green">Compatível</span>'}</td>
            </tr>` : ''}
            ${input.supplyType === 'trifasica' ? `
            <tr>
              <td><strong>Fase C (L3)</strong></td>
              <td>${phaseSummary.phases.C.existing} A</td>
              <td>${phaseSummary.phases.C.evProject} A</td>
              <td><strong>${phaseSummary.phases.C.totalProject} A</strong></td>
              <td>${mainBreaker} A</td>
              <td>${phaseSummary.phases.C.totalProject > mainBreaker ? '<span class="status-pill status-red">Exige Aumento de Carga</span>' : '<span class="status-pill status-green">Compatível</span>'}</td>
            </tr>` : ''}
          </tbody>
        </table>
      </div>

      <div class="report-section">
        <h3 class="section-title">4. Características Técnicas do Padrão Solicitado</h3>
        <table class="report-table">
          <tr>
            <td style="width: 35%"><strong>Tipo de Fornecimento Proposto:</strong></td>
            <td>Trifásico a 4 fios (3 Fases + Neutro) em ${input.voltageV.label}</td>
          </tr>
          <tr>
            <td><strong>Disjuntor Geral de Entrada Proposto:</strong></td>
            <td><strong>${requiredBreaker} A</strong> (Tripolar Caixa Moldada / DIN, com capacidade de interrupção compatível)</td>
          </tr>
          <tr>
            <td><strong>Ramal de Entrada da Distribuidora:</strong></td>
            <td>Condutores de cobre dimensionados para demanda de pico de no mínimo ${maxPhaseTotal}A contínuos</td>
          </tr>
          <tr>
            <td><strong>Aterramento do Padrão:</strong></td>
            <td>Interligação com o condutor PEN da rede no ponto de entrega e BEP (Esquema TN-C-S / TN-S)</td>
          </tr>
        </table>
      </div>

      <div class="report-section">
        <h3 class="section-title">5. Checklist de Documentos Anexos para a Distribuidora</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Documento Exigido</th>
              <th>Status</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. Formulário de Solicitação de Fornecimento / Aumento de Carga assinado</td>
              <td><span class="status-pill status-green">Anexo</span></td>
              <td>Formulário padrão da ${escapeHtml(concessionaria)}</td>
            </tr>
            <tr>
              <td>2. Cópia da última fatura de energia elétrica da UC</td>
              <td><span class="status-pill status-green">Anexo</span></td>
              <td>Comprovação de titularidade e número da UC</td>
            </tr>
            <tr>
              <td>3. Diagrama Unifilar do Padrão de Entrada e Quadro Geral</td>
              <td><span class="status-pill status-green">Anexo</span></td>
              <td>Elaborado conforme norma técnica da distribuidora</td>
            </tr>
            <tr>
              <td>4. Memorial Descritivo de Cargas e Cálculo de Demanda</td>
              <td><span class="status-pill status-green">Anexo</span></td>
              <td>Conforme especificações desta memória técnica</td>
            </tr>
            <tr>
              <td>5. Anotação de Responsabilidade Técnica (ART) de Projeto e Execução</td>
              <td><span class="status-pill status-green">Anexo</span></td>
              <td>${escapeHtml(art)} (CREA)</td>
            </tr>
            <tr>
              <td>6. Certificado de Homologação / Ficha Técnica dos Carregadores</td>
              <td><span class="status-pill status-green">Anexo</span></td>
              <td>Conformidade IEC 61851-1 e certificação Inmetro</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="report-signatures">
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>${escapeHtml(technician)}</strong></p>
          <p>Engenheiro Eletricista Responsável Técnico</p>
          <p>${escapeHtml(crea)} | ${escapeHtml(art)}</p>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>${escapeHtml(client)}</strong></p>
          <p>Titular da Unidade Consumidora</p>
          <p>Requerente junto à ${escapeHtml(concessionaria)}</p>
        </div>
      </div>
    </div>
    `;
  }

  function getBadgeColor(state) {
    if (state === 'NAO_APTO') return '#FF4D4D';
    if (state === 'APTO_COM_ADEQUACOES') return '#FFC41F';
    if (state === 'INCOMPLETA') return '#8C93A0';
    return '#9DEC0F';
  }

  function formatPhasesSummary(phases) {
    if (!phases) return 'Demanda existente não discriminada';
    return `L1: ${phases.A.existing}A, L2: ${phases.B.existing}A, L3: ${phases.C.existing}A`;
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
    buildTechnicalOpinion,
    buildCalculationMemory,
    buildConcessionaireRequest
  };
}));
