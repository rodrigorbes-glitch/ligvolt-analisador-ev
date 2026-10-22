/**
 * LIGVOLT - Motor de Diagnóstico Inteligente
 * Consolida os cálculos de dimensionamento com o checklist normativo
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./compliance-rules'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./compliance-rules'));
  } else {
    root.LigvoltDiagnostic = factory(root.LigvoltCompliance);
  }
}(typeof self !== 'undefined' ? self : this, function (Compliance) {
  'use strict';

  /**
   * Consolida resultados e gera o diagnóstico em 4 estados
   */
  function evaluateDiagnostic(calcResult, checklistResponses, rawInput) {
    if (!calcResult || calcResult.status === 'NO_CHARGERS') {
      return {
        state: 'INCOMPLETA',
        badge: '⚪ AVALIAÇÃO INCOMPLETA',
        badgeClass: 'badge-incomplete',
        headline: 'Nenhum carregador elétrico ativo configurado',
        summary: 'Adicione ao menos um ponto de recarga com corrente nominal válida para processar o diagnóstico.',
        identifiedIssues: ['Faltam dados dos carregadores elétricos a serem instalados.'],
        requiredAdaptations: [],
        pendingVerifications: ['Configurar parâmetros elétricos dos carregadores.'],
        recommendedScenario: null,
        scenarioRationale: ''
      };
    }

    const { chargers, phaseSummary, scenarioA, scenarioB, comparison, input } = calcResult;
    const responses = checklistResponses || {};
    const checklistItems = Compliance.CHECKLIST_ITEMS;

    const identifiedIssues = [];
    const blockingInadequacies = [];
    const actionableInadequacies = [];
    const pendingVerifications = [];
    const requiredAdaptations = [];

    // 1. Análise Elétrica do Motor de Cálculo
    const isMainBreakerKnown = phaseSummary.isMainBreakerKnown;
    const hasExistingData = phaseSummary.hasExistingData;

    if (!isMainBreakerKnown) {
      identifiedIssues.push('Capacidade nominal do disjuntor geral da instalação pendente de verificação.');
      pendingVerifications.push('Verificar a corrente nominal do disjuntor geral no quadro principal ou no padrão da concessionária.');
      requiredAdaptations.push({
        priority: 1,
        action: 'Verificar a demanda atual e a capacidade de fornecimento junto à concessionária e ao padrão de entrada.'
      });
    }

    if (!hasExistingData) {
      identifiedIssues.push('Demanda de corrente existente da instalação não informada ou não comprovada.');
      pendingVerifications.push('Medir o consumo real por fase nos horários de pico ou avaliar o histórico de demanda faturada.');
    }

    if (phaseSummary.isOverloaded) {
      phaseSummary.overloadDetails.forEach(detail => {
        identifiedIssues.push(`Sobrecarga no disjuntor geral: ${detail}.`);
        blockingInadequacies.push({
          source: 'Elétrica',
          issue: `Corrente combinada excede a capacidade do disjuntor geral (${phaseSummary.mainBreaker}A).`,
          risk: 'Desarme intempestivo do disjuntor geral de toda a edificação durante a recarga com risco de aquecimento severo na entrada.'
        });
      });
    }

    if (phaseSummary.unbalancePercent > 20) {
      identifiedIssues.push(`Desequilíbrio de carga entre fases acentuado (${phaseSummary.unbalancePercent}%).`);
      requiredAdaptations.push({
        priority: 2,
        action: 'Redistribuir carregadores monofásicos/bifásicos entre as fases para melhor balanceamento.'
      });
    }

    // 2. Análise do Checklist de Segurança e Normas
    checklistItems.forEach(item => {
      const response = responses[item.id] || item.defaultStatus || 'nao_verificado';

      if (response === 'inadequado') {
        identifiedIssues.push(`${item.title}: ${item.inadequateRisk}`);
        if (item.isBlocker) {
          blockingInadequacies.push({
            id: item.id,
            title: item.title,
            risk: item.inadequateRisk,
            norm: item.normativeRef
          });
        } else {
          actionableInadequacies.push({
            id: item.id,
            title: item.title,
            risk: item.inadequateRisk,
            norm: item.normativeRef
          });
        }
      } else if (response === 'nao_verificado') {
        pendingVerifications.push(`${item.title}: pendente de vistoria técnica.`);
      }
    });

    // 3. Determinação do Estado do Diagnóstico
    let state = 'APTO';
    let badge = '🟢 PRELIMINARMENTE APTO';
    let badgeClass = 'badge-apto';
    let headline = '';

    // Condição para NÃO APTO:
    // Sobrecarga comprovada no disjuntor geral, OU impedimento físico/normativo crítico (ex: sem sprinklers em subsolo, carregador não homologado)
    if (blockingInadequacies.length > 0) {
      state = 'NAO_APTO';
      badge = '🔴 NÃO APTO NAS CONDIÇÕES ATUAIS';
      badgeClass = 'badge-nao-apto';
      headline = 'Existem impedimentos técnicos ou riscos críticos que inviabilizam a instalação imediata';
    }
    // Condição para AVALIAÇÃO INCOMPLETA:
    // Se faltarem simultaneamente dados vitais elétricos e vistoria não iniciada
    else if (!isMainBreakerKnown && pendingVerifications.length >= 10) {
      state = 'INCOMPLETA';
      badge = '⚪ AVALIAÇÃO INCOMPLETA';
      badgeClass = 'badge-incomplete';
      headline = 'Faltam informações essenciais para concluir a análise de viabilidade';
    }
    // Condição para APTO COM ADEQUAÇÕES:
    // Viável eletricamente, mas exige novas proteções, novos circuitos dedicados, ou correções pontuais
    else if (
      actionableInadequacies.length > 0 ||
      pendingVerifications.length > 0 ||
      !isMainBreakerKnown ||
      !hasExistingData ||
      chargers.length > 0
    ) {
      // Se não há nenhuma inadequação e todos os itens do checklist foram marcados como adequado/não aplicável, e disjuntor conhecido:
      const hasUnresolvedItems = actionableInadequacies.length > 0 || pendingVerifications.length > 0 || !isMainBreakerKnown;
      if (hasUnresolvedItems) {
        state = 'APTO_COM_ADEQUACOES';
        badge = '🟡 APTO COM ADEQUAÇÕES';
        badgeClass = 'badge-adequacoes';
        headline = 'Instalação tecnicamente viável mediante a execução das adequações obrigatórias';
      } else {
        state = 'APTO';
        badge = '🟢 PRELIMINARMENTE APTO';
        badgeClass = 'badge-apto';
        headline = 'Os dados informados não indicam impedimentos técnicos relevantes (sujeito a projeto executivo e vistoria)';
      }
    } else {
      state = 'APTO';
      badge = '🟢 PRELIMINARMENTE APTO';
      badgeClass = 'badge-apto';
      headline = 'Os dados informados não indicam impedimentos técnicos relevantes (sujeito a projeto executivo e vistoria)';
    }

    // 4. Montagem das Adequações Necessárias com Prioridade
    if (phaseSummary.isOverloaded) {
      requiredAdaptations.push({
        priority: 1,
        action: `Solicitar aumento de carga junto à concessionária local para atender à demanda de pico combinada (${phaseSummary.maxTotalPhase}A por fase) ou implementar gerenciamento dinâmico de recarga (DLM).`
      });
    }

    if (responses['item_sprinklers'] === 'inadequado' || responses['item_location'] === 'inadequado') {
      requiredAdaptations.push({
        priority: 1,
        action: 'Relocar os carregadores para área externa ventilada/térreo ou dotar a garagem de chuveiros automáticos (sprinklers) conforme Nota CHEMG 326/2025 do CBMERJ.'
      });
    }

    if (responses['item_equipment_compliance'] === 'inadequado') {
      requiredAdaptations.push({
        priority: 1,
        action: 'Substituir os carregadores por equipamentos homologados conforme ABNT NBR IEC 61851-1 e certificação do Inmetro.'
      });
    }

    if (responses['item_grounding_pe'] === 'inadequado' || responses['item_grounding_pe'] === 'nao_verificado') {
      requiredAdaptations.push({
        priority: 1,
        action: 'Verificar e adequar aterramento, quadro e infraestrutura, garantindo condutor de proteção (PE) contínuo até os pontos de recarga.'
      });
    }

    if (responses['item_panel_integrity'] === 'inadequado') {
      requiredAdaptations.push({
        priority: 2,
        action: 'Readequar o quadro existente ou instalar novo subquadro dedicado para acomodar as proteções com espaço reserva normativo.'
      });
    }

    if (responses['item_dr_dps'] === 'inadequado' || responses['item_dr_dps'] === 'nao_verificado') {
      requiredAdaptations.push({
        priority: 2,
        action: 'Instalar disjuntores e proteções diferenciais compatíveis (DR 30mA Tipo A com RDC-DD 6mA ou Tipo B) e DPS Classe II.'
      });
    }

    if (responses['item_exclusive_circuits'] === 'inadequado' || responses['item_exclusive_circuits'] === 'nao_verificado') {
      requiredAdaptations.push({
        priority: 2,
        action: 'Instalar circuitos independentes dimensionados para cada carregador, sem compartilhamento com outras cargas da instalação.'
      });
    }

    if (responses['item_overcurrent_coord'] === 'inadequado') {
      requiredAdaptations.push({
        priority: 2,
        action: 'Substituir os disjuntores para garantir a coordenação com a capacidade dos cabos (IB <= In <= Iz).'
      });
    }

    if (responses['item_physical_protection'] === 'inadequado') {
      requiredAdaptations.push({
        priority: 3,
        action: 'Instalar balizadores mecânicos e parachoques de solo para proteção dos carregadores contra colisão de veículos em manobras.'
      });
    }

    if (responses['item_emergency_stop'] === 'inadequado') {
      requiredAdaptations.push({
        priority: 3,
        action: 'Prever botão ou chave de seccionamento de emergência de fácil acesso para desenergização rápida em caso de sinistro.'
      });
    }

    if (responses['item_technical_responsibility'] === 'inadequado' || responses['item_technical_responsibility'] === 'nao_verificado') {
      requiredAdaptations.push({
        priority: 1,
        action: 'Validar o dimensionamento em projeto executivo por profissional habilitado (Engenheiro Eletricista com ART no CREA).'
      });
    }

    // Adequações decorrentes do dimensionamento técnico
    if (comparison && comparison.recommendedScenario === 'A' && scenarioA) {
      requiredAdaptations.push({
        priority: 2,
        action: `Executar Alimentador Único (${scenarioA.cableDescription}) com disjuntor de ${scenarioA.breakerRating}A até Subquadro QGBT-EV dedicado.`
      });
    } else if (comparison && comparison.recommendedScenario === 'B') {
      requiredAdaptations.push({
        priority: 2,
        action: `Instalar ${chargers.length} circuito(s) independente(s) dedicado(s) com bitolas e proteções individuais dimensionadas.`
      });
    }

    // Desduplicação de ações por texto similar
    const uniqueActions = [];
    const seenActions = new Set();
    requiredAdaptations.sort((a, b) => a.priority - b.priority).forEach(item => {
      const simplified = item.action.substring(0, 30);
      if (!seenActions.has(simplified)) {
        seenActions.add(simplified);
        uniqueActions.push(item);
      }
    });

    // Resumo
    const summaryText = `Instalação de ${chargers.length} carregador(es) (${chargers.map(c => `${c.name}: ${c.nominalCurrent}A`).join(', ')}), a ${input.distance} metros do quadro geral.`;

    return {
      state,
      badge,
      badgeClass,
      headline,
      summary: summaryText,
      identifiedIssues,
      blockingInadequacies,
      actionableInadequacies,
      requiredAdaptations: uniqueActions,
      pendingVerifications,
      recommendedScenario: comparison ? comparison.recommendedScenario : 'B',
      scenarioRationale: comparison ? comparison.rationale : ''
    };
  }

  return {
    evaluateDiagnostic
  };
}));
