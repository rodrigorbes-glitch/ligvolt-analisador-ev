/**
 * LIGVOLT - Tabelas e Constantes Elétricas Normativas
 * Baseadas na ABNT NBR 5410, ABNT NBR 17019 e IEC 61851
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LigvoltTables = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Seções comerciais padronizadas de condutores de cobre (mm²)
  const WIRE_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

  // Seção mínima para circuitos de força e recarga de VE (NBR 5410 e NBR 17019)
  const MIN_EV_WIRE_SECTION = 2.5; // mm²

  // Disjuntores termomagnéticos padrão DIN (A)
  const COMMERCIAL_BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 150, 160, 175, 200, 225, 250, 315, 400];

  /**
   * Capacidade de Condução de Corrente (Ampacidade) em Ampères para Condutores de Cobre.
   * Tabela 36 (PVC 70°C) e Tabela 37 (XLPE/EPR 90°C) da ABNT NBR 5410.
   * Temperatura ambiente de referência: 30°C no ar.
   */
  const AMPACITY_TABLES = {
    // Método B1: Condutores isolados em eletroduto de seção circular sobre parede ou embutido em alvenaria
    B1: {
      PVC: {
        2: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125, 50: 151, 70: 192, 95: 232, 120: 269, 150: 300, 185: 341, 240: 400 },
        3: { 1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110, 50: 134, 70: 171, 95: 207, 120: 239, 150: 272, 185: 310, 240: 364 }
      },
      XLPE: {
        2: { 1.5: 23, 2.5: 31, 4: 42, 6: 54, 10: 75, 16: 100, 25: 133, 35: 164, 50: 198, 70: 253, 95: 306, 120: 354, 150: 407, 185: 464, 240: 546 },
        3: { 1.5: 22, 2.5: 29, 4: 38, 6: 49, 10: 68, 16: 91, 25: 121, 35: 150, 50: 181, 70: 232, 95: 282, 120: 328, 150: 378, 185: 431, 240: 508 }
      }
    },
    // Método B2: Cabo multipolar em eletroduto sobre parede
    B2: {
      PVC: {
        2: { 1.5: 16.5, 2.5: 23, 4: 30, 6: 38, 10: 52, 16: 69, 25: 90, 35: 111, 50: 133, 70: 168, 95: 201, 120: 232, 150: 258, 185: 294, 240: 344 },
        3: { 1.5: 15, 2.5: 20, 4: 27, 6: 34, 10: 46, 16: 62, 25: 80, 35: 99, 50: 118, 70: 149, 95: 179, 120: 206, 150: 236, 185: 268, 240: 315 }
      },
      XLPE: {
        2: { 1.5: 22, 2.5: 30, 4: 40, 6: 51, 10: 69, 16: 91, 25: 119, 35: 146, 50: 175, 70: 221, 95: 265, 120: 305, 150: 349, 185: 395, 240: 462 },
        3: { 1.5: 21, 2.5: 28, 4: 36, 6: 46, 10: 63, 16: 83, 25: 110, 35: 135, 50: 162, 70: 207, 95: 251, 120: 290, 150: 332, 185: 376, 240: 442 }
      }
    },
    // Método C: Cabos unipolares ou multipolares fixados diretamente em parede de alvenaria ou teto
    C: {
      PVC: {
        2: { 1.5: 19.5, 2.5: 27, 4: 36, 6: 46, 10: 63, 16: 85, 25: 112, 35: 138, 50: 168, 70: 213, 95: 258, 120: 299, 150: 344, 185: 392, 240: 461 },
        3: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 96, 35: 119, 50: 144, 70: 184, 95: 223, 120: 259, 150: 299, 185: 341, 240: 403 }
      },
      XLPE: {
        2: { 1.5: 24, 2.5: 33, 4: 45, 6: 58, 10: 80, 16: 107, 25: 138, 35: 171, 50: 209, 70: 269, 95: 328, 120: 382, 150: 441, 185: 506, 240: 599 },
        3: { 1.5: 23, 2.5: 31, 4: 42, 6: 54, 10: 75, 16: 100, 25: 127, 35: 158, 50: 192, 70: 246, 95: 298, 120: 346, 150: 399, 185: 456, 240: 538 }
      }
    },
    // Método F: Cabos unipolares justapostos ao ar livre ou em leito / bandeja perfurada
    F: {
      PVC: {
        2: { 1.5: 22, 2.5: 30, 4: 40, 6: 52, 10: 71, 16: 96, 25: 128, 35: 157, 50: 190, 70: 242, 95: 293, 120: 339, 150: 389, 185: 444, 240: 522 },
        3: { 1.5: 20, 2.5: 28, 4: 37, 6: 48, 10: 66, 16: 88, 25: 114, 35: 140, 50: 170, 70: 216, 95: 262, 120: 303, 150: 348, 185: 397, 240: 467 }
      },
      XLPE: {
        2: { 1.5: 26, 2.5: 36, 4: 49, 6: 63, 10: 86, 16: 115, 25: 149, 35: 184, 50: 225, 70: 289, 95: 352, 120: 410, 150: 473, 185: 542, 240: 641 },
        3: { 1.5: 24, 2.5: 33, 4: 45, 6: 58, 10: 80, 16: 107, 25: 135, 35: 169, 50: 207, 70: 268, 95: 328, 120: 383, 150: 444, 185: 510, 240: 607 }
      }
    }
  };

  /**
   * Fatores de correção por temperatura ambiente diferente de 30°C (Tabela 40 NBR 5410)
   */
  const TEMP_CORRECTION_FACTORS = {
    PVC: { 20: 1.12, 25: 1.06, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.50 },
    XLPE: { 20: 1.08, 25: 1.04, 30: 1.00, 35: 0.96, 40: 0.91, 45: 0.87, 50: 0.82, 55: 0.76, 60: 0.71 }
  };

  /**
   * Fatores de agrupamento para circuitos em feixe ou mesmo eletroduto (Tabela 42 NBR 5410)
   */
  const GROUPING_CORRECTION_FACTORS = {
    1: 1.00,
    2: 0.80,
    3: 0.70,
    4: 0.65,
    5: 0.60,
    6: 0.57,
    7: 0.54,
    8: 0.52,
    9: 0.50,
    12: 0.45,
    16: 0.41,
    20: 0.38
  };

  /**
   * Resistividade do cobre a temperaturas de regime (Ω·mm²/m)
   * NBR 5410 / IEC 60287:
   * PVC 70°C: ~0.0215 Ω·mm²/m
   * XLPE 90°C: ~0.0230 Ω·mm²/m
   */
  const COPPER_RESISTIVITY = {
    PVC: 0.0215,
    XLPE: 0.0230
  };

  // Reatância indutiva média de condutores de baixa tensão (Ω/m)
  const REACTANCE_X = 0.00008; // 0.08 mΩ/m

  /**
   * Retorna o fator de agrupamento
   */
  function getGroupingFactor(circuitsCount) {
    const count = Math.max(1, Math.round(circuitsCount || 1));
    if (count in GROUPING_CORRECTION_FACTORS) {
      return GROUPING_CORRECTION_FACTORS[count];
    }
    if (count > 20) return 0.35;
    // Interpolação aproximada para valores intermediários
    const keys = Object.keys(GROUPING_CORRECTION_FACTORS).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < keys.length - 1; i++) {
      if (count > keys[i] && count < keys[i + 1]) {
        return GROUPING_CORRECTION_FACTORS[keys[i + 1]];
      }
    }
    return 0.50;
  }

  /**
   * Retorna o fator de correção por temperatura
   */
  function getTempFactor(insulation, ambientTemp = 30) {
    const table = TEMP_CORRECTION_FACTORS[insulation] || TEMP_CORRECTION_FACTORS.PVC;
    const temp = Math.round(ambientTemp / 5) * 5;
    const clamped = Math.max(20, Math.min(60, temp));
    return table[clamped] || 1.00;
  }

  /**
   * Dimensões do condutor de proteção (PE) segundo Tabela 58 da NBR 5410
   * @param {number} phaseSection - Seção do condutor de fase (mm²)
   * @returns {number} Seção do condutor PE (mm²)
   */
  function calculateProtectiveConductor(phaseSection) {
    if (phaseSection <= 16) {
      return phaseSection;
    } else if (phaseSection <= 35) {
      return 16;
    } else {
      const half = phaseSection / 2;
      // Seleciona a próxima seção comercial padronizada >= half
      for (let s of WIRE_SECTIONS) {
        if (s >= half) return s;
      }
      return half;
    }
  }

  /**
   * Encontra o próximo disjuntor comercial >= corrente requerida
   */
  function getNextCommercialBreaker(targetCurrent) {
    for (let b of COMMERCIAL_BREAKERS) {
      if (b >= targetCurrent) return b;
    }
    return COMMERCIAL_BREAKERS[COMMERCIAL_BREAKERS.length - 1];
  }

  return {
    WIRE_SECTIONS,
    MIN_EV_WIRE_SECTION,
    COMMERCIAL_BREAKERS,
    AMPACITY_TABLES,
    TEMP_CORRECTION_FACTORS,
    GROUPING_CORRECTION_FACTORS,
    COPPER_RESISTIVITY,
    REACTANCE_X,
    getGroupingFactor,
    getTempFactor,
    calculateProtectiveConductor,
    getNextCommercialBreaker
  };
}));
