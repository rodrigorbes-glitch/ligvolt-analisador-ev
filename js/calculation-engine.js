/**
 * LIGVOLT - Motor de Cálculo Elétrico Normativo
 * Atende ABNT NBR 5410, ABNT NBR 17019, IEC 61851
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./electrical-tables'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./electrical-tables'));
  } else {
    root.LigvoltEngine = factory(root.LigvoltTables);
  }
}(typeof self !== 'undefined' ? self : this, function (Tables) {
  'use strict';

  /**
   * Executa o dimensionamento completo a partir dos parâmetros de entrada
   * @param {Object} input - Objeto de parâmetros
   * @returns {Object} Resultado detalhado do dimensionamento
   */
  function calculateInstallation(input) {
    const distance = parseFloat(input.distance) || 0;
    const supplyType = input.supplyType || 'trifasica'; // 'monofasica', 'bifasica', 'trifasica'
    const voltageV = getVoltages(input);
    const mainBreaker = input.mainBreaker !== undefined && input.mainBreaker !== null && input.mainBreaker !== ''
      ? parseFloat(input.mainBreaker)
      : null; // null se pendente de verificação

    const continuousMargin = input.useContinuousMargin !== false ? (parseFloat(input.continuousMarginFactor) || 1.25) : 1.0;
    const maxDropAllowed = parseFloat(input.maxVoltageDrop) || 4.0; // %
    const cableInsulation = input.cableInsulation === 'XLPE' ? 'XLPE' : 'PVC';
    const installMethod = input.installationMethod || 'B1';
    const grouping = parseInt(input.groupingCircuits, 10) || 1;
    const ambientTemp = parseFloat(input.ambientTemp) || 30;

    // Fatores de correção
    const fTemp = Tables.getTempFactor(cableInsulation, ambientTemp);
    const fGroup = Tables.getGroupingFactor(grouping);
    const fCorrection = fTemp * fGroup;

    // Resistividade do cobre e reatância
    const rho = Tables.COPPER_RESISTIVITY[cableInsulation];
    const cosPhi = 0.99; // Fator de potência típico de retificador ativo de VE (PFC)
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
    const xReactance = Tables.REACTANCE_X;

    // Processamento dos carregadores ativos
    const rawChargers = input.chargers || [];
    const activeChargers = [];

    rawChargers.forEach((ch, idx) => {
      if (ch && ch.enabled) {
        const nominalCurrent = parseFloat(ch.nominalCurrent) || 0;
        if (nominalCurrent > 0) {
          activeChargers.push({
            id: ch.id || idx + 1,
            name: ch.name || `Carregador ${idx + 1}`,
            nominalCurrent: nominalCurrent,
            phaseConfig: ch.phaseConfig || defaultPhaseConfig(supplyType, idx),
            powerKW: ch.powerKW ? parseFloat(ch.powerKW) : null
          });
        }
      }
    });

    // Se nenhum carregador foi adicionado
    if (activeChargers.length === 0) {
      return {
        status: 'NO_CHARGERS',
        message: 'Nenhum carregador ativo configurado.',
        input,
        chargers: [],
        phaseSummary: null,
        scenarioA: null,
        scenarioB: null,
        recommendation: null
      };
    }

    // 1. Cálculo individual de cada carregador
    const sizedChargers = activeChargers.map((ch, idx) => {
      return sizeIndividualCharger({
        charger: ch,
        index: idx,
        distance,
        supplyType,
        voltageV,
        continuousMargin,
        cableInsulation,
        installMethod,
        fCorrection,
        fTemp,
        fGroup,
        rho,
        cosPhi,
        sinPhi,
        xReactance,
        maxDropAllowed
      });
    });

    // 2. Balanço de carga real nas fases
    const phaseSummary = calculatePhaseDistribution({
      supplyType,
      voltageV,
      mainBreaker,
      existingDemand: input.existingDemand,
      existingDemandUnit: input.existingDemandUnit || 'A',
      sizedChargers,
      continuousMargin
    });

    // 3. Cenário A: Alimentador único + Quadro Secundário (QGBT-EV)
    const scenarioA = calculateScenarioA({
      activeChargers: sizedChargers,
      distance,
      supplyType,
      voltageV,
      continuousMargin,
      cableInsulation,
      installMethod,
      fTemp,
      ambientTemp,
      rho,
      cosPhi,
      sinPhi,
      xReactance,
      maxDropAllowed,
      phaseSummary
    });

    // 4. Cenário B: Circuitos Independentes Diretos
    const scenarioB = calculateScenarioB({
      sizedChargers,
      distance,
      installMethod,
      cableInsulation
    });

    // 5. Comparação e Recomendação Técnica
    const comparison = compareScenarios(scenarioA, scenarioB, distance, sizedChargers.length);

    return {
      status: 'OK',
      input: {
        distance,
        supplyType,
        voltageV,
        mainBreaker,
        continuousMargin,
        maxDropAllowed,
        cableInsulation,
        installMethod,
        grouping,
        ambientTemp,
        fCorrection,
        fTemp,
        fGroup
      },
      chargers: sizedChargers,
      phaseSummary,
      scenarioA,
      scenarioB,
      comparison
    };
  }

  /**
   * Helper para extrair tensões Nominais
   */
  function getVoltages(input) {
    const preset = input.voltagePreset || '220_380';
    let fn = 220;
    let ff = 380;

    if (preset === '127_220') {
      fn = 127;
      ff = 220;
    } else if (preset === '220_380') {
      fn = 220;
      ff = 380;
    } else if (preset === '220_mono' || preset === '220') {
      fn = 220;
      ff = 220;
    } else if (preset === '127') {
      fn = 127;
      ff = 127;
    } else if (preset === '380') {
      fn = 380;
      ff = 380;
    } else if (preset === 'custom') {
      fn = parseFloat(input.voltagePhaseNeutral) || 220;
      ff = parseFloat(input.voltagePhasePhase) || (fn === 127 ? 220 : (fn === 220 ? 380 : fn));
    }

    if (input.supplyType === 'monofasica') {
      const singleV = parseFloat(input.voltageSingle) || (fn === 127 ? 127 : 220);
      return { fn: singleV, ff: singleV, nominal: singleV, label: `${singleV}V` };
    } else if (input.supplyType === 'bifasica') {
      const label = fn === ff ? `${ff}V` : `${fn}V / ${ff}V`;
      return { fn, ff, nominal: ff, label };
    } else {
      const label = fn === ff ? `${ff}V` : `${fn}V / ${ff}V`;
      return { fn, ff, nominal: ff, label };
    }
  }

  /**
   * Atribuição de fase padrão para carregadores adicionais
   */
  function defaultPhaseConfig(supplyType, index) {
    if (supplyType === 'monofasica') return 'L1-N';
    if (supplyType === 'bifasica') {
      const options = ['L1-N', 'L2-N', 'L1-L2'];
      return options[index % options.length];
    }
    // trifasica
    const options = ['3F', 'L1-N', 'L2-N', 'L3-N'];
    return options[index % options.length];
  }

  /**
   * Dimensiona um carregador individual para circuito direto
   */
  function sizeIndividualCharger(params) {
    const {
      charger,
      distance,
      supplyType,
      voltageV,
      continuousMargin,
      cableInsulation,
      installMethod,
      fCorrection,
      rho,
      cosPhi,
      sinPhi,
      xReactance,
      maxDropAllowed
    } = params;

    const Inom = charger.nominalCurrent;
    const IB = Inom * continuousMargin; // Corrente de projeto com margem contínua
    const phaseConfig = charger.phaseConfig;

    // Tensão do circuito e número de condutores carregados
    let circuitVoltage = voltageV.fn;
    let loadedConductors = 2;
    let isThreePhase = false;

    if (phaseConfig === '3F') {
      circuitVoltage = voltageV.ff;
      loadedConductors = 3;
      isThreePhase = true;
    } else if (phaseConfig.includes('-L')) {
      // Bifásico sem neutro (ex: L1-L2)
      circuitVoltage = voltageV.ff;
      loadedConductors = 2;
    } else {
      // Fase-Neutro
      circuitVoltage = voltageV.fn;
      loadedConductors = 2;
    }

    // Potência ativa estimada (kW)
    let powerKW = 0;
    if (isThreePhase) {
      powerKW = (Math.sqrt(3) * circuitVoltage * Inom * cosPhi) / 1000;
    } else {
      powerKW = (circuitVoltage * Inom * cosPhi) / 1000;
    }
    powerKW = Math.round(powerKW * 10) / 10;

    // Seleção de condutor por capacidade de corrente (Iz >= IB / fCorrection)
    const methodTable = Tables.AMPACITY_TABLES[installMethod] || Tables.AMPACITY_TABLES.B1;
    const insulTable = methodTable[cableInsulation] || methodTable.PVC;
    const ampacityData = insulTable[loadedConductors] || insulTable[2];

    const targetAmpacity = IB / (fCorrection || 1.0);

    let selectedSection = Tables.MIN_EV_WIRE_SECTION; // Mínimo 2.5mm²
    let foundSectionByAmpacity = false;

    for (let s of Tables.WIRE_SECTIONS) {
      if (s >= Tables.MIN_EV_WIRE_SECTION && ampacityData[s] && ampacityData[s] >= targetAmpacity) {
        selectedSection = s;
        foundSectionByAmpacity = true;
        break;
      }
    }

    if (!foundSectionByAmpacity) {
      selectedSection = Tables.WIRE_SECTIONS[Tables.WIRE_SECTIONS.length - 1];
    }

    // Verificação de Queda de Tensão (máx 4.0%)
    let dropPercent = 0;
    let finalSection = selectedSection;

    for (let s of Tables.WIRE_SECTIONS) {
      if (s < selectedSection) continue;

      let deltaU = 0;
      if (isThreePhase) {
        // Delta U = sqrt(3) * I * L * (rho/S * cosPhi + x * sinPhi)
        const resistance = (rho / s);
        const impedance = (resistance * cosPhi + xReactance * sinPhi);
        deltaU = Math.sqrt(3) * distance * IB * impedance;
      } else {
        // Delta U = 2 * I * L * (rho/S * cosPhi + x * sinPhi)
        const resistance = (rho / s);
        const impedance = (resistance * cosPhi + xReactance * sinPhi);
        deltaU = 2 * distance * IB * impedance;
      }

      dropPercent = (deltaU / circuitVoltage) * 100;

      if (dropPercent <= maxDropAllowed) {
        finalSection = s;
        break;
      }
      finalSection = s;
    }

    // Recalcula a queda com a seção final selecionada
    let finalDeltaU = 0;
    if (isThreePhase) {
      finalDeltaU = Math.sqrt(3) * distance * IB * ((rho / finalSection) * cosPhi + xReactance * sinPhi);
    } else {
      finalDeltaU = 2 * distance * IB * ((rho / finalSection) * cosPhi + xReactance * sinPhi);
    }
    const finalDropPercent = Math.round(((finalDeltaU / circuitVoltage) * 100) * 100) / 100;

    // Capacidade real corrigida do cabo escolhido (Iz)
    const baseAmpacity = ampacityData[finalSection] || targetAmpacity;
    const Iz = Math.round(baseAmpacity * fCorrection * 10) / 10;

    // Seleção e Coordenação do Disjuntor Comercial (IB <= In <= Iz)
    let breakerRating = Tables.getNextCommercialBreaker(IB);

    // Se In > Iz, deve-se elevar a seção do condutor para garantir a proteção contra sobrecarga!
    while (breakerRating > Iz && finalSection < Tables.WIRE_SECTIONS[Tables.WIRE_SECTIONS.length - 1]) {
      const curIndex = Tables.WIRE_SECTIONS.indexOf(finalSection);
      if (curIndex !== -1 && curIndex < Tables.WIRE_SECTIONS.length - 1) {
        finalSection = Tables.WIRE_SECTIONS[curIndex + 1];
        const newBase = ampacityData[finalSection] || 999;
        const newIz = newBase * fCorrection;
        if (breakerRating <= newIz) break;
      } else {
        break;
      }
    }

    // Condutor de proteção (PE) segundo Tabela 58 da NBR 5410
    const peSection = Tables.calculateProtectiveConductor(finalSection);

    // Condutor Neutro
    const neutralSection = isThreePhase ? (finalSection > 25 ? finalSection / 2 : finalSection) : finalSection;

    // Tipo de polos do disjuntor
    let breakerPoles = 'Bipolar (2P)';
    if (isThreePhase) {
      breakerPoles = 'Tetrapolar (3P+N) ou Tripolar (3P)';
    } else if (phaseConfig === 'L1-N' || phaseConfig === 'L2-N' || phaseConfig === 'L3-N') {
      breakerPoles = 'Bipolar (F+N seccionado) ou Monopolar';
    }

    // Especificação de DR e DPS
    const drSpec = 'DR 30mA Tipo A + RDC-DD 6mA DC (conforme NBR 17019 / IEC 62955) ou DR Tipo B';
    const dpsSpec = `DPS Classe II, In >= 20kA, Imax >= 40kA, Uc >= ${Math.round(circuitVoltage * 1.25)}V`;

    return {
      id: charger.id,
      name: charger.name,
      nominalCurrent: Inom,
      projectCurrent: Math.round(IB * 10) / 10,
      phaseConfig,
      powerKW,
      circuitVoltage,
      isThreePhase,
      cableSection: finalSection,
      neutralSection,
      peSection,
      baseAmpacity,
      correctedAmpacity: Iz,
      voltageDropVolts: Math.round(finalDeltaU * 10) / 10,
      voltageDropPercent: finalDropPercent,
      voltageDropCompliant: finalDropPercent <= maxDropAllowed,
      recommendedBreaker: breakerRating,
      breakerPoles,
      breakerCurvature: 'Curva B ou C (NBR NM 60898 ou NBR IEC 60947-2)',
      drSpec,
      dpsSpec,
      cableConductorsText: isThreePhase ? `3F + N (${finalSection} mm²) + PE (${peSection} mm²)` : `2x${finalSection} mm² + PE (${peSection} mm²)`
    };
  }

  /**
   * Cálculo da distribuição de corrente por fase e verificação do disjuntor geral
   */
  function calculatePhaseDistribution(params) {
    const { supplyType, voltageV, mainBreaker, existingDemand, existingDemandUnit, sizedChargers, continuousMargin } = params;

    // Demandas existentes por fase (em Ampères)
    let existA = 0;
    let existB = 0;
    let existC = 0;
    let hasExistingData = false;

    if (existingDemand !== undefined && existingDemand !== null && existingDemand !== '') {
      if (typeof existingDemand === 'object') {
        existA = parseFloat(existingDemand.L1) || 0;
        existB = parseFloat(existingDemand.L2) || 0;
        existC = parseFloat(existingDemand.L3) || 0;
        hasExistingData = (existA + existB + existC) > 0;
      } else {
        const val = parseFloat(existingDemand) || 0;
        if (val > 0) {
          hasExistingData = true;
          if (existingDemandUnit === 'kVA') {
            // Conversão de kVA para A
            if (supplyType === 'monofasica') {
              existA = (val * 1000) / voltageV.nominal;
            } else if (supplyType === 'bifasica') {
              existA = (val * 1000) / (2 * voltageV.fn);
              existB = existA;
            } else {
              // Trifásica
              const perPhase = (val * 1000) / (Math.sqrt(3) * voltageV.ff);
              existA = perPhase;
              existB = perPhase;
              existC = perPhase;
            }
          } else {
            // Ampères
            if (supplyType === 'monofasica') {
              existA = val;
            } else if (supplyType === 'bifasica') {
              existA = val / 2;
              existB = val / 2;
            } else {
              existA = val / 3;
              existB = val / 3;
              existC = val / 3;
            }
          }
        }
      }
    }

    // Demanda de recarga por fase (Nominal e Projeto com Margem)
    let evNomA = 0, evNomB = 0, evNomC = 0;
    let evProjA = 0, evProjB = 0, evProjC = 0;

    sizedChargers.forEach(ch => {
      const inom = ch.nominalCurrent;
      const iproj = ch.projectCurrent;
      const cfg = ch.phaseConfig;

      if (cfg === '3F') {
        evNomA += inom;
        evNomB += inom;
        evNomC += inom;
        evProjA += iproj;
        evProjB += iproj;
        evProjC += iproj;
      } else if (cfg === 'L1-N') {
        evNomA += inom;
        evProjA += iproj;
      } else if (cfg === 'L2-N') {
        evNomB += inom;
        evProjB += iproj;
      } else if (cfg === 'L3-N') {
        evNomC += inom;
        evProjC += iproj;
      } else if (cfg === 'L1-L2') {
        evNomA += inom;
        evNomB += inom;
        evProjA += iproj;
        evProjB += iproj;
      } else if (cfg === 'L2-L3') {
        evNomB += inom;
        evNomC += inom;
        evProjB += iproj;
        evProjC += iproj;
      } else if (cfg === 'L3-L1') {
        evNomC += inom;
        evNomA += inom;
        evProjC += iproj;
        evProjA += iproj;
      }
    });

    // Totais combinados
    const totalProjA = Math.round((existA + evProjA) * 10) / 10;
    const totalProjB = Math.round((existB + evProjB) * 10) / 10;
    const totalProjC = Math.round((existC + evProjC) * 10) / 10;

    const maxTotalPhase = Math.max(totalProjA, totalProjB, totalProjC);
    const maxEvPhase = Math.max(evProjA, evProjB, evProjC);

    // Avaliação contra disjuntor geral
    let isMainBreakerKnown = mainBreaker !== null && mainBreaker > 0;
    let isOverloaded = false;
    let overloadDetails = [];
    let availableCapA = isMainBreakerKnown ? Math.max(0, mainBreaker - existA) : null;
    let availableCapB = isMainBreakerKnown ? Math.max(0, mainBreaker - existB) : null;
    let availableCapC = isMainBreakerKnown ? Math.max(0, mainBreaker - existC) : null;

    if (isMainBreakerKnown) {
      if (totalProjA > mainBreaker) {
        isOverloaded = true;
        overloadDetails.push(`Fase A: ${totalProjA}A excede o disjuntor geral de ${mainBreaker}A em +${(totalProjA - mainBreaker).toFixed(1)}A`);
      }
      if (supplyType !== 'monofasica' && totalProjB > mainBreaker) {
        isOverloaded = true;
        overloadDetails.push(`Fase B: ${totalProjB}A excede o disjuntor geral de ${mainBreaker}A em +${(totalProjB - mainBreaker).toFixed(1)}A`);
      }
      if (supplyType === 'trifasica' && totalProjC > mainBreaker) {
        isOverloaded = true;
        overloadDetails.push(`Fase C: ${totalProjC}A excede o disjuntor geral de ${mainBreaker}A em +${(totalProjC - mainBreaker).toFixed(1)}A`);
      }
    }

    // Cálculo do desequilíbrio entre fases para trifásico
    let unbalancePercent = 0;
    if (supplyType === 'trifasica') {
      const avg = (totalProjA + totalProjB + totalProjC) / 3;
      if (avg > 0) {
        const maxDev = Math.max(Math.abs(totalProjA - avg), Math.abs(totalProjB - avg), Math.abs(totalProjC - avg));
        unbalancePercent = Math.round((maxDev / avg) * 100 * 10) / 10;
      }
    }

    return {
      hasExistingData,
      isMainBreakerKnown,
      mainBreaker,
      isOverloaded,
      overloadDetails,
      unbalancePercent,
      phases: {
        A: {
          existing: Math.round(existA * 10) / 10,
          evNominal: Math.round(evNomA * 10) / 10,
          evProject: Math.round(evProjA * 10) / 10,
          totalProject: totalProjA,
          availableBeforeEV: availableCapA !== null ? Math.round(availableCapA * 10) / 10 : 'Pendente'
        },
        B: {
          existing: Math.round(existB * 10) / 10,
          evNominal: Math.round(evNomB * 10) / 10,
          evProject: Math.round(evProjB * 10) / 10,
          totalProject: totalProjB,
          availableBeforeEV: availableCapB !== null ? Math.round(availableCapB * 10) / 10 : 'Pendente'
        },
        C: {
          existing: Math.round(existC * 10) / 10,
          evNominal: Math.round(evNomC * 10) / 10,
          evProject: Math.round(evProjC * 10) / 10,
          totalProject: totalProjC,
          availableBeforeEV: availableCapC !== null ? Math.round(availableCapC * 10) / 10 : 'Pendente'
        }
      },
      maxTotalPhase,
      maxEvPhase,
      maxPhaseProject: maxTotalPhase
    };
  }

  /**
   * Cenário A: Alimentador Único até Quadro Secundário (QGBT-EV)
   */
  function calculateScenarioA(params) {
    const {
      activeChargers,
      distance,
      supplyType,
      voltageV,
      cableInsulation,
      installMethod,
      fTemp,
      rho,
      cosPhi,
      sinPhi,
      xReactance,
      maxDropAllowed,
      phaseSummary
    } = params;

    // Corrente de projeto do alimentador: maior corrente de projeto de fase dos carregadores
    const feederIB = phaseSummary.maxEvPhase;
    const isThreePhase = supplyType === 'trifasica';
    const loadedConductors = isThreePhase ? 3 : 2;
    const circuitVoltage = isThreePhase ? voltageV.ff : (supplyType === 'bifasica' ? voltageV.ff : voltageV.fn);

    // Alimentador único: circuito individual no percurso (fAgrup = 1.0 ou conforme instalação geral)
    const fCorrectionFeeder = fTemp * 1.0;

    const methodTable = Tables.AMPACITY_TABLES[installMethod] || Tables.AMPACITY_TABLES.B1;
    const insulTable = methodTable[cableInsulation] || methodTable.PVC;
    const ampacityData = insulTable[loadedConductors] || insulTable[2];

    const targetAmpacity = feederIB / fCorrectionFeeder;

    // Seleciona seção por ampacidade
    let selectedSection = Tables.MIN_EV_WIRE_SECTION;
    for (let s of Tables.WIRE_SECTIONS) {
      if (s >= Tables.MIN_EV_WIRE_SECTION && ampacityData[s] && ampacityData[s] >= targetAmpacity) {
        selectedSection = s;
        break;
      }
    }

    // Limite de queda de tensão sugerido no alimentador (<= 2% para sobrar margem nos circuitos terminais locais)
    const feederDropLimit = Math.min(2.0, maxDropAllowed * 0.5);
    let finalSection = selectedSection;
    let dropPercent = 0;

    for (let s of Tables.WIRE_SECTIONS) {
      if (s < selectedSection) continue;
      let deltaU = 0;
      if (isThreePhase) {
        deltaU = Math.sqrt(3) * distance * feederIB * ((rho / s) * cosPhi + xReactance * sinPhi);
      } else {
        deltaU = 2 * distance * feederIB * ((rho / s) * cosPhi + xReactance * sinPhi);
      }
      dropPercent = (deltaU / circuitVoltage) * 100;
      if (dropPercent <= feederDropLimit) {
        finalSection = s;
        break;
      }
      finalSection = s;
    }

    // Recalcula queda exata
    let finalDeltaU = 0;
    if (isThreePhase) {
      finalDeltaU = Math.sqrt(3) * distance * feederIB * ((rho / finalSection) * cosPhi + xReactance * sinPhi);
    } else {
      finalDeltaU = 2 * distance * feederIB * ((rho / finalSection) * cosPhi + xReactance * sinPhi);
    }
    const finalDropPercent = Math.round(((finalDeltaU / circuitVoltage) * 100) * 100) / 100;

    const baseAmpacity = ampacityData[finalSection] || targetAmpacity;
    const Iz = Math.round(baseAmpacity * fCorrectionFeeder * 10) / 10;

    // Disjuntor do Alimentador no Quadro Geral (QGBT)
    let feederBreaker = Tables.getNextCommercialBreaker(feederIB);
    while (feederBreaker > Iz && finalSection < Tables.WIRE_SECTIONS[Tables.WIRE_SECTIONS.length - 1]) {
      const curIdx = Tables.WIRE_SECTIONS.indexOf(finalSection);
      if (curIdx !== -1 && curIdx < Tables.WIRE_SECTIONS.length - 1) {
        finalSection = Tables.WIRE_SECTIONS[curIdx + 1];
        const newIz = (ampacityData[finalSection] || 999) * fCorrectionFeeder;
        if (feederBreaker <= newIz) break;
      } else {
        break;
      }
    }

    const peSection = Tables.calculateProtectiveConductor(finalSection);
    const neutralSection = isThreePhase ? (finalSection > 25 ? finalSection / 2 : finalSection) : finalSection;

    // Infraestrutura no Quadro Secundário
    const subpanelItems = {
      enclosure: `Quadro de Distribuição Secundário (QGBT-EV) sobrepor ou embutir, grau de proteção mínimo IP${installMethod === 'F' ? '65' : '54'}`,
      mainDisconnector: `Chave seccionadora ou disjuntor geral de entrada no QGBT-EV de ${feederBreaker}A`,
      branchBreakers: activeChargers.map(ch => ({
        name: ch.name,
        breaker: `${ch.recommendedBreaker}A (${ch.breakerPoles})`,
        dr: 'DR 30mA Tipo A (com RDC-DD 6mA) ou Tipo B'
      })),
      surgeProtection: '1x Conjunto DPS Classe II (20kA / 40kA) instalado na barra do subquadro',
      emergencyStop: 'Botão de emergência cogumelo para desenergização de todos os pontos de recarga integrável à bobina de disparo do geral'
    };

    return {
      title: 'Cenário A — Alimentador Único + Quadro Secundário (QGBT-EV)',
      feederProjectCurrent: feederIB,
      cableSection: finalSection,
      neutralSection,
      peSection,
      cableDescription: isThreePhase ? `Cabo multipolar ou unipolares 3x${finalSection} + ${neutralSection} + PE ${peSection} mm²` : `2x${finalSection} + PE ${peSection} mm²`,
      breakerRating: feederBreaker,
      breakerPoles: isThreePhase ? 'Tripolar ou Tetrapolar' : 'Bipolar',
      voltageDropPercent: finalDropPercent,
      subpanel: subpanelItems,
      conduitOccupancy: 'Baixa (apenas 1 alimentador no trajeto longo)',
      estimatedCableRunMeters: distance + (activeChargers.length * 3) // 3m para conexões locais do subquadro
    };
  }

  /**
   * Cenário B: Circuitos Independentes Diretos desde o Quadro Principal
   */
  function calculateScenarioB(params) {
    const { sizedChargers, distance, installMethod, cableInsulation } = params;

    const totalCablesMeters = sizedChargers.length * distance;
    const branchCircuits = sizedChargers.map(ch => ({
      name: ch.name,
      cable: ch.cableConductorsText,
      phaseSection: ch.cableSection,
      peSection: ch.peSection,
      breaker: `${ch.recommendedBreaker}A (${ch.breakerPoles})`,
      dr: ch.drSpec,
      voltageDrop: `${ch.voltageDropPercent}%`
    }));

    return {
      title: 'Cenário B — Circuitos Independentes Diretos do Quadro Geral',
      chargersCount: sizedChargers.length,
      branchCircuits,
      totalCableRunMeters: totalCablesMeters,
      conduitOccupancy: `${sizedChargers.length} circuitos independentes agrupados na mesma tubulação/eletrocalha`,
      dpsRequirement: 'Necessário verificar se o QGBT existente possui DPS Classe II coordenado ou instalar DPS por circuito.',
      pros: [
        'Dispensa a instalação de um novo quadro secundário',
        'Topologia simples e direta para distâncias curtas'
      ],
      cons: [
        'Múltiplos circuitos paralelos ocupando eletrodutos ou calhas no trajeto',
        'Exige fator de agrupamento desfavorável (derating térmico dos cabos)',
        'Maior consumo total de cobre em distâncias longas',
        'Ocupação de muitos módulos reserva no quadro existente'
      ]
    };
  }

  /**
   * Comparativo técnico objetivo entre Cenário A e Cenário B
   */
  function compareScenarios(scenarioA, scenarioB, distance, chargersCount) {
    let recommendedScenario = 'A';
    let rationale = '';

    if (chargersCount === 1) {
      recommendedScenario = 'B';
      rationale = 'Para apenas 1 carregador, a instalação de um circuito independente direto (Cenário B) é mais econômica e técnica, dispensando o custo e o espaço de um quadro secundário adicional.';
    } else if (distance <= 12 && chargersCount <= 2) {
      recommendedScenario = 'B';
      rationale = `Com distância curta (${distance}m) e apenas 2 carregadores, o Cenário B (circuitos diretos) é viável e evita a despesa de um novo subquadro, desde que o quadro existente possua espaço disponível para os disjuntores e DRs adicionais.`;
    } else {
      recommendedScenario = 'A';
      rationale = `Para ${chargersCount} carregadores e distância de ${distance}m, o Cenário A (Alimentador Único + Subquadro QGBT-EV) é tecnicamente superior: reduz drasticamente a ocupação das tubulações, evita derating térmico severo por agrupamento de circuitos longos, economiza cobre e centraliza a proteção e o botão de emergência junto às vagas de recarga.`;
    }

    return {
      recommendedScenario,
      rationale,
      scenarioAAdvantages: [
        'Apenas 1 alimentador no trajeto longo, simplificando passagem em eletrodutos e calhas',
        'Proteções locais (DRs e disjuntores) próximas aos veículos para fácil manobra e rearme',
        'Possibilita integração centralizada de botão de desligamento de emergência',
        'Facilita futuras ampliações de novos pontos de recarga'
      ],
      scenarioBAdvantages: [
        'Sem custo de carcaça e barramento de subquadro dedicado',
        'Ideal e direto para apenas 1 ponto de recarga ou trajetos muito curtos'
      ]
    };
  }

  return {
    calculateInstallation,
    getVoltages,
    sizeIndividualCharger,
    calculatePhaseDistribution,
    calculateScenarioA,
    calculateScenarioB,
    compareScenarios
  };
}));
