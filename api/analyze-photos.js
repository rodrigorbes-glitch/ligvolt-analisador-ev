/**
 * LIGVOLT - Vercel Serverless Function: Análise Multimodal de Fotos de Vistoria
 * Endpoint: /api/analyze-photos
 * Suporta Google Gemini Multimodal Vision API (gemini-2.5-flash / gemini-1.5-flash)
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
        message: 'Chave da API de IA não configurada no servidor Vercel. Você pode prosseguir com a vistoria guiada e confirmação simplificada.'
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
Você é o assistente pericial de visão computacional do LIGVOLT, especializado em triagem de infraestrutura elétrica para recarga de veículos elétricos (ABNT NBR 5410, NBR 17019 e Nota CBMERJ 326/2025).

Seu papel é analisar visualmente as fotografias do quadro elétrico, disjuntores e ambiente enviadas pelo vistoriador e identificar elementos objetivos, com prudência técnica.

REGRA FUNDAMENTAL DE SEGURANÇA:
- NUNCA declare uma instalação segura ou apta apenas pela fotografia.
- NUNCA presuma integridade de aterramento, bitola de cabos embutidos ou capacidade disponível da rede sem medição.
- Se um componente não estiver claramente legível, indique "não legível" ou "não identificado - necessita verificação presencial".
- Avalie indícios visuais de aquecimento (fios amarelados/escurecidos, bornes queimados), espaço reserva no quadro, presença visível de DR e DPS, e condições do local (ex: subsolo sem sprinklers aparentes).

Analise as ${imageParts.length} imagens e responda ESTRITAMENTE em formato JSON (sem markdown, sem backticks, sem texto antes ou depois) seguindo exatamente este modelo:

{
  "summary": "Resumo objetivo e em linguagem simples do que foi observado nas fotos (máximo 2 a 3 frases curtas).",
  "identifiedBreakers": [
    {
      "type": "geral" ou "ramal",
      "rating": "ex: 63A, 50A, 40A ou não legível",
      "poles": "Tripolar" ou "Bipolar" ou "Monopolar" ou "Não identificado",
      "confidence": "alta" ou "media" ou "baixa",
      "notes": "detalhes observados"
    }
  ],
  "mainBreakerEstimated": "63A" ou "50A" ou null se não legível,
  "drIdentified": {
    "detected": true ou false,
    "confidence": "alta" ou "media" ou "baixa",
    "notes": "ex: DR bipolar visível / Nenhum DR aparente no quadro"
  },
  "dpsIdentified": {
    "detected": true ou false,
    "confidence": "alta" ou "media" ou "baixa",
    "notes": "ex: DPS classe II visível no barramento / Não visível"
  },
  "panelCondition": {
    "status": "adequado" ou "atencao" ou "critico",
    "spaceAvailable": "muito" ou "pouco" ou "nenhum" ou "nao_identificado",
    "signsOfDamage": true ou false,
    "notes": "observações sobre organização, limpeza e integridade física"
  },
  "apparentRisks": [
    {
      "risk": "descrição do risco",
      "severity": "critica" ou "necessaria" ou "recomendada",
      "recommendation": "ação a tomar"
    }
  ],
  "photoQualityFeedback": [
    {
      "photoIndex": 1,
      "quality": "boa" ou "escura" ou "desfocada" ou "muito_distante",
      "tip": "dica se precisar de foto melhor"
    }
  ]
}
`;

    // Chamada à API Gemini (Google AI Studio)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

    // Se o modelo 2.5 não estiver disponível na chave, tenta 1.5-flash como fallback
    if (!response.ok && response.status === 404) {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      response = await fetch(fallbackUrl, {
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
      analysis: parsedResult
    });

  } catch (err) {
    console.error('Erro inesperado no endpoint /api/analyze-photos:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no processamento das fotografias: ' + (err.message || String(err))
    });
  }
};
