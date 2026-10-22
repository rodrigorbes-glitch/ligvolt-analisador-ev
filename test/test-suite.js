/**
 * LIGVOLT - Suíte de Testes Automatizados para Motores Elétricos, Normativos e Dossiê
 */

const Tables = require('../js/electrical-tables');
const Engine = require('../js/calculation-engine');
const Compliance = require('../js/compliance-rules');
const Diagnostic = require('../js/diagnostic-engine');
const Dossier = require('../js/dossier-generator');

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
    useContinuousMargin: true, // 125% -> IB = 40A
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

  // TESTE 5: Cenário com 4 Carregadores e Rede Trifásica Desequilibrada
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
    mainBreaker: 63, // Disjuntor geral de apenas 63A
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
    mainBreaker: null, // Pendente de verificação
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
    item_sprinklers: 'inadequado', // Garagem fechada sem sprinklers
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
