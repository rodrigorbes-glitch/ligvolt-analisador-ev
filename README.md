# LIGVOLT | Analisador de Viabilidade e Dimensionamento Elétrico de VE

Aplicação Web Single Page Application (SPA), Mobile-First, desenvolvida para permitir que instaladores, técnicos, engenheiros e condomínios avaliem com rapidez, precisão e embasamento normativo a viabilidade e o dimensionamento elétrico para instalação de carregadores de veículos elétricos (VE) no Brasil.

---

## ⚡ Normas e Referências Técnicas Aplicadas

- **ABNT NBR 5410**: Instalações elétricas de baixa tensão (critérios de ampacidade por método de instalação, fatores de temperatura e agrupamento, queda de tensão e condutor de proteção PE conforme Tabela 58).
- **ABNT NBR 17019**: Instalações elétricas em locais especiais — Alimentação de veículos elétricos (circuitos terminais exclusivos, proteção DR Tipo A + RDC-DD 6mA ou Tipo B, proteção contra surtos DPS).
- **ABNT NBR IEC 61851 / IEC 62196**: Sistema de recarga condutiva para veículos elétricos (Modo 3 e conectores Tipo 2).
- **Nota Técnica CHEMG 326/2025 (CBMERJ)**: Diretrizes e recomendações de segurança contra incêndio para recarga em garagens fechadas ou subsolos com exigência de chuveiros automáticos (sprinklers).

---

## 🚀 Funcionalidades Principais

1. **Aba 1 — Dimensionamento Elétrico**:
   - Cálculos instantâneos no navegador em JavaScript puro (sem APIs ou dependências externas).
   - Suporte a redes Monofásicas (127V / 220V), Bifásicas (127/220V) e Trifásicas (220/380V ou personalizadas).
   - Dimensionamento de até 4 pontos de recarga com correntes nominais configuráveis (16A, 32A, 40A, etc.) e distribuição real de fases.
   - Balanço real de fases: considera a demanda existente por fase (ou total em A/kVA) somada à demanda dos carregadores com medidores visuais e alerta imediato de sobrecarga em relação ao disjuntor geral.
   - Tratamento de pendências: indicação explícita de "Pendente de verificação" quando grandezas não forem comprovadas, sem inventar valores para aprovar instalações.
   - Margem de dimensionamento de 125% para regime de operação contínua (> 3h), com chave seletora transparente identificando-a como critério conservador recomendado.
   - Dimensionamento integrado por capacidade de condução (Tabelas 36 e 37 NBR 5410 para métodos B1, B2, C e F), fatores de temperatura e agrupamento (Tabelas 40 e 42), queda de tensão máxima (referência de 4% no circuito terminal) e coordenação com disjuntores padronizados ($I_B \le I_n \le I_z$).
   - Dimensionamento do condutor de proteção (PE) segundo a Tabela 58 da NBR 5410.
   - **Comparativo Automatizado Cenário A vs Cenário B**:
     - *Cenário A*: Alimentador único até Quadro Secundário (QGBT-EV) com proteções locais e botão de emergência.
     - *Cenário B*: Circuitos independentes saindo direto do quadro geral principal.
     - Avaliação técnica e recomendação fundamentada sobre qual topologia é preferível para o caso avaliado.

2. **Aba 2 — Segurança e Conformidade**:
   - Checklist interativo dos 13 itens normativos essenciais com 4 estados: *Adequado*, *Inadequado*, *Não aplicável* e *Não verificado / Pendente*.
   - Distinção nítida entre *Obrigação Normativa*, *Recomendação Técnica* e *Diretriz Regulatória (CBMERJ)*.
   - Detecção imediata de inconformidades críticas (como garagens subterrâneas sem sprinklers, falta de aterramento PE, ou falta de DR dedicado).

3. **Diagnóstico Inteligente Consolidado**:
   - Consolidação instantânea dos cálculos e do checklist em 4 estados objetivos:
     - 🟢 **PRELIMINARMENTE APTO**: Parâmetros em conformidade preliminar, sem sobrecargas.
     - 🟡 **APTO COM ADEQUAÇÕES**: Instalação viável mediante intervenções mapeadas (novos circuitos dedicados, DR Tipo A + 6mA DC, DPS, etc.).
     - 🔴 **NÃO APTO NAS CONDIÇÕES ATUAIS**: Sobrecarga elétrica comprovada no disjuntor geral ou risco crítico impeditivo (ex: subsolo sem sprinklers conforme Nota CBMERJ 326/2025).
     - ⚪ **AVALIAÇÃO INCOMPLETA**: Faltam dados essenciais da instalação que impedem atestar a viabilidade com segurança.
   - Lista acionável de adequações ordenadas por prioridade técnica (P1, P2, P3).

4. **Relatório Técnico Preliminar e Exportação para PDF**:
   - Modal com visualização completa do relatório formal.
   - Inclusão opcional de dados do cliente, endereço da obra e responsável técnico.
   - Resumo de grandezas calculadas, balanço de fases, comparativo de cenários, lista de materiais estimados (BOM) e checklist.
   - Estilização dedicada para impressão física ou geração de PDF (`print.css`), convertendo a interface escura para um documento em papel branco com alto contraste, fontes limpas e sem poluição visual.

---

## 📁 Estrutura de Arquivos

```
20261022-CALCULADORABÁSICA_EV/
├── index.html                 # Página principal SPA
├── vercel.json                # Configuração otimizada para deploy na Vercel
├── README.md                  # Documentação do projeto
├── css/
│   ├── style.css              # Identidade visual Ligvolt, CSS Grid/Flexbox responsivo
│   └── print.css              # Estilos de impressão e exportação limpa para PDF
├── js/
│   ├── electrical-tables.js   # Tabelas NBR 5410, ampacidades, fatores e disjuntores DIN
│   ├── calculation-engine.js  # Motor de cálculo: correntes, queda de tensão, PE e cenários
│   ├── compliance-rules.js    # Regras normativas, CBMERJ 326/2025 e checklist
│   ├── diagnostic-engine.js   # Motor de diagnóstico nos 4 estados consolidados
│   ├── report-generator.js    # Gerador de relatório técnico e lista de materiais (BOM)
│   ├── ui-controller.js       # Gerenciamento reativo da interface e carregadores
│   └── app.js                 # Inicialização e bindings da aplicação
└── test/
    ├── test-suite.js          # Suíte de 30 testes unitários de validação elétrica
    └── run-tests.html         # Interface web para rodar os testes no navegador
```

---

## 🧪 Como Executar a Suíte de Testes Automatizados

A aplicação conta com uma suíte de testes cobrindo cálculos de ampacidade, queda de tensão, disjuntores, desequilíbrio trifásico, sobrecargas e os 4 estados do diagnóstico:

### 1. Via Terminal (Node.js)
```bash
node test/test-suite.js
```

### 2. Pelo Navegador
Abra o arquivo `test/run-tests.html` em qualquer navegador web e clique em **"Executar Todos os Testes"**.

---

## ☁️ Como Fazer Deploy na Vercel

Por ser uma aplicação SPA estática em HTML5, CSS3 e JavaScript puro, o deploy na Vercel é imediato:

### Método 1: Via CLI da Vercel
1. Instale a CLI da Vercel (se ainda não tiver):
   ```bash
   npm install -g vercel
   ```
2. Na raiz deste diretório, execute:
   ```bash
   vercel
   ```
3. Siga os prompts padrões para publicar em segundos. Para deploy em produção:
   ```bash
   vercel --prod
   ```

### Método 2: Via GitHub / Dashboard Vercel
1. Suba este repositório para o GitHub ou GitLab.
2. Acesse [vercel.com](https://vercel.com) e clique em **"Add New Project"**.
3. Importe o repositório.
4. O framework preset será reconhecido automaticamente como **Other** (Static Site).
5. Clique em **Deploy**.

---

## ⚖️ Nota de Responsabilidade Técnica

Esta ferramenta oferece pré-dimensionamento e triagem técnica preliminar baseada em normas brasileiras. Ela **não substitui** o projeto elétrico executivo detalhado, a vistoria presencial de campo com medições instrumentais, a respectiva emissão de Anotação de Responsabilidade Técnica (ART) junto ao CREA por Engenheiro Eletricista legalmente habilitado, nem o processo de homologação ou solicitação de aumento de carga perante a concessionária de energia elétrica distribuidora local.
