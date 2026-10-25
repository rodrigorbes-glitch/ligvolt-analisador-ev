/**
 * LIGVOLT - Módulo de Vistoria Preliminar Inteligente com IA
 * Gerencia o fluxo guiado em 4 etapas, captura/compressão de fotos, análise multimodal e laudo preliminar
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LigvoltSmartInspection = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Categorias padronizadas de fotografias
  const PHOTO_CATEGORIES = [
    {
      key: 'quadro_geral',
      title: '1. Foto Geral do Quadro Elétrico',
      shortTitle: 'Quadro Geral',
      icon: '⚡',
      description: 'Foto afastada mostrando o quadro inteiro fechado ou com a tampa plástica frontal, para ver o tamanho e espaço ao redor.',
      required: true,
      tip: 'Enquadre o quadro elétrico de frente, com boa iluminação.'
    },
    {
      key: 'disjuntores',
      title: '2. Foto Aproximada dos Disjuntores e Etiquetas',
      shortTitle: 'Disjuntores & Etiquetas',
      icon: '🔍',
      description: 'Foto nítida e bem próxima dos disjuntores para que os números de corrente (ex: C32, C50, C63) e etiquetas fiquem legíveis.',
      required: true,
      tip: 'Aproxime a câmera e evite reflexos nos visores dos disjuntores.'
    },
    {
      key: 'padrao_entrada',
      title: '3. Foto do Padrão / Medidor de Entrada',
      shortTitle: 'Medidor da Concessionária',
      icon: '🏢',
      description: 'Foto da caixa de medição da concessionária (relógio de luz), se for de fácil e seguro acesso.',
      required: false,
      tip: 'Apenas se for de fácil acesso. Não tente abrir caixas lacradas.'
    },
    {
      key: 'local_vaga',
      title: '4. Foto do Local Pretendido para o Carregador',
      shortTitle: 'Local da Vaga',
      icon: '🚗',
      description: 'Foto da vaga de estacionamento ou parede onde o carregador (Wallbox) ou tomada deverá ser fixado.',
      required: true,
      tip: 'Mostre a parede ou coluna onde o equipamento ficará posicionado.'
    },
    {
      key: 'trajeto_cabos',
      title: '5. Foto do Caminho dos Cabos (Opcional)',
      shortTitle: 'Trajeto dos Cabos',
      icon: '📏',
      description: 'Foto do teto, parede, shaft ou piso por onde os cabos elétricos deverão passar do quadro até a vaga.',
      required: false,
      tip: 'Ajuda a estimar tubulações, calhas e curvas necessárias.'
    },
    {
      key: 'protecoes_dps_dr',
      title: '6. Foto das Proteções Existentes (DR / DPS)',
      shortTitle: 'Proteções DR / DPS',
      icon: '🛡️',
      description: 'Se houver disjuntor DR (com botão "T" de teste) ou módulos DPS (cartuchos protetores), fotografe em detalhe.',
      required: false,
      tip: 'Identifica se o quadro já possui proteção contra choques e raios.'
    }
  ];

  /**
   * Comprime uma imagem no navegador utilizando Canvas
   * Ajusta resolução e qualidade de acordo com a necessidade (alta fidelidade para leitura OCR de disjuntores)
   */
  function compressImage(file, maxDimension = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const sizeBytes = Math.round((compressedDataUrl.length * 3) / 4);
          const sizeKB = Math.round(sizeBytes / 1024);
          const base64 = compressedDataUrl.includes('base64,') ? compressedDataUrl.split('base64,')[1] : '';

          resolve({
            dataUrl: compressedDataUrl,
            base64,
            width,
            height,
            sizeKB,
            mimeType: 'image/jpeg'
          });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Avalia as respostas e fotos da vistoria e gera o Diagnóstico Preliminar
   * Aplica regras estritas de confiabilidade (NBR 5410, NBR 17019, CBMERJ 326/2025)
   */
  function evaluateInspectionViability(inspectionState) {
    const { localData, confirmations, aiAnalysis, photos } = inspectionState;

    const problemsFound = [];
    const criticalActions = [];
    const necessaryActions = [];
    const recommendedActions = [];
    const pendingVerifications = [];

    let isBlocked = false;
    let blockReason = '';

    // 0. ANÁLISE DE ALIMENTAÇÃO E TENSÃO (CONDIÇÕES ELÉTRICAS DE ENTRADA)
    if (localData && localData.supplyType === 'nao_sei') {
      problemsFound.push({
        title: 'Tipo de alimentação elétrica não confirmado',
        description: 'Não foi possível confirmar o número de fases (monofásica, bifásica ou trifásica). Foi adotado o padrão operacional bifásico como sugestão preliminar.',
        severity: 'necessaria',
        evidence: 'Declarado como desconhecido na vistoria'
      });
      pendingVerifications.push('Identificar o número de condutores de fase no ramal de entrada / medidor da concessionária.');
      necessaryActions.push('Confirmar o número de fases no padrão de entrada antes da compra de materiais.');
    }

    if (localData && localData.voltagePreset === 'nao_sei') {
      problemsFound.push({
        title: 'Tensão elétrica nominal não confirmada',
        description: 'A tensão de fornecimento (127V, 220V ou 380V) não foi confirmada.',
        severity: 'necessaria',
        evidence: 'Declarado como desconhecido na vistoria'
      });
      pendingVerifications.push('Medir a tensão fase-neutro e fase-fase com multímetro no quadro principal.');
      necessaryActions.push('Aferir tensões de fornecimento reais com multímetro na visita técnica.');
    }

    // 1. ANÁLISE DE LOCALIZAÇÃO E INCÊNDIO (CBMERJ CHEMG 326/2025 E SEGURANÇA)
    const isRioDeJaneiro = localData.cityState && localData.cityState.toUpperCase().includes('RJ');
    const isSubsoloOuFechada = localData.installArea === 'subsolo' || localData.installArea === 'garagem_fechada';

    if (isSubsoloOuFechada) {
      if (confirmations.cbmerjSprinklers === 'nao') {
        isBlocked = true;
        blockReason = 'Garagem fechada ou subsolo desprovido de chuveiros automáticos (sprinklers). A Nota CHEMG 326/2025 do CBMERJ recomenda expressamente não instalar recarga nessas condições.';
        problemsFound.push({
          title: 'Ausência de sprinklers em ambiente fechado/subsolo',
          description: blockReason,
          severity: 'critica',
          evidence: 'Informado na vistoria de localização'
        });
        criticalActions.push('Relocar os pontos de recarga para área externa/térreo aberto ou dotar o pavimento de sistema de sprinklers aprovado pelo Corpo de Bombeiros.');
      } else if (confirmations.cbmerjSprinklers === 'nao_sei') {
        problemsFound.push({
          title: 'Existência de sprinklers pendente de confirmação no subsolo/garagem',
          description: 'A Nota CHEMG 326/2025 do CBMERJ desaconselha recarga em subsolos fechados sem chuveiros automáticos operacionais.',
          severity: 'necessaria',
          evidence: 'Pendente de verificação predial'
        });
        pendingVerifications.push('Verificar com a administração do condomínio a existência e aprovação de sprinklers e rota de exaustão de fumaça.');
      }
    }

    // 2. ATERRAMENTO (CONDIÇÃO BÁSICA DE SEGURANÇA HUMANA)
    if (confirmations.groundingConfirmed === 'nao') {
      problemsFound.push({
        title: 'Aterramento inexistente ou não conectado na instalação',
        description: 'A recarga de veículos elétricos exige condutor de proteção (PE) contínuo e equipotencializado. Sem aterramento há risco crítico de choque na lataria do veículo.',
        severity: 'critica',
        evidence: 'Declaração na etapa de confirmação'
      });
      criticalActions.push('Instalar ou readequar a malha de aterramento em esquema TN-S ou TT conforme ABNT NBR 5410 antes de qualquer energização.');
    } else {
      // Mesmo com barramento visível ou confirmado 'sim', a medição ôhmica é mandatória
      pendingVerifications.push('Medir a resistência de aterramento da malha (R <= 10Ω) e continuidade do PE com terrômetro/alicímetro (a presença física aparente de barramento não comprova eficácia).');
      if (confirmations.groundingConfirmed === 'nao_sei') {
        necessaryActions.push('Realizar teste instrumental de continuidade e resistência de aterramento durante a visita técnica.');
      }
    }

    // 2.1 RISCO TÉRMICO VISUAL
    if (aiAnalysis && aiAnalysis.thermalRiskDetected) {
      problemsFound.push({
        title: 'Indício visual de anomalia ou dano térmico no quadro',
        description: 'Foram identificados indícios visuais de aquecimento excessivo, deformação em plásticos ou oxidação em bornes de conexão.',
        severity: 'critica',
        evidence: 'Identificado na inspeção de fotos pela IA'
      });
      criticalActions.push('Desenergizar o setor afetado e inspecionar/reapertar bornes ou substituir conexões danificadas antes de ligar a recarga.');
    }

    // 3. CAPACIDADE ELÉTRICA E DISJUNTOR GERAL
    const mainBreaker = confirmations.mainBreakerConfirmed;
    if (mainBreaker === 'nao_sei' || mainBreaker === 'ilegivel' || !mainBreaker) {
      problemsFound.push({
        title: 'Capacidade do disjuntor geral da entrada não comprovada',
        description: 'Inscrições ilegíveis ou não confirmadas no corpo dos disjuntores. O sistema não presume nem inventa correntes nominais.',
        severity: 'necessaria',
        evidence: 'Fotos aproximadas dos disjuntores (inscrição ilegível ou não visível)'
      });
      pendingVerifications.push('Verificar o valor nominal do disjuntor geral no medidor da concessionária e analisar a conta de energia.');
      necessaryActions.push('Capturar nova foto nítida e aproximada das inscrições dos disjuntores ou verificar valor no padrão de entrada.');
    } else {
      const breakerNum = parseFloat(mainBreaker);
      const vehicleCount = parseInt(localData.vehicleCount, 10) || 1;
      const isWallbox = localData.chargerType !== 'tomada';
      const estimatedCurrentPerVehicle = isWallbox ? 32 : 16;
      const totalEstimatedEvCurrent = vehicleCount * estimatedCurrentPerVehicle;

      if (breakerNum > 0 && totalEstimatedEvCurrent >= breakerNum) {
        isBlocked = true;
        blockReason = `A potência pretendida dos carregadores (${totalEstimatedEvCurrent}A) atinge ou supera a capacidade total do disjuntor geral (${breakerNum}A).`;
        problemsFound.push({
          title: 'Capacidade do disjuntor geral insuficiente para os carregadores',
          description: blockReason,
          severity: 'critica',
          evidence: `Disjuntor geral de ${breakerNum}A confirmado`
        });
        criticalActions.push(`Solicitar aumento de carga junto à concessionária de energia para padrão compatível ou instalar sistema de gestão dinâmica de carga (DLM).`);
      } else if (confirmations.capacityVerified === 'nao_sei' || (breakerNum > 0 && (breakerNum - totalEstimatedEvCurrent) < 20)) {
        problemsFound.push({
          title: 'Demanda e consumo de pico não medidos na instalação',
          description: `Com o disjuntor de ${breakerNum}A e a recarga consumindo cerca de ${totalEstimatedEvCurrent}A, a folga para chuveiros, ar-condicionado e demais cargas precisa ser aferida.`,
          severity: 'necessaria',
          evidence: `Disjuntor geral ${breakerNum}A com demanda não verificada`
        });
        necessaryActions.push('Fazer medição de corrente com alicate amperímetro nos horários de pico antes de liberar a instalação.');
        pendingVerifications.push('Medir corrente de pico da instalação simultânea com chuveiros e aparelhos de ar-condicionado.');
      }
    }

    // 4. PROTEÇÃO DIFERENCIAL RESIDUAL (DR TIPO A / B)
    if (confirmations.exclusiveCircuitConfirmed === 'nao' || confirmations.exclusiveCircuitConfirmed === 'nao_sei') {
      problemsFound.push({
        title: 'Necessidade de novo circuito terminal exclusivo',
        description: 'A norma ABNT NBR 17019 proíbe terminantemente ligar carregadores de VE em circuitos compartilhados com tomadas ou iluminação existentes.',
        severity: 'necessaria',
        evidence: 'Exigência normativa NBR 17019 item 559.10'
      });
      necessaryActions.push('Instalar circuito elétrico 100% exclusivo desde o quadro até o ponto de recarga, com cabo e disjuntor dedicados.');
    }

    // DR e DPS
    necessaryActions.push('Instalar interruptor DR 30mA Tipo A (com proteção CC 6mA RDC-DD) ou Tipo B individual para o ponto de recarga.');
    recommendedActions.push('Instalar conjunto de protetores contra surtos (DPS Classe II) para salvaguardar a eletrônica do veículo e da estação contra queimas por raios.');

    // 5. ESPAÇO FÍSICO NO QUADRO
    if (confirmations.spaceAvailableConfirmed === 'nao') {
      problemsFound.push({
        title: 'Falta de espaço físico reserva no quadro elétrico atual',
        description: 'O quadro está totalmente ocupado e não comporta novos disjuntores e DR normativos.',
        severity: 'necessaria',
        evidence: 'Foto geral do quadro elétrico'
      });
      necessaryActions.push('Instalar um subquadro elétrico auxiliar ou reformar o quadro atual com caixa de maior módulo conforme NBR 5410.');
    } else if (confirmations.spaceAvailableConfirmed === 'nao_sei') {
      pendingVerifications.push('Avaliar na visita técnica a viabilidade física de acomodação dos novos módulos no trilho DIN.');
    }

    // 6. PROTEÇÃO CONTRA CHUVA / INTEMPÉRIES
    if (localData.installArea === 'externa' && confirmations.rainProtectionConfirmed === 'nao') {
      problemsFound.push({
        title: 'Ponto de recarga ao ar livre sem proteção contra intempéries',
        description: 'O equipamento ficará exposto a chuvas torrenciais, exigindo invólucro com grau de proteção elevado.',
        severity: 'necessaria',
        evidence: 'Foto do local da vaga'
      });
      necessaryActions.push('Utilizar estação de recarga com grau de proteção mínimo IP65 / IK08 e providenciar cobertura protetora ou abrigo metálico.');
    }

    // Recomendações gerais de boas práticas
    recommendedActions.push('Prever delimitadores mecânicos de solo (balizadores ou parachoques) para evitar batidas no carregador durante manobras.');
    recommendedActions.push('Elaborar projeto executivo e emitir Anotação de Responsabilidade Técnica (ART) junto ao CREA.');

    // 7. DETERMINAÇÃO FINAL DO ESTADO
    let state = 'APTO_COM_ADEQUACOES';
    let badge = '🟡 APTO COM ADEQUAÇÕES';
    let badgeClass = 'badge-adequacoes';
    let headline = 'A instalação é viável, mediante a realização das adequações técnicas apontadas.';
    let summary = `Vistoria preliminar para ${localData.vehicleCount || 1} veículo(s) em ${localData.installArea || 'área informada'}.`;

    if (isBlocked) {
      state = 'NAO_APTO';
      badge = '🔴 NÃO APTO NAS CONDIÇÕES ATUAIS';
      badgeClass = 'badge-nao-apto';
      headline = 'Existem impedimentos ou riscos críticos que inviabilizam a instalação imediata.';
      summary = blockReason;
    } else if (pendingVerifications.length >= 3 && (!mainBreaker || mainBreaker === 'nao_sei')) {
      state = 'NECESSITA_VERIFICACAO';
      badge = '⚪ NECESSITA VERIFICAÇÃO TÉCNICA';
      badgeClass = 'badge-incomplete';
      headline = 'Informações insuficientes para atestar a viabilidade com segurança.';
      summary = 'Faltam dados essenciais da entrada de energia ou fotos nítidas do quadro para concluir a triagem preliminar.';
    } else if (criticalActions.length === 0 && necessaryActions.length <= 1 && pendingVerifications.length === 0) {
      state = 'PRELIMINARMENTE_APTO';
      badge = '🟢 PRELIMINARMENTE APTO';
      badgeClass = 'badge-apto';
      headline = 'Não foram identificados impedimentos técnicos aparentes na vistoria.';
      summary = 'A infraestrutura preliminarmente informada aparenta capacidade favorável, sujeita à validação presencial.';
    }

    return {
      state,
      badge,
      badgeClass,
      headline,
      summary,
      problemsFound,
      criticalActions,
      necessaryActions,
      recommendedActions,
      pendingVerifications,
      nextAction: isBlocked
        ? 'Ajustar os impedimentos críticos apontados (verificar local alternativo ou solicitar aumento de carga na concessionária).'
        : 'Agendar a visita técnica de vistoria presencial para medição de carga e validação dos itens identificados.'
    };
  }

  /**
   * Constrói o HTML do Laudo Preliminar de Vistoria para Impressão e PDF
   */
  function buildPreliminaryInspectionReportHTML(inspectionState, diagnosticResult) {
    const { localData, confirmations, aiAnalysis, photos, clientMeta } = inspectionState;
    const diag = diagnosticResult;
    const isSubsoloOuFechada = localData && (localData.installArea === 'subsolo' || localData.installArea === 'garagem_fechada');

    const dateFormatted = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const client = (clientMeta && clientMeta.clientName) || 'Cliente não identificado';
    const address = (clientMeta && clientMeta.address) || localData.cityState || 'Endereço não informado';
    const inspector = (clientMeta && clientMeta.inspectorName) || 'Vistoriador / Aplicativo Ligvolt';
    const notes = (clientMeta && clientMeta.notes) || '';

    let badgeBg = '#15803D';
    let badgeColor = '#FFFFFF';
    if (diag.state === 'NAO_APTO') {
      badgeBg = '#DC2626';
      badgeColor = '#FFFFFF';
    } else if (diag.state === 'APTO_COM_ADEQUACOES') {
      badgeBg = '#CA8A04';
      badgeColor = '#FFFFFF';
    } else if (diag.state === 'NECESSITA_VERIFICACAO') {
      badgeBg = '#64748B';
      badgeColor = '#FFFFFF';
    }

    // Galeria de fotografias capturadas em loco ou anexadas de arquivo
    const photosGalleryHtml = photos && photos.length > 0 ? `
      <div class="report-section">
        <h3 class="section-title">8. Evidências Fotográficas da Vistoria (Registro em Loco / Arquivo)</h3>
        <p style="font-size: 11.5px; color: #475569; margin: 0 0 10px 0;">
          Fotografias capturadas em loco pelo vistoriador ou anexadas de arquivos digitais para comprovação e triagem pericial:
        </p>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 10px;">
          ${photos.map((p, idx) => `
            <div style="border: 1px solid #CBD5E1; border-radius: 8px; padding: 8px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.05); page-break-inside: avoid; break-inside: avoid;">
              <div style="width: 100%; height: 200px; background: #0F172A; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                <img src="${p.dataUrl}" alt="${escapeHtml(p.categoryName)}" style="max-width: 100%; max-height: 100%; object-fit: contain; display: block;" />
              </div>
              <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
                <div>
                  <strong style="font-size: 11.5px; color: #0F172A; display: block;">Foto ${idx + 1}: ${escapeHtml(p.categoryName)}</strong>
                  <span style="font-size: 10.5px; color: #64748B;">Data/Hora: ${escapeHtml(p.timestamp || 'Registrada na vistoria')}</span>
                </div>
                <span style="background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 700; white-space: nowrap;">
                  📸 Registro em Loco
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <div class="report-section">
        <h3 class="section-title">8. Evidências Fotográficas da Vistoria</h3>
        <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: #64748B;">
          📷 Nenhuma evidência fotográfica anexada à vistoria. Para enriquecer o laudo e permitir análise visual assistida por IA, fotografe o quadro e a vaga no Passo 2 da Vistoria Guiada.
        </div>
      </div>
    `;

    return `
    <div class="report-document" id="printableInspectionReport">
      <!-- CABEÇALHO FORMAL -->
      <div class="report-header">
        <div class="report-brand">
          <div class="brand-logo">
            <span class="logo-symbol">⚡</span>
            <span class="logo-name">LIG<span class="logo-highlight">VOLT</span></span>
          </div>
          <span class="report-type-badge">RELATÓRIO PRELIMINAR DE VISTORIA E VIABILIDADE</span>
        </div>
        <div class="report-meta-header">
          <p><strong>Emissão:</strong> ${dateFormatted}</p>
          <p><strong>Normas de Referência:</strong> ABNT NBR 5410, NBR 17019, IEC 61851, CBMERJ 326/2025</p>
        </div>
      </div>

      <!-- 1. IDENTIFICAÇÃO DO LOCAL E DA VISTORIA -->
      <div class="report-section">
        <h3 class="section-title">1. Identificação do Local e da Vistoria</h3>
        <table class="report-table">
          <tr>
            <td style="width: 25%"><strong>Cliente / Solicitante:</strong></td>
            <td style="width: 45%">${escapeHtml(client)}</td>
            <td style="width: 15%"><strong>Data:</strong></td>
            <td style="width: 15%">${dateFormatted.split(' ')[0]}</td>
          </tr>
          <tr>
            <td><strong>Endereço / Local:</strong></td>
            <td colspan="3">${escapeHtml(address)}</td>
          </tr>
          <tr>
            <td><strong>Responsável pela Vistoria:</strong></td>
            <td colspan="3">${escapeHtml(inspector)}</td>
          </tr>
          <tr>
            <td><strong>Características Declaradas:</strong></td>
            <td colspan="3">
              Imóvel: <strong>${formatLocationType(localData.locationType)}</strong> | 
              Área: <strong>${formatInstallArea(localData.installArea)}</strong> | 
              Qtd. Veículos: <strong>${localData.vehicleCount || 1}</strong> | 
              Equipamento: <strong>${formatChargerType(localData.chargerType)}</strong> | 
              Distância estimada: <strong>${localData.distanceApprox || 'Não informada'}</strong>
            </td>
          </tr>
          <tr>
            <td><strong>Alimentação Elétrica:</strong></td>
            <td colspan="3">
              Rede: <strong>${formatSupplyType(localData.supplyType)}</strong> | 
              Tensão: <strong>${formatVoltage(localData.voltagePreset, localData.customVfn, localData.customVff)}</strong>
              ${(localData.supplyType === 'nao_sei' || localData.voltagePreset === 'nao_sei') ? ' <span style="color:#D97706; font-size:11px; font-weight:700;">(⚠️ Pendente de verificação)</span>' : ''}
            </td>
          </tr>
          ${notes ? `<tr><td><strong>Observações:</strong></td><td colspan="3">${escapeHtml(notes)}</td></tr>` : ''}
        </table>
      </div>

      <!-- 2. DIAGNÓSTICO DE VIABILIDADE PRELIMINAR -->
      <div class="report-section">
        <h3 class="section-title">2. Conclusão da Vistoria e Viabilidade Preliminar</h3>
        <div class="report-diag-box" style="border-left: 6px solid ${badgeBg};">
          <div class="report-diag-header">
            <span class="report-diag-badge" style="background: ${badgeBg}; color: ${badgeColor};">
              ${diag.badge}
            </span>
            <span class="report-diag-headline">${diag.headline}</span>
          </div>
          <p class="report-diag-summary" style="margin-top: 6px;">${diag.summary}</p>
        </div>
      </div>

      <!-- 3. PROBLEMAS E PONTOS DE ATENÇÃO -->
      <div class="report-section">
        <h3 class="section-title">3. Irregularidades e Pontos de Atenção Identificados</h3>
        ${diag.problemsFound.length > 0 ? `
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 30%;">Item de Atenção</th>
                <th style="width: 50%;">Descrição do Risco / Efeito</th>
                <th style="width: 20%;">Gravidade</th>
              </tr>
            </thead>
            <tbody>
              ${diag.problemsFound.map(p => `
                <tr>
                  <td><strong>${escapeHtml(p.title)}</strong></td>
                  <td>${escapeHtml(p.description)}</td>
                  <td>
                    <span class="priority-tag priority-${p.severity === 'critica' ? '1' : '2'}">
                      ${p.severity === 'critica' ? 'Crítica' : 'Necessária'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="font-size: 12px; color: #166534;">Nenhuma irregularidade aparente foi detectada nas informações e imagens fornecidas.</p>'}
      </div>

      <!-- 4. PLANO DE ADEQUAÇÕES NECESSÁRIAS -->
      <div class="report-section">
        <h3 class="section-title">4. Adequações Técnicas Recomendadas (Por Prioridade)</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${diag.criticalActions.map(act => `
            <div style="padding: 8px 12px; background: #FEF2F2; border-left: 4px solid #DC2626; border-radius: 4px; font-size: 12px;">
              <span class="priority-tag priority-1">Crítica</span> <strong>Ação Impeditiva:</strong> ${escapeHtml(act)}
            </div>
          `).join('')}
          ${diag.necessaryActions.map(act => `
            <div style="padding: 8px 12px; background: #FEFCE8; border-left: 4px solid #CA8A04; border-radius: 4px; font-size: 12px;">
              <span class="priority-tag priority-2">Necessária</span> <strong>Adequação Normativa:</strong> ${escapeHtml(act)}
            </div>
          `).join('')}
          ${diag.recommendedActions.map(act => `
            <div style="padding: 8px 12px; background: #F0FDF4; border-left: 4px solid #16A34A; border-radius: 4px; font-size: 12px;">
              <span class="priority-tag priority-3">Recomendada</span> <strong>Melhoria de Segurança:</strong> ${escapeHtml(act)}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 5. INFORMAÇÕES E MEDIÇÕES PENDENTES -->
      ${diag.pendingVerifications.length > 0 ? `
        <div class="report-section">
          <h3 class="section-title">5. Pendências que Dependem de Visita Técnica Presencial</h3>
          <ul class="report-list">
            ${diag.pendingVerifications.map(pend => `<li>🔍 ${escapeHtml(pend)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- 6. MATRIZ DE TRANSPARÊNCIA E TRIPLA VALIDAÇÃO TÉCNICA -->
      <div class="report-section">
        <h3 class="section-title">6. Matriz de Transparência e Tripla Validação Técnica</h3>
        <p style="font-size: 11.5px; color: #475569; margin: 0 0 10px 0;">
          Para garantir total transparência, rastreabilidade e segurança pericial, cada parâmetro da infraestrutura é discriminado em três perspectivas independentes:
        </p>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 24%;">Item de Infraestrutura</th>
              <th style="width: 25%;">🤖 Identificação por IA (Visão)</th>
              <th style="width: 23%;">👤 Declarado pelo Usuário</th>
              <th style="width: 28%;">🔍 Validação Presencial Obrigatória</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Disjuntor Geral da Entrada:</strong></td>
              <td>
                ${aiAnalysis 
                  ? (aiAnalysis.mainBreakerEstimated && aiAnalysis.mainBreakerEstimated !== 'ilegivel' 
                      ? `<span class="status-pill status-green">${escapeHtml(aiAnalysis.mainBreakerEstimated)}A (OCR)</span>` 
                      : '<span class="status-pill status-yellow">⚠️ Inscrição ilegível na foto</span>')
                  : '<span class="status-pill status-gray">Heurística Local</span>'}
              </td>
              <td>${confirmations.mainBreakerConfirmed && confirmations.mainBreakerConfirmed !== 'nao_sei' ? `<strong>${confirmations.mainBreakerConfirmed}A</strong>` : '<span style="color:#DC2626;">Não confirmado</span>'}</td>
              <td>Conferir valor nominal na caixa do medidor da concessionária e na conta de energia.</td>
            </tr>
            <tr>
              <td><strong>Sistema de Aterramento (PE):</strong></td>
              <td>
                ${aiAnalysis 
                  ? (aiAnalysis.groundingIdentified 
                      ? '<span class="status-pill status-yellow">Barramento PE visível (Físico)</span>' 
                      : '<span class="status-pill status-red">Não identificado na foto</span>')
                  : '<span class="status-pill status-gray">Heurística Local</span>'}
              </td>
              <td>${formatConfirmationStatus(confirmations.groundingConfirmed)}</td>
              <td><strong>Ensaio com terrômetro (R ≤ 10Ω)</strong> e continuidade do PE. A visualização de barramento não atesta conformidade.</td>
            </tr>
            <tr>
              <td><strong>Espaço Reserva no Quadro:</strong></td>
              <td>
                ${aiAnalysis 
                  ? (aiAnalysis.hasDinSpace 
                      ? `<span class="status-pill status-green">Aparente livre (${aiAnalysis.apparentAvailableModules || 2} mód.)</span>` 
                      : '<span class="status-pill status-red">Sem reserva aparente</span>')
                  : '<span class="status-pill status-gray">Heurística Local</span>'}
              </td>
              <td>${formatConfirmationStatus(confirmations.spaceAvailableConfirmed)}</td>
              <td>Medir dimensões internas, barramento pente, compatibilidade física e dissipação de calor.</td>
            </tr>
            <tr>
              <td><strong>Integridade Térmica & Bornes:</strong></td>
              <td>
                ${aiAnalysis 
                  ? (aiAnalysis.thermalRiskDetected 
                      ? '<span class="status-pill status-red">⚠️ Indício de anomalia</span>' 
                      : '<span class="status-pill status-green">✓ Sem danos visíveis</span>')
                  : '<span class="status-pill status-gray">Heurística Local</span>'}
              </td>
              <td>Inspecionado visualmente</td>
              <td><strong>Termografia com câmera infravermelha sob carga.</strong> Foto visível não detecta aquecimento interno.</td>
            </tr>
            <tr>
              <td><strong>Proteção Contra Chuva / Vaga:</strong></td>
              <td>
                ${aiAnalysis && aiAnalysis.environment 
                  ? `<span class="status-pill status-blue">${escapeHtml(aiAnalysis.environment.recommendedEnclosure || 'Avaliado')}</span>` 
                  : '<span class="status-pill status-gray">Heurística Local</span>'}
              </td>
              <td>${formatConfirmationStatus(confirmations.rainProtectionConfirmed)}</td>
              <td>Verificar estanqueidade real, incidência solar e grau de proteção (IP44/IP54 abrigado ou IP65 exposto).</td>
            </tr>
            <tr>
              <td><strong>Circuito Terminal Dedicado:</strong></td>
              <td>Topologia a implantar</td>
              <td>${formatConfirmationStatus(confirmations.exclusiveCircuitConfirmed)}</td>
              <td>Garantir circuito 100% exclusivo do quadro ao EV, com DR Tipo A e DPS (NBR 17019).</td>
            </tr>
            ${isSubsoloOuFechada ? `
              <tr>
                <td><strong>Combate a Incêndio (CBMERJ):</strong></td>
                <td>
                  ${aiAnalysis && aiAnalysis.environment 
                    ? (aiAnalysis.environment.sprinklersApparent 
                        ? '<span class="status-pill status-yellow">Sprinklers aparentes</span>' 
                        : '<span class="status-pill status-red">Não visíveis</span>')
                    : '<span class="status-pill status-gray">Heurística Local</span>'}
                </td>
                <td>${formatConfirmationStatus(confirmations.cbmerjSprinklers)}</td>
                <td>Verificar projeto aprovado no Corpo de Bombeiros e pressurização (foto não atesta operabilidade).</td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      <!-- 7. METODOLOGIA, EVIDÊNCIAS E AUDITORIA DA INTELIGÊNCIA ARTIFICIAL -->
      <div class="report-section">
        <h3 class="section-title">7. Metodologia e Diagnóstico de Visão Computacional por Inteligência Artificial (IA)</h3>
        
        <!-- 7.1 MOTOR DE IA E MODELO UTILIZADO -->
        <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="font-size: 13px; color: #0F172A;">
              Modelo de IA Utilizado: ${aiAnalysis && aiAnalysis.modelUsed ? escapeHtml(aiAnalysis.modelUsed) : (aiAnalysis ? 'Google Gemini Multimodal Vision API (gemini-2.5-flash / gemini-2.0-flash)' : 'Google Gemini Multimodal Vision API / Heurística Pericial Local')}
            </strong>
            <span style="background: ${aiAnalysis ? '#EFF6FF' : '#F1F5F9'}; color: ${aiAnalysis ? '#1E40AF' : '#475569'}; border: 1px solid ${aiAnalysis ? '#BFDBFE' : '#CBD5E1'}; font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 700;">
              ${aiAnalysis ? '✨ Análise Multimodal Processada' : '⚙️ Heurística Pericial Determinística Local'}
            </span>
          </div>
          <p style="font-size: 11.5px; color: #475569; margin: 0; line-height: 1.5;">
            ${aiAnalysis 
              ? 'Análise de visão computacional multimodal executada diretamente via Google Gemini Multimodal Vision API, configurada com parâmetros de estrito rigor pericial baseados na ABNT NBR 5410, NBR 17019 e Nota CBMERJ 326/2025.'
              : 'O sistema integra a arquitetura Google Gemini Multimodal Vision API com chave configurável na Vercel e motor pericial de heurística determinística local Ligvolt (NBR 5410 / NBR 17019).'}
          </p>
        </div>

        <!-- 7.2 ANÁLISE DE EVIDÊNCIAS POR ELEMENTO IDENTIFICADO (Item 3 do Requisito) -->
        <div style="margin-bottom: 14px;">
          <h4 style="font-size: 12px; font-weight: 700; color: #1E293B; margin-top: 0; margin-bottom: 6px;">
            7.1 Análise de Evidências Identificadas nas Fotografias:
          </h4>
          <table class="report-table" style="font-size: 11px;">
            <thead>
              <tr>
                <th style="width: 22%;">Elemento Identificado</th>
                <th style="width: 24%;">Inscrição / Registro Observado</th>
                <th style="width: 14%;">Confiança</th>
                <th style="width: 15%;">Necessita Confirmação?</th>
                <th style="width: 25%;">Justificativa Técnica</th>
              </tr>
            </thead>
            <tbody>
              ${aiAnalysis && Array.isArray(aiAnalysis.evidenceDetails) && aiAnalysis.evidenceDetails.length > 0 ? (
                aiAnalysis.evidenceDetails.map(ev => `
                  <tr>
                    <td><strong>${escapeHtml(ev.element)}</strong></td>
                    <td><code>${escapeHtml(ev.observedInscription || 'Visual')}</code></td>
                    <td>
                      <span class="status-pill status-${ev.confidence === 'alta' ? 'green' : (ev.confidence === 'baixa' ? 'red' : 'yellow')}">
                        ${escapeHtml(ev.confidence || 'Média')}
                      </span>
                    </td>
                    <td>${ev.confirmationRequired ? '<strong style="color:#DC2626;">Sim (Obrigatória)</strong>' : '<span style="color:#16A34A;">Dispensada</span>'}</td>
                    <td>${escapeHtml(ev.technicalRationale || 'Validação presencial de campo recomendada')}</td>
                  </tr>
                `).join('')
              ) : (
                `
                <tr>
                  <td><strong>Disjuntor de Entrada</strong></td>
                  <td><code>${confirmations.mainBreakerConfirmed ? `${confirmations.mainBreakerConfirmed}A` : 'Inscrição a aferir'}</code></td>
                  <td><span class="status-pill status-yellow">${confirmations.mainBreakerConfirmed ? 'Média' : 'Baixa'}</span></td>
                  <td><strong style="color:#DC2626;">Sim (Obrigatória)</strong></td>
                  <td>Confirmar amperagem nominal diretamente no medidor da distribuidora</td>
                </tr>
                <tr>
                  <td><strong>Barramento de Terra</strong></td>
                  <td><code>${confirmations.groundingConfirmed === 'sim' ? 'Barramento visível' : 'Pendente'}</code></td>
                  <td><span class="status-pill status-yellow">Média</span></td>
                  <td><strong style="color:#DC2626;">Sim (Obrigatória)</strong></td>
                  <td>A visualização física do barramento não atesta resistência ôhmica da malha</td>
                </tr>
                <tr>
                  <td><strong>Espaço no Trilho DIN</strong></td>
                  <td><code>${confirmations.spaceAvailableConfirmed === 'sim' ? 'Espaço aparente' : 'Pendente'}</code></td>
                  <td><span class="status-pill status-yellow">Média</span></td>
                  <td><strong style="color:#DC2626;">Sim (Obrigatória)</strong></td>
                  <td>Verificar dimensões internas, barramento pente e aquecimento interno</td>
                </tr>
                `
              )}
            </tbody>
          </table>
        </div>

        <!-- 7.3 FATOS OBSERVADOS, HIPÓTESES E INFORMAÇÕES INCONCLUSIVAS (Item 9 do Requisito) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; margin-bottom: 12px;">
          <!-- FATOS OBSERVADOS -->
          <div style="background: #FFFFFF; border: 1px solid #CBD5E1; border-top: 3px solid #16A34A; border-radius: 6px; padding: 10px 12px;">
            <h5 style="font-size: 11.5px; font-weight: 700; color: #166534; margin: 0 0 6px 0;">
              ✓ Fatos Observados (Evidências Comprovadas):
            </h5>
            <ul style="margin: 0; padding-left: 16px; font-size: 11px; color: #334155; line-height: 1.45;">
              ${aiAnalysis && Array.isArray(aiAnalysis.factsObserved) && aiAnalysis.factsObserved.length > 0 ? (
                aiAnalysis.factsObserved.map(f => `<li>${escapeHtml(f)}</li>`).join('')
              ) : (
                `
                <li>Registro fotográfico anexado com ${photos ? photos.length : 0} fotografia(s) da instalação.</li>
                <li>Local pretendido: ${formatInstallArea(localData.installArea)} em imóvel ${formatLocationType(localData.locationType)}.</li>
                <li>Alimentação informada: ${formatSupplyType(localData.supplyType)}.</li>
                ${confirmations.mainBreakerConfirmed && confirmations.mainBreakerConfirmed !== 'nao_sei' ? `<li>Disjuntor geral informado/observado: ${confirmations.mainBreakerConfirmed}A.</li>` : '<li>Inscrição do disjuntor geral pendente de confirmação nítida.</li>'}
                `
              )}
            </ul>
          </div>

          <!-- HIPÓTESES TÉCNICAS -->
          <div style="background: #FFFFFF; border: 1px solid #CBD5E1; border-top: 3px solid #2563EB; border-radius: 6px; padding: 10px 12px;">
            <h5 style="font-size: 11.5px; font-weight: 700; color: #1E40AF; margin: 0 0 6px 0;">
              💡 Hipóteses Técnicas Preliminares:
            </h5>
            <ul style="margin: 0; padding-left: 16px; font-size: 11px; color: #334155; line-height: 1.45;">
              ${aiAnalysis && Array.isArray(aiAnalysis.hypotheses) && aiAnalysis.hypotheses.length > 0 ? (
                aiAnalysis.hypotheses.map(h => `<li>${escapeHtml(h)}</li>`).join('')
              ) : (
                `
                <li>Demanda contínua estimada de ${(parseInt(localData.vehicleCount, 10) || 1) * (localData.chargerType === 'tomada' ? 16 : 32)}A para ${localData.vehicleCount || 1} veículo(s).</li>
                <li>Topologia recomendada em condutores de cobre com isolação 70°C/90°C e proteção DR Tipo A.</li>
                <li>Fator de simultaneidade unitário (g = 1,0) para recarga veicular conforme ABNT NBR 17019.</li>
                `
              )}
            </ul>
          </div>

          <!-- INFORMAÇÕES INCONCLUSIVAS -->
          <div style="background: #FFFFFF; border: 1px solid #CBD5E1; border-top: 3px solid #D97706; border-radius: 6px; padding: 10px 12px;">
            <h5 style="font-size: 11.5px; font-weight: 700; color: #B45309; margin: 0 0 6px 0;">
              ❓ Informações Inconclusivas por Imagem:
            </h5>
            <ul style="margin: 0; padding-left: 16px; font-size: 11px; color: #334155; line-height: 1.45;">
              ${aiAnalysis && Array.isArray(aiAnalysis.inconclusiveItems) && aiAnalysis.inconclusiveItems.length > 0 ? (
                aiAnalysis.inconclusiveItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')
              ) : (
                `
                <li>Resistência de aterramento e impedância do PE (foto comprova apenas aspecto mecânico do barramento; ensaio com terrômetro ≤ 10Ω é mandatório).</li>
                <li>Ausência de pontos quentes sob carga contínua (foto em luz visível identifica apenas danos já consumados, não substituindo termografia infravermelha).</li>
                <li>Compatibilidade mecânica do barramento pente e profundidade útil da caixa para inserção dos novos módulos DIN.</li>
                ${isSubsoloOuFechada ? '<li>Operabilidade hidráulica e pressurização do sistema de sprinklers no subsolo.</li>' : ''}
                `
              )}
            </ul>
          </div>
        </div>

        <!-- 7.4 RECOMENDAÇÕES TÉCNICAS DE CAMPO -->
        <div style="background: #F1F5F9; border-left: 4px solid #0F172A; border-radius: 4px; padding: 10px 14px; font-size: 11.5px; color: #1E293B;">
          <strong>📋 Recomendações Técnicas para a Equipe de Vistoria Presencial:</strong>
          <ul style="margin: 4px 0 0 0; padding-left: 18px; line-height: 1.5;">
            ${aiAnalysis && Array.isArray(aiAnalysis.fieldRecommendations) && aiAnalysis.fieldRecommendations.length > 0 ? (
              aiAnalysis.fieldRecommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')
            ) : (
              `
              <li>Efetuar medição com terrômetro de quatro estacas ou alicímetro para validar resistência de aterramento ≤ 10 ohms.</li>
              <li>Aferir corrente de pico da instalação simultânea nos horários de maior carga com alicate amperímetro TRMS.</li>
              <li>Inspecionar visualmente o padrão de entrada e verificar conformidade dos cabos do ramal com a concessionária.</li>
              <li>Verificar espaço e ventilação para o subquadro caso o quadro existente apresente aquecimento ou congestionamento.</li>
              `
            )}
          </ul>
        </div>
      </div>

      <!-- 8. EVIDÊNCIAS FOTOGRÁFICAS -->
      ${photosGalleryHtml}

      <!-- AVISO LEGAL E DIRETRIZES TÉCNICAS -->
      <div class="report-section report-disclaimer-box" style="margin-top: 20px;">
        <h4 style="margin-top: 0; color: #78350F; font-size: 12px;">⚠️ Natureza Preliminar Deste Relatório</h4>
        <p>
          Este documento constitui um <strong>Relatório Preliminar de Vistoria e Triagem de Viabilidade</strong> gerado com auxílio de inteligência artificial visual e informações declaradas pelo vistoriador.
        </p>
        <p>
          <strong>Este estudo preliminar não substitui e não constitui:</strong>
        </p>
        <ol>
          <li>Projeto Elétrico Executivo com emissão de Anotação de Responsabilidade Técnica (ART) perante o CREA.</li>
          <li>Atestado pericial definitivo de conformidade ou segurança elétrica.</li>
          <li>Aprovação de aumento de carga perante a concessionária distribuidora de energia.</li>
          <li>Laudo definitivo do Corpo de Bombeiros Militar.</li>
        </ol>
      </div>

      <!-- ASSINATURAS -->
      <div class="report-signatures">
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>${escapeHtml(inspector)}</strong></p>
          <p>Responsável pelo Preenchimento da Vistoria</p>
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <p><strong>Engenheiro Eletricista (Quando aplicável)</strong></p>
          <p>CREA / ART: __________________________</p>
        </div>
      </div>
    </div>
    `;
  }

  function formatLocationType(type) {
    const map = {
      residencia: 'Residência Unifamiliar (Casa)',
      condominio: 'Condomínio Edilício (Prédio)',
      comercio: 'Estabelecimento Comercial',
      estacionamento: 'Estacionamento Rotativo / Privado'
    };
    return map[type] || type || 'Não informado';
  }

  function formatInstallArea(area) {
    const map = {
      externa: 'Área Externa (Ao ar livre)',
      garagem_aberta: 'Garagem Aberta / Térreo Ventilado',
      garagem_fechada: 'Garagem Fechada Confinada',
      subsolo: 'Subsolo de Edificação'
    };
    return map[area] || area || 'Não informada';
  }

  function formatChargerType(type) {
    const map = {
      tomada: 'Ponto Dedicado / Tomada Modo 2 (~3,7 kW)',
      wallbox: 'Estação Wallbox Fixa Modo 3 (7,4 kW / 22 kW)',
      indefinido: 'Ainda não definido pelo cliente'
    };
    return map[type] || type || 'Não definido';
  }

  function formatSupplyType(type) {
    const map = {
      monofasica: 'Monofásica (F+N)',
      bifasica: 'Bifásica (2F+N / 2F) — Padrão Ligvolt',
      trifasica: 'Trifásica (3F+N / 3F)',
      nao_sei: 'Não identificada (Pendente de medição)'
    };
    return map[type] || 'Bifásica (Padrão sugerido)';
  }

  function formatVoltage(preset, vfn, vff) {
    if (preset === '127_mono') return '127V (Fase-Neutro)';
    if (preset === '220_mono') return '220V (Fase-Neutro ou Fase-Fase)';
    if (preset === '127_220') return '127 / 220V (F-N: 127V | F-F: 220V)';
    if (preset === '220_380') return '220 / 380V (F-N: 220V | F-F: 380V)';
    if (preset === 'custom') return `Personalizada (${vfn || 127}V / ${vff || 220}V)`;
    if (preset === 'nao_sei') return 'Não informada (Aferir no padrão)';
    return preset || '127 / 220V';
  }

  function formatConfirmationStatus(val) {
    if (val === 'sim') return '<span class="status-pill status-green">✓ Confirmado</span>';
    if (val === 'nao') return '<span class="status-pill status-red">✗ Não atendido</span>';
    if (val === 'nao_se_aplica') return '<span class="status-pill status-gray">Não se aplica</span>';
    return '<span class="status-pill status-yellow">? Não verificado / Pendente</span>';
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
    PHOTO_CATEGORIES,
    compressImage,
    evaluateInspectionViability,
    buildPreliminaryInspectionReportHTML
  };
}));
