/**
 * LIGVOLT - Regras de Segurança, Conformidade e Normas Brasileiras
 * ABNT NBR 5410, ABNT NBR 17019, IEC 61851 e Nota CHEMG 326/2025 (CBMERJ)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LigvoltCompliance = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Definição dos 13 itens essenciais de segurança e conformidade
   * 
   * isBlocker = true: Impede a instalação no local nas condições vigentes (gera 'NÃO APTO')
   * isBlocker = false: É uma inadequação sanável via projeto/obra de adequação (gera 'APTO COM ADEQUAÇÕES')
   */
  const CHECKLIST_ITEMS = [
    {
      id: 'item_location',
      title: '1. Localização da Instalação',
      category: 'Ambiente & Incêndio',
      classification: 'Normativo / Regulatório',
      description: 'Ambiente onde os veículos serão recarregados (área externa, garagem aberta, garagem fechada ou subsolo). Garagens em subsolos ou fechadas exigem atenção especial a rotas de fuga e combate a incêndio.',
      normativeRef: 'NBR 17019 / Nota CBMERJ 326/2025',
      options: [
        { value: 'adequado', label: 'Adequado (Área externa, térreo coberto ventilado ou com proteção aprovada)' },
        { value: 'inadequado', label: 'Inadequado (Subsolo ou garagem confinada com risco crítico de exaustão/acesso)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: true,
      inadequateRisk: 'Dificuldade de ventilação térmica, concentração de fumaça tóxica em eventual fogo térmico de bateria e restrição para combate pelo Corpo de Bombeiros.'
    },
    {
      id: 'item_sprinklers',
      title: '2. Existência de Sprinklers onde Necessários',
      category: 'Ambiente & Incêndio',
      classification: 'Recomendação CBMERJ / Regulatório',
      description: 'Presença de sistema de chuveiros automáticos (sprinklers) em garagens fechadas ou subsolos. A Nota CHEMG 326/2025 do CBMERJ recomenda explicitamente não instalar recarga em garagens fechadas ou subsolos desprovidos de sprinklers.',
      normativeRef: 'Nota CHEMG 326/2025 CBMERJ',
      options: [
        { value: 'adequado', label: 'Adequado (Possui sprinklers operacionais ou instalação em área externa aberta)' },
        { value: 'inadequado', label: 'Inadequado (Garagem fechada/subsolo sem sistema de sprinklers)' },
        { value: 'nao_aplicavel', label: 'Não aplicável (Área aberta ou térreo ventilado sem exigência)' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: true,
      inadequateRisk: 'Desconformidade com diretriz do CBMERJ (Nota CHEMG 326/2025). Elevado risco em caso de sinistro térmico de baterias de tração em ambientes confinados.'
    },
    {
      id: 'item_panel_integrity',
      title: '3. Capacidade e Conservação do Quadro Elétrico',
      category: 'Infraestrutura Elétrica',
      classification: 'Obrigação Normativa',
      description: 'Espaço físico reserva no quadro (mínimo conforme NBR 5410), barramentos adequados, conexões limpas e ausência de sinais de aquecimento excessivo, oxidação ou degradação.',
      normativeRef: 'NBR 5410 item 6.5.4',
      options: [
        { value: 'adequado', label: 'Adequado (Quadro íntegro, limpo, com espaço reserva e barramentos conformes)' },
        { value: 'inadequado', label: 'Inadequado (Quadro lotado, conexões degradadas ou sem espaço físico)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false, // Sanável através da instalação de subquadro ou reforma do quadro existente
      inadequateRisk: 'Risco de sobreaquecimento e falta de espaço para proteções, exigindo reforma ou instalação de subquadro dedicado.'
    },
    {
      id: 'item_grounding_pe',
      title: '4. Aterramento e Continuidade do Condutor PE',
      category: 'Infraestrutura Elétrica',
      classification: 'Obrigação Normativa',
      description: 'Existência de condutor de proteção (PE) íntegro conectado ao barramento de equipotencialização principal (BEP). Esquema de aterramento prioritário TN-S ou TT com proteção DR conforme NBR 5410 e NBR 17019.',
      normativeRef: 'NBR 5410 item 6.4 / NBR 17019',
      options: [
        { value: 'adequado', label: 'Adequado (Aterramento contínuo com baixa impedância verificado e BEP)' },
        { value: 'inadequado', label: 'Inadequado (Sem aterramento, PE seccionado ou aterramento impróprio)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false, // Sanável mediante adequação do aterramento
      inadequateRisk: 'Risco de choque elétrico letal por contato indireto. Necessário executar/adequar a malha de aterramento para TN-S.'
    },
    {
      id: 'item_dr_dps',
      title: '5. Proteções DR e DPS Adequadas',
      category: 'Proteção & Segurança',
      classification: 'Obrigação Normativa',
      description: 'Dispositivo DR de alta sensibilidade (30mA) Tipo A associado a sensor RDC-DD (6mA DC) ou DR Tipo B dedicado para cada ponto de recarga. Dispositivo de Proteção contra Surtos (DPS) Classe II.',
      normativeRef: 'NBR 17019 item 531.3.4.1 / IEC 62955',
      options: [
        { value: 'adequado', label: 'Adequado (DR Tipo A + 6mA DC ou Tipo B + DPS Classe II instalados)' },
        { value: 'inadequado', label: 'Inadequado (Ausência de DR/DPS ou DR genérico Tipo AC que cega com fuga DC)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false, // Sanável mediante inclusão dos componentes no projeto
      inadequateRisk: 'DR comum Tipo AC fica inoperante diante de correntes contínuas geradas pela recarga do VE, exigindo adequação para Tipo A/B.'
    },
    {
      id: 'item_exclusive_circuits',
      title: '6. Circuitos Exclusivos e Proteções Individuais',
      category: 'Proteção & Segurança',
      classification: 'Obrigação Normativa',
      description: 'Cada tomada ou conector de recarga de veículo elétrico deve ser alimentado por um circuito terminal exclusivo, sendo proibida a derivação para outras cargas ou tomadas.',
      normativeRef: 'NBR 17019 item 559.10.1',
      options: [
        { value: 'adequado', label: 'Adequado (Circuito elétrico 100% exclusivo para cada ponto de recarga)' },
        { value: 'inadequado', label: 'Inadequado (Circuito compartilhado com iluminação, tomadas ou outros aparelhos)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false, // Sanável criando os novos circuitos exclusivos
      inadequateRisk: 'Sobrecargas perigosas e desarmes por soma de cargas. É obrigatório criar circuito terminal dedicado.'
    },
    {
      id: 'item_overcurrent_coord',
      title: '7. Proteção contra Sobrecarga e Curto-Circuito',
      category: 'Proteção & Segurança',
      classification: 'Obrigação Normativa',
      description: 'Disjuntor termomagnético dimensionado e coordenado com os condutores segundo NBR 5410 (IB <= In <= Iz e I2 <= 1,45 Iz), com capacidade de interrupção compatível com a corrente de curto-circuito presumida.',
      normativeRef: 'NBR 5410 item 5.3',
      options: [
        { value: 'adequado', label: 'Adequado (Disjuntor comercial coordenado com a bitola e com o regime contínuo)' },
        { value: 'inadequado', label: 'Inadequado (Disjuntor superdimensionado em relação ao cabo ou subdimensionado)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false, // Sanável instalando os disjuntores calculados
      inadequateRisk: 'Risco de queima de condutores por falta de coordenação entre proteção e cabo.'
    },
    {
      id: 'item_emergency_stop',
      title: '8. Seccionamento e Desligamento de Emergência',
      category: 'Proteção & Segurança',
      classification: 'Recomendação Técnica / Boas Práticas',
      description: 'Dispositivo acessível para seccionamento elétrico de emergência (chave seccionadora geral ou botão cogumelo) em local sinalizado e visível próximo à área de recarga.',
      normativeRef: 'NBR 5410 item 5.6 / IEC 61851',
      options: [
        { value: 'adequado', label: 'Adequado (Botão de emergência ou chave seccionadora de fácil acesso existente)' },
        { value: 'inadequado', label: 'Inadequado (Sem meios de desenergização rápida em caso de sinistro)' },
        { value: 'nao_aplicavel', label: 'Não aplicável (Instalação uniresidencial com quadro acessível)' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false,
      inadequateRisk: 'Dificuldade na desenergização rápida em caso de princípio de incêndio ou anomalia no veículo/cabo.'
    },
    {
      id: 'item_ventilation_safety',
      title: '9. Ventilação e Afastamento de Materiais Inflamáveis',
      category: 'Ambiente & Incêndio',
      classification: 'Recomendação Técnica',
      description: 'Espaço com ventilação natural ou mecânica adequada para dissipação térmica de reatores e cabos, sem estocagem de solventes, tintas ou materiais combustíveis no perímetro de recarga.',
      normativeRef: 'NBR 5410 item 5.2.2 / Nota CBMERJ 326/2025',
      options: [
        { value: 'adequado', label: 'Adequado (Área ventilada, livre de inflamáveis e desobstruída)' },
        { value: 'inadequado', label: 'Inadequado (Presença de depósitos de inflamáveis ou ausência de renovação de ar)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false,
      inadequateRisk: 'Risco de propagação acelerada de fogo para materiais combustíveis estocados próximos.'
    },
    {
      id: 'item_physical_protection',
      title: '10. Sinalização e Proteção Física dos Carregadores',
      category: 'Instalação Física',
      classification: 'Recomendação Técnica',
      description: 'Instalação de balizadores mecânicos (guard-rails, parachoques de piso ou colunas de proteção) para evitar abalroamento do equipamento por manobras de veículos, além de pintura de piso e sinalização vertical.',
      normativeRef: 'NBR 17019 / Boas Práticas de Engenharia',
      options: [
        { value: 'adequado', label: 'Adequado (Carregador protegido contra batidas mecânicas com delimitadores)' },
        { value: 'inadequado', label: 'Inadequado (Equipamento exposto a colisão de veículos durante manobras)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false,
      inadequateRisk: 'Abalroamento do carregador por veículos em manobra, danificando o invólucro e expondo partes vivas.'
    },
    {
      id: 'item_equipment_compliance',
      title: '11. Conformidade dos Equipamentos com Normas Técnicas',
      category: 'Equipamentos',
      classification: 'Obrigação Normativa',
      description: 'Carregador (Wallbox/Totem) homologado conforme ABNT NBR IEC 61851-1, plugue e conector Tipo 2 conforme IEC 62196-2, e certificações compulsórias do Inmetro.',
      normativeRef: 'NBR IEC 61851-1 / IEC 62196-2 / Inmetro',
      options: [
        { value: 'adequado', label: 'Adequado (Wallbox certificado de fabricante idôneo com comunicações Modo 3)' },
        { value: 'inadequado', label: 'Inadequado (Carregador artesanal, improvisado ou sem certificação reconhecida)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de vistoria' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: true, // Carregador artesanal/não homologado é impeditivo normativo direto
      inadequateRisk: 'Equipamento sem certificação técnica formal; risco de arco elétrico e ausência de protocolos de segurança do Modo 3.'
    },
    {
      id: 'item_cbmerj_cert',
      title: '12. Certificado de Aprovação do CBMERJ Válido (se aplicável)',
      category: 'Ambiente & Incêndio',
      classification: 'Regulatório (Condomínios e Comércios)',
      description: 'Certificado de Aprovação (CA) ou AVCB emitido pelo Corpo de Bombeiros Militar vigente na edificação comercial ou condomínio edilício. Nota CHEMG 326/2025.',
      normativeRef: 'CBMERJ Nota CHEMG 326/2025 / Legislação Estadual',
      options: [
        { value: 'adequado', label: 'Adequado (Edificação possui Certificado de Aprovação do CBMERJ regularizado)' },
        { value: 'inadequado', label: 'Inadequado (Certificado vencido ou inexistente em edificação multifamiliar/comercial)' },
        { value: 'nao_aplicavel', label: 'Não aplicável (Residência unifamiliar sem exigência de CA)' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de confirmação' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false,
      inadequateRisk: 'Insegurança jurídica para condomínios e risco de negativa de cobertura de seguro patrimonial.'
    },
    {
      id: 'item_technical_responsibility',
      title: '13. Responsável Técnico Habilitado e Projeto Elétrico',
      category: 'Documentação Técnica',
      classification: 'Obrigação Normativa / Legal',
      description: 'Elaboração de projeto executivo por Engenheiro Eletricista com emissão de Anotação de Responsabilidade Técnica (ART no CREA) e aprovação junto à concessionária de energia quando a demanda exceder os limites contratuais.',
      normativeRef: 'Resolução CONFEA / NBR 5410 / Regras da Concessionária',
      options: [
        { value: 'adequado', label: 'Adequado (Projeto executivo e ART de execução previstos/elaborados por profissional)' },
        { value: 'inadequado', label: 'Inadequado (Instalação sem projeto, sem ART e sem registro formal)' },
        { value: 'nao_aplicavel', label: 'Não aplicável' },
        { value: 'nao_verificado', label: 'Não verificado / Pendente de contratação' }
      ],
      defaultStatus: 'nao_verificado',
      isBlocker: false, // Sanável contratando o profissional e emitindo ART
      inadequateRisk: 'Exercício ilegal da profissão e responsabilidade civil dos proprietários. Deve-se emitir projeto e ART.'
    }
  ];

  return {
    CHECKLIST_ITEMS
  };
}));
