/**
 * LIGVOLT - Vercel Serverless Function: Análise Multimodal de Fotos de Vistoria
 * Endpoint: /api/analyze-photos
 * Suporta Google Gemini Multimodal Vision API (gemini-2.5-flash com fallback para gemini-2.0-flash)
 */

module.exports = async function handler(req, res) {
  // CORS & Methods
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gemini-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { photos, locationContext, localData, apiKey: customKey } = req.body || {};

    const apiKey = customKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;

    if (!apiKey) {
      return res.status(200).json({
        success: false,
        noApiKey: true,
        modelUsed: 'Heurística Pericial Local (Offline)',
        message: 'Chave da API de IA não configurada no servidor Vercel. O sistema operará com o motor pericial de heurística local.'
      });
    }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma fotografia enviada para análise.'
      });
    }

    // Prepara partes de imagem para a API Gemini (aceita dataUrl ou base64 direto)
    const imageParts = photos.slice(0, 6).map((photo) => {
      if (!photo) return null;
      if (photo.base64) {
        return {
          inlineData: {
            mimeType: photo.mimeType || 'image/jpeg',
            data: photo.base64
          }
        };
      }
      if (photo.dataUrl && photo.dataUrl.includes('base64,')) {
        const match = photo.dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (match) {
          return {
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          };
        }
      }
      return null;
    }).filter(Boolean);

    if (imageParts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Formato de imagem inválido. As fotografias devem conter dados base64.'
      });
    }

    // Contexto fornecido pelo usuário na Etapa 1
    const loc = locationContext || localData || {};
    const contextPrompt = `
CONTEXTO DA INSTALAÇÃO (INFORMADO PELO USUÁRIO):
- Tipo de imóvel: ${loc.locationType || 'Não informado'}
- Local de instalação: ${loc.installArea || 'Não informado'}
- Cidade/UF: ${loc.cityState || 'Não informado'}
- Quantidade pretendida de carregadores: ${loc.vehicleCount || '1'}
- Tipo de carregador pretendido: ${loc.chargerType || 'Wallbox'}
- Distância aproximada do quadro: ${loc.distanceApprox || 'Não informada'}
`;

    const systemPrompt = `
Você é o assistente pericial de visão computacional do LIGVOLT, especializado em triagem técnica de infraestrutura elétrica para recarga de veículos elétricos (ABNT NBR 5410, NBR 17019 e Nota Técnica CBMERJ 326/2025).

Seu papel é analisar com estrito rigor pericial as fotografias enviadas e extrair evidências observadas.

DIRETRIZES FUNDAMENTAIS DE SEGURANÇA E RIGOR TÉCNICO:
1. OCR APRIMORADO E PRUDÊNCIA:
   - Leia exclusivamente inscrições que estiverem nítidas no corpo dos disjuntores (ex: C32, C40, C50, C63, C100, 400V, 5kA/6kA).
   - NUNCA invente, presuma ou estime amperagens ou curvas quando a foto estiver embaçada, distante ou com reflexos.
   - Se os caracteres estiverem ilegíveis ou duvidosos, defina explicitamente "rating": "ilegivel", "confidence": "baixa" e solicite nova foto detalhada com boa iluminação nas observações de qualidade.

2. ATERRAMENTO (CONDIÇÃO CRÍTICA):
   - A visualização de barramento de cobre ou condutor verde/amarelo atesta unicamente a presença física aparente de barramento PE no quadro.
   - NUNCA declare o aterramento como "adequado" ou "conforme" apenas pela foto. A integridade da malha, equipotencialização e resistência de aterramento (<= 10 ohms) exigem obrigatoriamente medição instrumental presencial com terrômetro/alicímetro.

3. RISCO TÉRMICO E TERMOGRAFIA:
   - Uma fotografia convencional no espectro visível detecta unicamente danos térmicos já consumados (ex: bornes derretidos, oxidação severa, condutores escurecidos).
   - NUNCA declare "ausência de risco térmico". A ausência de marcas superficiais não atesta ausência de pontos quentes internos sob carga contínua (exige inspeção termográfica com câmera infravermelha sob carga).

4. ESPAÇO FÍSICO NO QUADRO (TRILHO DIN):
   - Estime os módulos DIN aparentes disponíveis, mas esclareça que a aprovação para instalação de novos módulos (DR Tipo A e DPS Classe II) depende de validação presencial das dimensões internas, barramento pente, bornes e ausência de obstruções traseiras.

5. AMBIENTE E PROTEÇÃO CONTRA INCÊNDIO:
   - Avalie visualmente sinais de umidade aparente, poeira, intempéries e rota de cabos.
   - Em garagens subterrâneas ou fechadas, verifique a presença visual aparente de tubulação e bicos de chuveiros automáticos (sprinklers) conforme CBMERJ 326/2025, ressalvando que a foto não atesta a operabilidade hidráulica do sistema de incêndio.
   - Não imponha grau IP universal sem necessidade técnica (locais cobertos aceitam IP44/IP54 conforme NBR 17019; ao ar livre direto exige IP65).

Responda ESTRITAMENTE em formato JSON (sem markdown, sem blocos de texto antes ou depois) seguindo exatamente este modelo:

{
  "summary": "Resumo pericial objetivo do que foi observado nas imagens (2 a 3 frases).",
  "factsObserved": [
    "Fato objetivo 1 comprovado visualmente pela foto",
    "Fato objetivo 2 comprovado visualmente pela foto"
  ],
  "hypotheses": [
    "Hipótese técnica preliminar 1 baseada nas evidências visíveis",
    "Hipótese técnica preliminar 2"
  ],
  "inconclusiveItems": [
    "Item que não pode ser concluído por foto (ex: resistência ôhmica de aterramento)",
    "Item inconclusivo (ex: sobreaquecimento interno de conexões sob carga contínua)"
  ],
  "identifiedBreakers": [
    {
      "type": "geral" ou "ramal",
      "rating": "ex: 50A ou ilegivel",
      "curve": "Curva C" ou "Curva B" ou "nao_identificada",
      "poles": "Bipolar" ou "Tripolar" ou "Monopolar" ou "Nao identificado",
      "confidence": "alta" ou "media" ou "baixa",
      "notes": "Descrição detalhada do elemento e legibilidade"
    }
  ],
  "evidenceDetails": [
    {
      "photoCategory": "disjuntores" ou "quadro_geral" ou "padrao_entrada" ou "local_vaga",
      "element": "Identificação do elemento analisado",
      "observedInscription": "Texto/números exatos visíveis na foto ou 'Ilegível'",
      "confidence": "alta" ou "media" ou "baixa",
      "confirmationRequired": true,
      "technicalRationale": "Motivo da necessidade de confirmação presencial"
    }
  ],
  "mainBreakerEstimated": "50A" ou null se ilegível,
  "hasDinSpace": true ou false ou null,
  "apparentAvailableModules": 4,
  "groundingIdentified": true ou false,
  "groundingNote": "Presença física aparente de barramento PE. Não comprova eficácia ou resistência de aterramento sem teste instrumental.",
  "thermalRiskDetected": false,
  "thermalDisclaimer": "Fotografia em luz visível identifica apenas danos já consumados. Não atesta ausência de pontos quentes sob carga.",
  "drIdentified": {
    "detected": true ou false,
    "confidence": "alta" ou "media" ou "baixa",
    "notes": "Status de DR visível"
  },
  "dpsIdentified": {
    "detected": true ou false,
    "confidence": "alta" ou "media" ou "baixa",
    "notes": "Status de DPS visível"
  },
  "environment": {
    "apparentArea": "garagem_aberta" ou "subsolo" ou "externa",
    "sprinklersApparent": true ou false ou "nao_visivel",
    "weatherExposure": "coberto" ou "exposto" ou "parcial",
    "recommendedEnclosure": "IP44/IP54 abrigado" ou "IP65 ao tempo"
  },
  "fieldRecommendations": [
    "Ação técnica recomendada 1 a ser checada presencialmente",
    "Ação técnica recomendada 2"
  ],
  "photoQualityFeedback": [
    {
      "photoIndex": 1,
      "quality": "boa" ou "desfocada" ou "escura" ou "ilegivel",
      "tip": "Dica caso seja necessária foto complementar mais nítida ou aproximada"
    }
  ]
}
`;

    // Chamada à API Gemini com modelo recente suportado (Google AI Studio)
    let usedModel = 'gemini-2.5-flash';
    let geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt + '\n' + contextPrompt },
            ...imageParts
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    let response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    // Fallback para modelo multimodal estável recente: gemini-2.0-flash
    if (!response.ok && (response.status === 404 || response.status === 400)) {
      usedModel = 'gemini-2.0-flash';
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    }

    // Segundo fallback caso gemini-2.0-flash retorne 404
    if (!response.ok && response.status === 404) {
      usedModel = 'gemini-2.5-pro';
      const proUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;
      response = await fetch(proUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erro na API Gemini:', response.status, errText);
      return res.status(502).json({
        success: false,
        error: `Erro retornado pela API de IA (${response.status}). Verifique a chave configurada ou tente novamente.`,
        details: errText
      });
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const rawText = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;

    if (!rawText) {
      return res.status(502).json({
        success: false,
        error: 'A IA não retornou resposta textual estruturada.'
      });
    }

    // Limpa possíveis marcadores markdown
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsedResult;
    try {
      parsedResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Falha ao parsear JSON retornado pela IA:', cleaned);
      return res.status(502).json({
        success: false,
        error: 'A resposta da IA não é um JSON válido.',
        rawText
      });
    }

    return res.status(200).json({
      success: true,
      analysis: parsedResult,
      modelUsed: usedModel
    });

  } catch (err) {
    console.error('Erro inesperado no endpoint /api/analyze-photos:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no processamento das fotografias: ' + (err.message || String(err))
    });
  }
};
