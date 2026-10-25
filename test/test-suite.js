/**
 * LIGVOLT - Suíte de Testes Automatizados para Motores Elétricos, Normativos, Dossiê e Vistoria com IA
 */

const Tables = require('../js/electrical-tables');
const Engine = require('../js/calculation-engine');
const Compliance = require('../js/compliance-rules');
const Diagnostic = require('../js/diagnostic-engine');
const Dossier = require('../js/dossier-generator');
const SmartInspection = require('../js/smart-inspection');

function runAllTests() {
  console.log('====================================================');
  console.log('⚡ LIGVOLT - INICIANDO SUÍTE DE TESTES NORMATIVOS ⚡');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error(`     Detalhes: ${details}`);
      failed++;
    }
  }

  // TESTE 1: Tabela de Condutores de Proteção (PE) - Tabela 58 NBR 5410
  console.log('--- TESTE 1: Dimensionamento do PE (NBR 5410 Tabela 58) ---');
  assert(Tables.calculateProtectiveConductor(2.5) === 2.5, 'Fase 2.5mm² -> PE 2.5mm²');
  assert(Tables.calculateProtectiveConductor(6) === 6, 'Fase 6mm² -> PE 6mm²');
  assert(Tables.calculateProtectiveConductor(16) === 16, 'Fase 16mm² -> PE 16mm²');
  assert(Tables.calculateProtectiveConductor(25) === 16, 'Fase 25mm² -> PE 16mm²');
  assert(Tables.calculateProtectiveConductor(35) === 16, 'Fase 35mm² -> PE 16mm²');
  assert(Tables.calculateProtectiveConductor(50) === 25, 'Fase 50mm² -> PE 25mm² (50/2)');
  assert(Tables.calculateProtectiveConductor(70) === 35, 'Fase 70mm² -> PE 35mm² (70/2)');

  // TESTE 2: Disjuntores Comerciais Padronizados
  console.log('\n--- TESTE 2: Seleção de Disjuntores Comerciais ---');
  assert(Tables.getNextCommercialBreaker(32) === 32, 'Corrente 32A -> Disjuntor 32A');
  assert(Tables.getNextCommercialBreaker(32.1) === 40, 'Corrente 32.1A -> Disjuntor 40A');
  assert(Tables.getNextCommercialBreaker(40) === 40, 'Corrente 40A -> Disjuntor 40A (margem 125% de 32A é 40A)');
  assert(Tables.getNextCommercialBreaker(55) === 63, 'Corrente 55A -> Disjuntor 63A');

  // TESTE 3: Cenário com 1 Carregador de 32A (220V Monofásico, 20m)
  console.log('\n--- TESTE 3: 1 Carregador 32A Monofásico a 20m ---');
  const res1 = Engine.calculateInstallation({
    distance: 20,
    supplyType: 'monofasica',
    voltageSingle: 220,
    mainBreaker: 63,
    existingDemand: 15,
    cableInsulation: 'PVC',
    installationMethod: 'B1',
    groupingCircuits: 1,
    ambientTemp: 30,
    useContinuousMargin: true,
    chargers: [
      { id: 1, name: 'Wallbox 32A', nominalCurrent: 32, enabled: true, phaseConfig: 'L1-N' }
    ]
  });

  assert(res1.status === 'OK', 'Cálculo executado com sucesso');
  assert(res1.chargers.length === 1, '1 carregador processado');
  const ch1 = res1.chargers[0];
  assert(ch1.projectCurrent === 40, `Corrente de projeto com margem 125%: ${ch1.projectCurrent}A (esperado 40A)`);
  assert(ch1.cableSection >= 6, `Seção do cabo adequada (>= 6mm² para 40A em B1): ${ch1.cableSection}mm²`);
  assert(ch1.voltageDropPercent <= 4.0, `Queda de tensão normativamente conforme (<= 4%): ${ch1.voltageDropPercent}%`);
  assert(ch1.recommendedBreaker >= 40, `Disjuntor recomendado: ${ch1.recommendedBreaker}A`);
  assert(res1.comparison.recommendedScenario === 'B', `Para 1 carregador, Cenário B recomendado: ${res1.comparison.recommendedScenario}`);

  // TESTE 4: Cenário com 2 Carregadores de 32A em Rede Trifásica 220/380V a 30m
  console.log('\n--- TESTE 4: 2 Carregadores 32A Trifásicos a 30m ---');
  const res2 = Engine.calculateInstallation({
    distance: 30,
    supplyType: 'trifasica',
    voltagePreset: '220_380',
    mainBreaker: 100,
    existingDemand: { L1: 20, L2: 20, L3: 20 },
    cableInsulation: 'PVC',
    installationMethod: 'B1',
    groupingCircuits: 1,
    useContinuousMargin: true,
    chargers: [
      { id: 1, name: 'EV 1', nominalCurrent: 32, enabled: true, phaseConfig: '3F' },
      { id: 2, name: 'EV 2', nominalCurrent: 32, enabled: true, phaseConfig: '3F' }
    ]
  });

  assert(res2.chargers.length === 2, '2 carregadores ativos');
  assert(res2.scenarioA.breakerRating >= 80, `Disjuntor alimentador Cenário A dimensionado: ${res2.scenarioA.breakerRating}A`);
  assert(res2.comparison.recommendedScenario === 'A', `Para 2 carregadores a 30m, Cenário A recomendado: ${res2.comparison.recommendedScenario}`);

  // TESTE 5: 4 Carregadores com Fases Desequilibradas
  console.log('\n--- TESTE 5: 4 Carregadores com Fases Desequilibradas ---');
  const res4 = Engine.calculateInstallation({
    distance: 25,
    supplyType: 'trifasica',
    voltagePreset: '220_380',
    mainBreaker: 125,
    existingDemand: { L1: 25, L2: 15, L3: 10 },
    cableInsulation: 'XLPE',
    installationMethod: 'B1',
    chargers: [
      { id: 1, name: 'EV L1', nominalCurrent: 32, enabled: true, phaseConfig: 'L1-N' },
      { id: 2, name: 'EV L1-bis', nominalCurrent: 16, enabled: true, phaseConfig: 'L1-N' },
      { id: 3, name: 'EV L2', nominalCurrent: 32, enabled: true, phaseConfig: 'L2-N' },
      { id: 4, name: 'EV L3', nominalCurrent: 16, enabled: true, phaseConfig: 'L3-N' }
    ]
  });

  const pSum = res4.phaseSummary;
  assert(pSum.phases.A.totalProject > pSum.phases.C.totalProject, 'Detectado maior carregamento na Fase A');
  assert(pSum.unbalancePercent > 10, `Cálculo correto do desequilíbrio percentual: ${pSum.unbalancePercent}%`);

  // TESTE 6: Verificação de Sobrecarga Elétrica Real (Estado NÃO APTO)
  console.log('\n--- TESTE 6: Detecção de Sobrecarga no Disjuntor Geral ---');
  const resOverload = Engine.calculateInstallation({
    distance: 15,
    supplyType: 'trifasica',
    voltagePreset: '220_380',
    mainBreaker: 63,
    existingDemand: { L1: 45, L2: 45, L3: 45 },
    chargers: [
      { id: 1, name: 'Wallbox 32A', nominalCurrent: 32, enabled: true, phaseConfig: '3F' }
    ]
  });

  assert(resOverload.phaseSummary.isOverloaded === true, 'Sobrecarga no disjuntor geral detectada com sucesso (45A + 40A = 85A > 63A)');

  const diagOverload = Diagnostic.evaluateDiagnostic(resOverload, {
    item_grounding_pe: 'adequado',
    item_panel_integrity: 'adequado',
    item_location: 'adequado',
    item_sprinklers: 'adequado'
  });
  assert(diagOverload.state === 'NAO_APTO', `Diagnóstico em sobrecarga deve ser NÃO APTO: ${diagOverload.state}`);

  // TESTE 7: Avaliação Incompleta por Disjuntor Geral Pendente
  console.log('\n--- TESTE 7: Avaliação Incompleta por Disjuntor Geral Pendente ---');
  const resIncomplete = Engine.calculateInstallation({
    distance: 15,
    supplyType: 'trifasica',
    voltagePreset: '220_380',
    mainBreaker: null,
    chargers: [
      { id: 1, name: 'Wallbox 32A', nominalCurrent: 32, enabled: true, phaseConfig: '3F' }
    ]
  });

  const diagIncomplete = Diagnostic.evaluateDiagnostic(resIncomplete, {});
  assert(diagIncomplete.state === 'INCOMPLETA', `Diagnóstico sem disjuntor deve ser INCOMPLETA: ${diagIncomplete.state}`);

  // TESTE 8: Regra CBMERJ CHEMG 326/2025 (Sprinklers Inadequados)
  console.log('\n--- TESTE 8: Regra CBMERJ CHEMG 326/2025 (Sprinklers Inadequados) ---');
  const diagSprinklers = Diagnostic.evaluateDiagnostic(res1, {
    item_location: 'adequado',
    item_sprinklers: 'inadequado',
    item_grounding_pe: 'adequado',
    item_panel_integrity: 'adequado'
  });
  assert(diagSprinklers.state === 'NAO_APTO', `Sem sprinklers em local fechado deve resultar em NÃO APTO: ${diagSprinklers.state}`);
  assert(diagSprinklers.identifiedIssues.some(i => i.includes('Sprinklers')), 'Problema de sprinklers listado no diagnóstico');

  // TESTE 9: Apto com Adequações
  console.log('\n--- TESTE 9: Apto com Adequações ---');
  const diagAdeq = Diagnostic.evaluateDiagnostic(res1, {
    item_location: 'adequado',
    item_sprinklers: 'adequado',
    item_grounding_pe: 'adequado',
    item_panel_integrity: 'adequado',
    item_dr_dps: 'inadequado',
    item_exclusive_circuits: 'inadequado'
  });
  assert(diagAdeq.state === 'APTO_COM_ADEQUACOES', `Com adequações viáveis deve resultar em APTO COM ADEQUAÇÕES: ${diagAdeq.state}`);
  assert(diagAdeq.requiredAdaptations.length > 0, 'Lista de adequações prioritárias gerada');

  // TESTE 10: Laudo Técnico de Engenharia (Dossiê)
  console.log('\n--- TESTE 10: Emissão do Laudo Técnico de Engenharia ---');
  const opinionHTML = Dossier.buildTechnicalOpinion(res2, diagAdeq, {}, {
    clientName: 'Condomínio Teste',
    address: 'Rua das Flores, 100',
    technician: 'Eng. Rodrigo',
    crea: 'CREA-RJ 123456/D',
    concessionaria: 'Light',
    ucNumber: '123456789'
  });
  assert(opinionHTML.includes('LAUDO TÉCNICO DE ENGENHARIA ELÉTRICA'), 'Cabeçalho do laudo gerado');
  assert(opinionHTML.includes('Condomínio Teste'), 'Dados do cliente integrados');
  assert(opinionHTML.includes('CREA-RJ 123456/D'), 'Registro do responsável técnico presente');

  // TESTE 11: Memória de Cálculo Detalhada (Dossiê)
  console.log('\n--- TESTE 11: Emissão da Memória de Cálculo Detalhada ---');
  const memoryHTML = Dossier.buildCalculationMemory(res2, {});
  assert(memoryHTML.includes('MEMÓRIA DE CÁLCULO ELÉTRICO NORMATIVO'), 'Cabeçalho da memória de cálculo gerado');
  assert(memoryHTML.includes('Corrente de Projeto'), 'Passo a passo de equações presente');
  assert(memoryHTML.includes('Queda de Tensão Calculada'), 'Queda de tensão calculada individualmente');

  // TESTE 12: Pedido de Aumento de Carga para Concessionária (Dossiê)
  console.log('\n--- TESTE 12: Pedido de Aumento de Carga e Homologação ---');
  const requestHTML = Dossier.buildConcessionaireRequest(res2, {
    clientName: 'Condomínio Teste',
    concessionaria: 'Enel RJ',
    ucNumber: '987654321'
  });
  assert(requestHTML.includes('MEMORIAL DESCRITIVO PARA PEDIDO DE AUMENTO DE CARGA'), 'Cabeçalho para concessionária gerado');
  assert(requestHTML.includes('Enel RJ'), 'Concessionária discriminada');
  assert(requestHTML.includes('Checklist de Documentos Anexos'), 'Checklist documental para homologação presente');

  // =========================================================================
  // NOVOS TESTES: VISTORIA PRELIMINAR INTELIGENTE (CASOS EXIGIDOS NA EVOLUÇÃO)
  // =========================================================================
  console.log('\n=============================================================');
  console.log('🤖 TESTES DE VISTORIA INTELIGENTE & CASOS DE BORDA NORMATIVOS');
  console.log('=============================================================');

  // CASO 1: Local sem irregularidades aparentes, mas com demanda elétrica desconhecida
  console.log('\n--- CASO 1: Vistoria sem irregularidades, mas demanda desconhecida ---');
  const inspCase1 = {
    localData: { locationType: 'residencia', installArea: 'garagem_aberta', vehicleCount: 1, chargerType: 'wallbox', distanceApprox: '10-25', cityState: 'Curitiba - PR' },
    confirmations: { mainBreakerConfirmed: '50', groundingConfirmed: 'sim', rainProtectionConfirmed: 'sim', spaceAvailableConfirmed: 'sim', exclusiveCircuitConfirmed: 'nao', capacityVerified: 'nao_sei', cbmerjSprinklers: 'nao_se_aplica' },
    photos: []
  };
  const diagCase1 = SmartInspection.evaluateInspectionViability(inspCase1);
  assert(diagCase1.state === 'APTO_COM_ADEQUACOES', 'Classificação deve ser APTO COM ADEQUAÇÕES');
  assert(diagCase1.necessaryActions.some(a => a.includes('exclusivo')), 'Exige criação de circuito exclusivo');
  assert(diagCase1.necessaryActions.some(a => a.includes('medição')), 'Exige medição de corrente de pico');

  // CASO 2: Disjuntor legível e quadro sem informações suficientes
  console.log('\n--- CASO 2: Disjuntor legível mas quadro sem espaço/informações suficientes ---');
  const inspCase2 = {
    localData: { locationType: 'condominio', installArea: 'garagem_aberta', vehicleCount: 1, chargerType: 'wallbox', distanceApprox: '25-50', cityState: 'São Paulo - SP' },
    confirmations: { mainBreakerConfirmed: '63', groundingConfirmed: 'nao_sei', rainProtectionConfirmed: 'sim', spaceAvailableConfirmed: 'nao', exclusiveCircuitConfirmed: 'nao', capacityVerified: 'nao_sei', cbmerjSprinklers: 'nao_se_aplica' },
    photos: []
  };
  const diagCase2 = SmartInspection.evaluateInspectionViability(inspCase2);
  assert(diagCase2.necessaryActions.some(a => a.includes('subquadro') || a.includes('quadro')), 'Exige subquadro elétrico auxiliar por falta de espaço');
  assert(diagCase2.pendingVerifications.some(p => p.includes('aterramento')), 'Registra pendência de teste de aterramento');

  // CASO 3: Fotografia ilegível / sem dados visíveis
  console.log('\n--- CASO 3: Fotografia ilegível / sem dados suficientes do disjuntor ---');
  const inspCase3 = {
    localData: { locationType: 'residencia', installArea: 'garagem_aberta', vehicleCount: 1, chargerType: 'wallbox', distanceApprox: '<10', cityState: 'Belo Horizonte - MG' },
    confirmations: { mainBreakerConfirmed: 'nao_sei', groundingConfirmed: 'nao_sei', rainProtectionConfirmed: 'sim', spaceAvailableConfirmed: 'nao_sei', exclusiveCircuitConfirmed: 'nao', capacityVerified: 'nao_sei', cbmerjSprinklers: 'nao_se_aplica' },
    photos: []
  };
  const diagCase3 = SmartInspection.evaluateInspectionViability(inspCase3);
  assert(diagCase3.state === 'NECESSITA_VERIFICACAO', 'Sem dados suficientes do disjuntor e quadro, deve resultar em NECESSITA VERIFICAÇÃO TÉCNICA');

  // CASO 4: Ausência confirmada de proteção necessária (Aterramento inexistente)
  console.log('\n--- CASO 4: Ausência confirmada de aterramento (Risco Crítico) ---');
  const inspCase4 = {
    localData: { locationType: 'residencia', installArea: 'garagem_aberta', vehicleCount: 1, chargerType: 'wallbox', distanceApprox: '<10', cityState: 'Rio de Janeiro - RJ' },
    confirmations: { mainBreakerConfirmed: '50', groundingConfirmed: 'nao', rainProtectionConfirmed: 'sim', spaceAvailableConfirmed: 'sim', exclusiveCircuitConfirmed: 'nao', capacityVerified: 'nao_sei', cbmerjSprinklers: 'nao_se_aplica' },
    photos: []
  };
  const diagCase4 = SmartInspection.evaluateInspectionViability(inspCase4);
  assert(diagCase4.criticalActions.some(a => a.includes('aterramento')), 'Gera ação crítica imediata de implantação de aterramento TN-S');
  assert(diagCase4.problemsFound.some(p => p.severity === 'critica'), 'Problema classificado com severidade crítica');

  // CASO 5: Garagem fechada ou subsolo com restrições de segurança aplicáveis (Nota CBMERJ 326/2025)
  console.log('\n--- CASO 5: Garagem em subsolo sem sprinklers (Restrição CBMERJ 326/2025) ---');
  const inspCase5 = {
    localData: { locationType: 'condominio', installArea: 'subsolo', vehicleCount: 2, chargerType: 'wallbox', distanceApprox: '25-50', cityState: 'Rio de Janeiro - RJ' },
    confirmations: { mainBreakerConfirmed: '100', groundingConfirmed: 'sim', rainProtectionConfirmed: 'sim', spaceAvailableConfirmed: 'sim', exclusiveCircuitConfirmed: 'nao', capacityVerified: 'sim', cbmerjSprinklers: 'nao' },
    photos: []
  };
  const diagCase5 = SmartInspection.evaluateInspectionViability(inspCase5);
  assert(diagCase5.state === 'NAO_APTO', 'Subsolo sem sprinklers no RJ deve resultar em NÃO APTO');
  assert(diagCase5.criticalActions.some(a => a.includes('sprinklers') || a.includes('externa')), 'Gera ação impeditiva de relocar ou instalar sprinklers');

  // CASO 6: Sobrecarga crítica evidente no disjuntor geral
  console.log('\n--- CASO 6: Sobrecarga crítica evidente (Disjuntor 40A vs 2 Wallboxes) ---');
  const inspCase6 = {
    localData: { locationType: 'residencia', installArea: 'garagem_aberta', vehicleCount: 2, chargerType: 'wallbox', distanceApprox: '<10', cityState: 'Campinas - SP' },
    confirmations: { mainBreakerConfirmed: '40', groundingConfirmed: 'sim', rainProtectionConfirmed: 'sim', spaceAvailableConfirmed: 'sim', exclusiveCircuitConfirmed: 'nao', capacityVerified: 'nao_sei', cbmerjSprinklers: 'nao_se_aplica' },
    photos: []
  };
  const diagCase6 = SmartInspection.evaluateInspectionViability(inspCase6);
  assert(diagCase6.state === 'NAO_APTO', 'Disjuntor 40A para 2 Wallboxes (64A) deve resultar em NÃO APTO');
  assert(diagCase6.criticalActions.some(a => a.includes('aumento de carga')), 'Exige aumento de carga junto à concessionária');

  // CASO 7: Vistoria sem fotografias (Permite conclusão manual com pendências)
  console.log('\n--- CASO 7: Vistoria sem fotografias ---');
  const inspCase7 = {
    localData: { locationType: 'residencia', installArea: 'garagem_aberta', vehicleCount: 1, chargerType: 'tomada', distanceApprox: '<10', cityState: 'Porto Alegre - RS' },
    confirmations: { mainBreakerConfirmed: '50', groundingConfirmed: 'sim', rainProtectionConfirmed: 'sim', spaceAvailableConfirmed: 'sim', exclusiveCircuitConfirmed: 'sim', capacityVerified: 'sim', cbmerjSprinklers: 'nao_se_aplica' },
    photos: []
  };
  const diagCase7 = SmartInspection.evaluateInspectionViability(inspCase7);
  assert(diagCase7.state === 'PRELIMINARMENTE_APTO' || diagCase7.state === 'APTO_COM_ADEQUACOES', 'Executa sem falhas mesmo sem fotos');

  // CASO 8: Geração do Laudo Preliminar de Vistoria em PDF com evidências
  console.log('\n--- CASO 8: Geração do Laudo Preliminar de Vistoria com Evidências ---');
  const reportHtml = SmartInspection.buildPreliminaryInspectionReportHTML({
    localData: inspCase1.localData,
    confirmations: inspCase1.confirmations,
    photos: [
      { id: '1', categoryName: 'Foto Geral do Quadro', dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', timestamp: '24/10/2026 14:00' }
    ],
    clientMeta: { clientName: 'João da Silva', address: 'Rua das Palmeiras, 50', inspectorName: 'Técnico Especialista' }
  }, diagCase1);

  assert(reportHtml.includes('RELATÓRIO PRELIMINAR DE VISTORIA E VIABILIDADE'), 'Título do laudo preliminar gerado');
  assert(reportHtml.includes('Evidências Fotográficas da Vistoria'), 'Seção de evidências fotográficas presente');
  assert(reportHtml.includes('João da Silva'), 'Nome do cliente presente');
  assert(reportHtml.includes('Alimentação Elétrica:'), 'Seção de alimentação elétrica presente no laudo');
  assert(reportHtml.includes('Natureza Preliminar Deste Relatório'), 'Aviso legal obrigatório presente');

  // CASO 9: Vistoria com Alimentação Desconhecida ("Não sei")
  console.log('\n--- CASO 9: Vistoria com Alimentação e Tensão Desconhecidas ---');
  const inspCase9 = {
    localData: {
      locationType: 'residencia',
      installArea: 'garagem_aberta',
      supplyType: 'nao_sei',
      voltagePreset: 'nao_sei',
      vehicleCount: 1,
      chargerType: 'wallbox',
      distanceApprox: '10-25'
    },
    confirmations: {
      mainBreakerConfirmed: '50',
      groundingConfirmed: 'sim',
      rainProtectionConfirmed: 'sim',
      spaceAvailableConfirmed: 'sim',
      exclusiveCircuitConfirmed: 'sim',
      capacityVerified: 'sim',
      cbmerjSprinklers: 'nao_se_aplica'
    },
    photos: []
  };
  const diagCase9 = SmartInspection.evaluateInspectionViability(inspCase9);
  assert(diagCase9.problemsFound.some(p => p.title.includes('alimentação')), 'Registra pendência de verificação para tipo de alimentação desconhecido');
  assert(diagCase9.problemsFound.some(p => p.title.includes('Tensão')), 'Registra pendência de verificação para tensão desconhecida');
  assert(diagCase9.pendingVerifications.some(v => v.includes('número de condutores de fase')), 'Ação pendente de identificar fases presente');

  // CASO 10: Dimensionamento e Distribuição Real em Rede Bifásica 127/220V
  console.log('\n--- CASO 10: Dimensionamento Bifásico 127/220V (Padrão Sugerido Ligvolt) ---');
  const resBifasica = Engine.calculateInstallation({
    distance: 20,
    supplyType: 'bifasica',
    voltagePreset: '127_220',
    mainBreaker: 50,
    existingDemand: { L1: 15, L2: 10 },
    cableInsulation: 'PVC',
    installationMethod: 'B1',
    groupingCircuits: 1,
    ambientTemp: 30,
    useContinuousMargin: true,
    chargers: [
      { id: 1, name: 'Wallbox Residencial (F-F)', nominalCurrent: 32, enabled: true, phaseConfig: 'L1-L2' }
    ]
  });

  assert(resBifasica.status === 'OK', 'Cálculo de instalação bifásica executado com sucesso');
  const chBif = resBifasica.chargers[0];
  assert(chBif.projectCurrent === 40, `Corrente de projeto na ligação bifásica 220V: ${chBif.projectCurrent}A`);
  assert(chBif.cableSection >= 6, `Cabo dimensionado conforme capacidade de condução: ${chBif.cableSection}mm²`);
  assert(chBif.voltageDropPercent <= 4.0, `Queda de tensão bifásica calculada corretamente em 220V F-F: ${chBif.voltageDropPercent}%`);

  const pSummary = resBifasica.phaseSummary;
  assert(pSummary.phases.A.evProject === 40, 'Fase A recebe 40A do carregador L1-L2');
  assert(pSummary.phases.B.evProject === 40, 'Fase B recebe 40A do carregador L1-L2');
  assert(pSummary.phases.C.evProject === 0, 'Fase C não recebe carga em alimentação bifásica');
  assert(pSummary.maxPhaseProject === 55, `Corrente máxima da maior fase calculada sem soma escalar incorreta: ${pSummary.maxPhaseProject}A (15A existente + 40A EV)`);

  // RESUMO DOS TESTES
  console.log('\n====================================================');
  console.log(`🏁 RESULTADO FINAL: ${passed} PASSARAM | ${failed} FALHARAM`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runAllTests();
}

if (typeof module !== 'undefined') {
  module.exports = { runAllTests };
}
