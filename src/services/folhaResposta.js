// ─────────────────────────────────────────────────────────────
//  Folha de respostas legível por IA (Gemini)
//
//  O desenho desta folha é otimizado para leitura por modelo de
//  visão, não para leitora óptica. As decisões que valem lembrar:
//
//  1. Tudo é tabela com borda preta contínua. Modelo de visão lê
//     grade muito melhor que caixas soltas alinhadas por espaço.
//  2. O número da questão é impresso em TODA linha, com dois
//     dígitos. Nenhuma linha depende de contagem para ser
//     identificada.
//  3. A letra é impressa em cinza claro DENTRO de cada quadrado.
//     É a âncora de coluna: mesmo com a folha torta, cortada ou
//     fotografada de lado, o modelo sabe qual coluna é qual sem
//     contar. Ao preencher, o aluno cobre a letra — e "quadrado
//     escuro" é exatamente o que o modelo procura.
//     Por isso a digitalização precisa ser em TONS DE CINZA:
//     scanner em preto-e-branco (1 bit) ou apaga o cinza ou o
//     satura em preto, e os dois estragam a leitura.
//  4. Nenhum fundo cinza, nenhuma tarja, nenhuma zebra na grade.
//     Qualquer área escura impressa compete com a marca do aluno.
//  5. Marcas de canto (as quadradas pretas) delimitam a folha. O
//     canto superior esquerdo é maior de propósito: resolve
//     orientação em foto de celular virada.
//  6. O número de chamada é capturado DUAS vezes — escrito à mão
//     nas caixas e marcado na grade dezena/unidade. A redundância
//     permite que a IA acuse conflito em vez de chutar aluno.
// ─────────────────────────────────────────────────────────────

export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

const LARGURA_UTIL = 186   // mm — A4 (210) menos 12mm de margem de cada lado
const GAP_BLOCO    = 6     // mm
const LARGURA_NUM  = 11    // mm — coluna do número da questão
const MAX_LINHAS   = 20    // linhas por bloco que cabem na página
const ALTURA_GRADE = 162   // mm — sobra vertical para as linhas de resposta
const CELL_MIN     = 7     // mm — abaixo disso a marca fica pequena demais
const CELL_MAX     = 12    // mm
const LINHA_MIN    = 7.5   // mm
const LINHA_MAX    = 14    // mm
const BOX_MAX      = 9     // mm

// ── Dados da prova ────────────────────────────────────────────

/** Maior quantidade de alternativas entre as questões objetivas. */
export function alternativasDaProva(prova) {
  const maior = (prova?.questoes || [])
    .filter(q => q.tipo === 'multipla_escolha')
    .reduce((m, q) => Math.max(m, q.alternativas?.length || 0), 0)
  return maior >= 2 ? Math.min(maior, LETRAS.length) : 5
}

/**
 * Questões objetivas com a numeração REAL da prova.
 * Dissertativa não entra na folha (não há o que marcar), mas o
 * número dela não é reaproveitado: a folha tem que bater com a
 * prova impressa na mão do aluno.
 */
export function questoesObjetivas(prova) {
  return (prova?.questoes || [])
    .map((q, idx) => ({ ...q, numero: idx + 1 }))
    .filter(q => q.tipo === 'multipla_escolha')
}

export function questoesDissertativas(prova) {
  return (prova?.questoes || [])
    .map((q, idx) => ({ ...q, numero: idx + 1 }))
    .filter(q => q.tipo === 'dissertativa')
}

/** Código curto e estável que identifica a folha e a prova. */
export function codigoFolha(prova) {
  const base = String(prova?.id || '').replace(/[^a-zA-Z0-9]/g, '')
  return 'FR-' + (base ? base.slice(0, 6).toUpperCase() : '000000')
}

/** { "1": "C", "2": "A", ... } — só das objetivas com alternativa correta. */
export function gabaritoObjetivo(prova) {
  const gab = {}
  for (const q of questoesObjetivas(prova)) {
    const correta = q.alternativas?.find(a => a.correta)
    if (correta) gab[q.numero] = correta.letra
  }
  return gab
}

// ── Layout ────────────────────────────────────────────────────

const arredondar = (mm) => Math.floor(mm * 10) / 10
const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

/**
 * Decide em quantos blocos as questões se dividem e o tamanho de
 * linha e quadrado. As sobras da página viram quadrado maior, não
 * espaço em branco: marca grande é marca legível depois de
 * escanear, e é de graça quando a prova é curta.
 *
 * O cálculo roda uma única vez, sobre a primeira página. Todas as
 * páginas usam a mesma medida — folha com quadrado de dois
 * tamanhos confunde tanto o aluno quanto o modelo.
 */
function calcularLayout(total, nLetras) {
  const blocos = Math.min(3, Math.max(1, Math.ceil(total / MAX_LINHAS)))
  const porPagina = blocos * MAX_LINHAS
  const linhas = Math.ceil(Math.min(total, porPagina) / blocos)

  const larguraBloco = (LARGURA_UTIL - GAP_BLOCO * (blocos - 1)) / blocos
  const cell = limitar(arredondar((larguraBloco - LARGURA_NUM) / nLetras), CELL_MIN, CELL_MAX)
  const rowH = limitar(arredondar(ALTURA_GRADE / linhas), LINHA_MIN, LINHA_MAX)

  const boxW = Math.min(arredondar(cell - 2.6), BOX_MAX)
  const boxH = Math.min(arredondar(rowH - 3), arredondar(boxW * 0.8))
  const fantasma = limitar(arredondar(boxH * 1.3), 5.5, 9)

  return { blocos, porPagina, linhas, cell, rowH, boxW, boxH, fantasma }
}

function fatiar(lista, tamanho) {
  const out = []
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho))
  return out
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function escapar(txt) {
  return String(txt ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// ── Pedaços de HTML ───────────────────────────────────────────

function blocoRespostasHtml(numeros, letras) {
  const cabecalho = `
    <tr class="cab">
      <th class="cNum">Nº</th>
      ${letras.map(l => `<th class="cLetra">${l}</th>`).join('')}
    </tr>`

  const linhas = numeros.map((num, i) => `
    <tr class="${(i + 1) % 5 === 0 && i < numeros.length - 1 ? 'marcaCinco' : ''}">
      <td class="cNum">${pad2(num)}</td>
      ${letras.map(l => `
        <td class="cBox">
          <span class="box"><span class="letraFantasma">${l}</span></span>
        </td>`).join('')}
    </tr>`).join('')

  const primeiro = numeros[0]
  const ultimo = numeros[numeros.length - 1]
  // Com dissertativas no meio da prova a numeração tem buracos —
  // e aí "01 A 15" seria mentira sobre o que está impresso abaixo.
  const contiguo = ultimo - primeiro + 1 === numeros.length
  const titulo = contiguo
    ? `QUESTÕES ${pad2(primeiro)} A ${pad2(ultimo)}`
    : `QUESTÕES OBJETIVAS ${pad2(primeiro)} A ${pad2(ultimo)}`

  return `
    <div class="bloco">
      <div class="blocoTitulo">${titulo}</div>
      <table class="grade gradeResp">
        <thead>${cabecalho}</thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`
}

function chamadaHtml() {
  const digitos = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const linha = (rotulo) => `
    <tr>
      <td class="chRot">${rotulo}</td>
      ${digitos.map(d => `
        <td class="cBox">
          <span class="box"><span class="letraFantasma">${d}</span></span>
        </td>`).join('')}
    </tr>`

  return `
    <div class="chamada">
      <div class="chTitulo">NÚMERO DE CHAMADA <span class="chObrig">(obrigatório)</span></div>
      <div class="chCorpo">
        <div class="chEscrita">
          <div class="chEscritaRot">Escreva</div>
          <div class="chCaixas">
            <span class="caixaDigito"><span class="caixaRot">D</span></span>
            <span class="caixaDigito"><span class="caixaRot">U</span></span>
          </div>
        </div>
        <table class="grade gradeCh">
          <thead>
            <tr class="cab">
              <th class="chRot"></th>
              ${digitos.map(d => `<th class="cLetra">${d}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${linha('D')}
            ${linha('U')}
          </tbody>
        </table>
      </div>
      <div class="chNota">
        D = dezena, U = unidade. Chamada 7 → escreva <b>0</b> e <b>7</b>, marque <b>0</b> em D e <b>7</b> em U.
      </div>
    </div>`
}

function identificacaoHtml(prova, opcoes) {
  const disciplina = prova?.disciplinas?.nome ? escapar(prova.disciplinas.nome) : ''
  const ano = prova?.ano_escolar ? escapar(prova.ano_escolar) : ''
  const sub = [disciplina, ano].filter(Boolean).join(' · ')

  return `
    <header class="topo">
      <div class="topoEsq">
        <div class="topoTitulo">FOLHA DE RESPOSTAS</div>
        <div class="topoProva">${escapar(prova?.titulo || 'Prova')}</div>
        ${sub ? `<div class="topoSub">${sub}</div>` : ''}
      </div>
      <div class="topoDir">
        <div class="codigoRot">CÓDIGO DA PROVA</div>
        <div class="codigo">${escapar(opcoes.codigo)}</div>
      </div>
    </header>

    <section class="identificacao">
      <div class="campos">
        <div class="campo campoLargo">
          <span class="campoRot">ESCOLA</span><span class="campoLinha"></span>
        </div>
        <div class="campo">
          <span class="campoRot">TURMA</span><span class="campoLinha"></span>
        </div>
        <div class="campo">
          <span class="campoRot">DATA</span><span class="campoLinha"></span>
        </div>
        ${opcoes.campoNome ? `
        <div class="campo campoLargo">
          <span class="campoRot">NOME DO ALUNO</span><span class="campoLinha"></span>
        </div>` : ''}
      </div>
      ${chamadaHtml()}
    </section>`
}

function instrucoesHtml() {
  return `
    <section class="instrucoes">
      <div class="instrTexto">
        <b>COMO PREENCHER</b>
        <ol>
          <li>Use caneta esferográfica <b>azul ou preta</b>. Não use lápis.</li>
          <li>Pinte <b>todo</b> o quadrado, até cobrir a letra impressa.</li>
          <li>Marque <b>uma única</b> alternativa por questão.</li>
          <li>Errou? <b>Não rasure e não apague.</b> Peça outra folha.</li>
          <li>Não escreva nem apoie a mão sobre os quadrados pretos dos cantos.</li>
        </ol>
      </div>
      <div class="instrExemplos">
        <div class="exemplo">
          <span class="box boxCerto"></span>
          <span class="exemploRot exemploCerto">CERTO</span>
        </div>
        <div class="exemploGrupo">
          <span class="box boxErrX"></span>
          <span class="box boxErrCirc"></span>
          <span class="box boxErrTraco"></span>
          <span class="exemploRot exemploErrado">ERRADO</span>
        </div>
      </div>
    </section>`
}

function cantosHtml() {
  return `
    <span class="canto cantoSE"></span>
    <span class="canto cantoSD"></span>
    <span class="canto cantoIE"></span>
    <span class="canto cantoID"></span>`
}

function estilos(layout) {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0; background: #fff; color: #000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;

      --cell: ${layout.cell}mm;
      --rowH: ${layout.rowH}mm;
      --boxW: ${layout.boxW}mm;
      --boxH: ${layout.boxH}mm;
      --fantasma: ${layout.fantasma}pt;
    }

    .folha {
      position: relative;
      width: 210mm; min-height: 297mm;
      padding: 12mm;
      margin: 0 auto;
      background: #fff;
      page-break-after: always;
    }
    .folha:last-child { page-break-after: auto; }

    /* Marcas de canto — delimitam a folha e resolvem orientação.
       A do canto superior esquerdo é maior de propósito. */
    .canto { position: absolute; background: #000; }
    .cantoSE { top: 5mm; left: 5mm;  width: 9mm; height: 9mm; }
    .cantoSD { top: 5mm; right: 5mm; width: 6mm; height: 6mm; }
    .cantoIE { bottom: 5mm; left: 5mm;  width: 6mm; height: 6mm; }
    .cantoID { bottom: 5mm; right: 5mm; width: 6mm; height: 6mm; }

    /* ── Topo ── */
    .topo {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 8mm; border-bottom: 1.2mm solid #000; padding-bottom: 2mm;
    }
    .topoTitulo { font-size: 16pt; font-weight: 700; letter-spacing: 0.5pt; line-height: 1.1; }
    .topoProva  { font-size: 11pt; font-weight: 700; margin-top: 1mm; }
    .topoSub    { font-size: 9pt; margin-top: 0.5mm; }
    .topoDir    { text-align: right; flex-shrink: 0; }
    .codigoRot  { font-size: 6.5pt; letter-spacing: 0.5pt; }
    .codigo {
      font-family: 'Courier New', monospace; font-size: 15pt; font-weight: 700;
      border: 0.5mm solid #000; padding: 1mm 3mm; margin-top: 1mm; letter-spacing: 1pt;
    }

    /* ── Identificação ── */
    .identificacao {
      display: flex; gap: 6mm; align-items: stretch;
      margin-top: 3mm;
    }
    .campos { flex: 1; display: flex; flex-wrap: wrap; gap: 3mm 4mm; align-content: flex-start; }
    .campo { display: flex; align-items: flex-end; gap: 2mm; flex: 1 1 40%; }
    .campoLargo { flex-basis: 100%; }
    .campoRot { font-size: 7.5pt; font-weight: 700; white-space: nowrap; }
    .campoLinha { flex: 1; border-bottom: 0.35mm solid #000; height: 6mm; }

    /* ── Número de chamada ── */
    .chamada { border: 0.5mm solid #000; padding: 2mm; flex-shrink: 0; }
    .chTitulo { font-size: 8pt; font-weight: 700; margin-bottom: 1.5mm; }
    .chObrig { font-weight: 400; }
    .chCorpo { display: flex; align-items: flex-start; gap: 3mm; }
    .chEscrita { text-align: center; }
    .chEscritaRot { font-size: 6.5pt; margin-bottom: 1mm; }
    .chCaixas { display: flex; gap: 1.5mm; }
    .caixaDigito {
      position: relative; display: block;
      width: 10mm; height: 12mm; border: 0.5mm solid #000;
    }
    .caixaRot {
      position: absolute; top: 0.3mm; left: 0.6mm;
      font-size: 5.5pt; color: #b0b0b0;
    }
    .chRot { font-size: 7.5pt; font-weight: 700; width: 6mm; text-align: center; }
    .chNota { font-size: 6.5pt; margin-top: 1.5mm; }

    /* ── Instruções ── */
    .instrucoes {
      display: flex; gap: 6mm; align-items: center;
      border: 0.5mm solid #000; padding: 2mm 3mm; margin-top: 3mm;
    }
    .instrTexto { flex: 1; font-size: 7.5pt; line-height: 1.35; }
    .instrTexto ol { margin: 1mm 0 0; padding-left: 4mm; }
    .instrExemplos { display: flex; gap: 5mm; align-items: center; flex-shrink: 0; }
    .exemplo, .exemploGrupo { text-align: center; }
    .exemploGrupo .box { margin: 0 0.8mm; }
    .exemploRot { display: block; font-size: 6.5pt; font-weight: 700; margin-top: 1mm; }
    .exemploCerto::before  { content: '✔ '; }
    .exemploErrado::before { content: '✘ '; }

    /* ── Grade de respostas ── */
    .respostas { display: flex; gap: ${GAP_BLOCO}mm; margin-top: 4mm; justify-content: center; }
    .bloco { flex-shrink: 0; }
    .blocoTitulo {
      font-size: 7.5pt; font-weight: 700; text-align: center;
      margin-bottom: 1mm; letter-spacing: 0.3pt;
    }
    .grade { border-collapse: collapse; }
    .grade td, .grade th { border: 0.3mm solid #000; padding: 0; text-align: center; }
    .grade .cab th { border-bottom: 0.7mm solid #000; }
    .cNum {
      width: ${LARGURA_NUM}mm;
      font-size: 9pt; font-weight: 700; font-family: 'Courier New', monospace;
    }
    .cLetra { height: 5mm; font-size: 8pt; font-weight: 700; }
    .cBox { vertical-align: middle; }
    .marcaCinco td { border-bottom: 0.7mm solid #000; }

    /* A grade de respostas herda as medidas calculadas para a prova;
       a de chamada tem tamanho fixo, porque sempre tem 10 colunas. */
    .gradeResp .cNum, .gradeResp .cBox { height: var(--rowH); }
    .gradeResp .cBox, .gradeResp .cLetra { width: var(--cell); }
    .gradeResp .box { width: var(--boxW); height: var(--boxH); }
    .gradeResp .letraFantasma { font-size: var(--fantasma); }

    .gradeCh .cBox, .gradeCh .cLetra { width: 6.6mm; }
    .gradeCh .cBox { height: 6.6mm; }

    /* O quadrado a marcar. A letra fantasma é a âncora de coluna:
       clara o bastante para não virar marca, escura o bastante
       para sobreviver ao escaneamento em tons de cinza. */
    .box {
      display: inline-flex; align-items: center; justify-content: center;
      width: 5.6mm; height: 5mm;
      border: 0.4mm solid #000;
    }
    .letraFantasma { font-size: 6pt; color: #bdbdbd; }

    .boxCerto { background: #000; }
    .boxErrX::before      { content: '✕'; font-size: 8pt; }
    .boxErrCirc::before   { content: '◯'; font-size: 7pt; }
    .boxErrTraco::before  { content: '╱'; font-size: 8pt; }

    /* ── Rodapé ── */
    .aviso {
      font-size: 7pt; margin-top: 3mm; border-top: 0.35mm solid #000; padding-top: 1.5mm;
    }
    .rodape {
      position: absolute; left: 12mm; right: 12mm; bottom: 6mm;
      display: flex; justify-content: space-between;
      font-size: 7pt; font-family: 'Courier New', monospace;
    }

    @media screen {
      body { background: #e2e8f0; padding: 12px 0; }
      .folha { box-shadow: 0 4px 18px rgba(0,0,0,0.18); margin-bottom: 12px; }
    }
  `
}

// ── Documento ─────────────────────────────────────────────────

/**
 * Monta o HTML completo da folha de respostas.
 *
 * @param {object} prova
 * @param {object} opcoes
 *   nLetras     – quantidade de alternativas (4 a 6)
 *   numeros     – array com os números das questões (default: objetivas da prova)
 *   campoNome   – inclui linha para o nome do aluno
 *   dissertativas – números das questões corrigidas fora da folha
 */
export function montarFolhaRespostaHtml(prova, opcoes = {}) {
  const nLetras = Math.min(Math.max(opcoes.nLetras || alternativasDaProva(prova), 2), LETRAS.length)
  const letras = LETRAS.slice(0, nLetras)
  const numeros = opcoes.numeros?.length
    ? opcoes.numeros
    : questoesObjetivas(prova).map(q => q.numero)
  const codigo = opcoes.codigo || codigoFolha(prova)
  const campoNome = opcoes.campoNome !== false
  const dissertativas = opcoes.dissertativas || questoesDissertativas(prova).map(q => q.numero)

  if (numeros.length === 0) {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
      <title>Folha de respostas</title></head>
      <body style="font-family:Arial,sans-serif;padding:40px">
        <h2>Nada a marcar nesta folha</h2>
        <p>Esta prova não tem questões de múltipla escolha. Informe a
        quantidade de questões manualmente para gerar uma folha avulsa.</p>
      </body></html>`
  }

  const layout = calcularLayout(numeros.length, nLetras)
  const paginas = fatiar(numeros, layout.porPagina)

  const avisoDissertativas = dissertativas.length > 0
    ? `<div class="aviso"><b>Atenção:</b> as questões dissertativas
       (${dissertativas.map(pad2).join(', ')}) não são marcadas nesta folha —
       são corrigidas diretamente no caderno de prova.</div>`
    : ''

  const folhas = paginas.map((numerosPagina, iPag) => {
    const colunas = fatiar(numerosPagina, layout.linhas)
    const blocos = colunas.map(col => blocoRespostasHtml(col, letras)).join('')

    return `
      <div class="folha">
        ${cantosHtml()}
        ${identificacaoHtml(prova, { codigo, campoNome })}
        ${instrucoesHtml()}
        <section class="respostas">${blocos}</section>
        ${iPag === paginas.length - 1 ? avisoDissertativas : ''}
        <div class="rodape">
          <span>${escapar(codigo)}</span>
          <span>PAGINA ${iPag + 1} DE ${paginas.length}</span>
          <span>${numeros.length} QUESTOES · ${nLetras} ALTERNATIVAS</span>
        </div>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Folha de respostas — ${escapar(prova?.titulo || 'Prova')}</title>
  <style>${estilos(layout)}</style>
</head>
<body>${folhas}</body>
</html>`
}

// ── Apoio à correção pelo Gemini ──────────────────────────────

/**
 * Pacote de dados da folha, no formato que o prompt de correção
 * consome. Serve também para conferência manual do professor.
 */
export function dadosCorrecao(prova, opcoes = {}) {
  const nLetras = Math.min(Math.max(opcoes.nLetras || alternativasDaProva(prova), 2), LETRAS.length)
  const numeros = opcoes.numeros?.length
    ? opcoes.numeros
    : questoesObjetivas(prova).map(q => q.numero)
  const gabarito = gabaritoObjetivo(prova)
  const layout = calcularLayout(numeros.length, nLetras)

  return {
    codigo: opcoes.codigo || codigoFolha(prova),
    prova: prova?.titulo || 'Prova',
    disciplina: prova?.disciplinas?.nome || null,
    ano_escolar: prova?.ano_escolar || null,
    alternativas: LETRAS.slice(0, nLetras),
    questoes: numeros,
    paginas: Math.ceil(numeros.length / layout.porPagina),
    gabarito: numeros.reduce((acc, n) => {
      acc[n] = gabarito[n] || null
      return acc
    }, {}),
  }
}

/** Prompt pronto para colar no Gemini junto com as folhas escaneadas. */
export function promptGemini(prova, opcoes = {}) {
  const d = dadosCorrecao(prova, opcoes)
  const letras = d.alternativas.join(', ')
  const semGabarito = Object.entries(d.gabarito).filter(([, v]) => !v).map(([k]) => k)
  const comGabarito = d.questoes.length - semGabarito.length

  return `Você vai ler folhas de respostas escaneadas e corrigi-las. Siga as regras à risca.

## A folha

Cada imagem é uma folha de respostas de um aluno, código ${d.codigo}.
Ela tem quatro quadrados pretos nos cantos; o do canto superior esquerdo é maior
e indica o topo da folha. Se a imagem estiver girada, corrija a orientação por
esse quadrado antes de ler.

A folha tem duas grades:

1. NÚMERO DE CHAMADA — duas caixas grandes com os dígitos escritos à mão
   (D = dezena, U = unidade) e, ao lado, uma grade com as linhas D e U e as
   colunas 0 a 9, onde o aluno pinta um quadrado em cada linha.
2. RESPOSTAS — uma ou mais tabelas. A primeira coluna traz o número da questão
   com dois dígitos. As demais colunas são as alternativas ${letras}.

Cada quadrado tem a letra (ou o dígito) impressa em cinza claro no centro.
Essa letra impressa NÃO é marca do aluno: serve só para você identificar a
coluna. Marca do aluno é traço escuro de caneta cobrindo o quadrado.

A folha desta prova tem ${d.paginas === 1 ? 'uma única página' : `${d.paginas} páginas`} e ${d.questoes.length} questões,
numeradas: ${d.questoes.join(', ')}.
${d.paginas > 1 ? `
Cada página traz de novo o número de chamada, e o rodapé indica "PAGINA X DE ${d.paginas}".
Junte as páginas do mesmo aluno em um único objeto de saída, pelo número de
chamada. Se faltar alguma página de um aluno, produza o objeto assim mesmo,
com as questões da página que falta como \`"?"\`, e marque \`revisar\` como \`true\`.
` : ''}
## Regras de leitura

- Leia linha por linha, usando o número impresso na primeira coluna. Nunca
  deduza o número da questão pela posição na tabela.
- O array \`respostas\` precisa ter exatamente ${d.questoes.length} itens, um para cada
  número da lista acima, em ordem crescente. Não pule questão nem invente
  questão que não está na lista.
- Considere marcada a alternativa cujo quadrado está claramente mais escuro que
  os demais da mesma linha.
- Nenhum quadrado escurecido na linha → \`"-"\` (em branco).
- Dois ou mais quadrados escurecidos na mesma linha → \`"*"\` (marca dupla).
- Marca fraca, rasurada, ambígua ou cortada na imagem → \`"?"\` (ilegível).
- Não invente e não complete. Na dúvida entre uma letra e \`"?"\`, escolha \`"?"\`.
- Não use o gabarito para decidir o que o aluno marcou. Leia a imagem primeiro,
  compare depois.

## Número de chamada

Leia as duas fontes de forma independente:
- \`chamada_escrita\`: os dígitos manuscritos nas caixas D e U.
- \`chamada_marcada\`: os dígitos correspondentes aos quadrados pintados nas
  linhas D e U da grade.

Se as duas coincidirem, \`chamada\` recebe esse valor e \`chamada_conflito\` é
\`false\`. Se divergirem, ou se uma delas for ilegível, \`chamada\` recebe \`null\`
e \`chamada_conflito\` é \`true\`. Nunca escolha uma das duas por conta própria:
folha com conflito volta para conferência do professor.

## Gabarito

\`\`\`json
${JSON.stringify(d.gabarito, null, 2)}
\`\`\`
${semGabarito.length ? `
Atenção: as questões ${semGabarito.join(', ')} estão sem gabarito cadastrado.
Transcreva a marcação normalmente e classifique o resultado como "sem_gabarito".
` : ''}
## Correção

Depois de transcrever, compare cada resposta com o gabarito:
- igual ao gabarito → \`"certo"\`
- diferente do gabarito → \`"errado"\`
- \`"-"\`, \`"*"\` ou \`"?"\` → \`"nao_corrigida"\`
- questão sem gabarito → \`"sem_gabarito"\`

\`acertos\` conta apenas \`"certo"\`. \`nota\` = acertos ÷ ${comGabarito} × 10, com uma casa
decimal. Questão em branco, dupla ou ilegível conta como erro na nota, mas fica
registrada com o resultado próprio para o professor conferir.

## Saída

Responda SOMENTE com um array JSON, um objeto por aluno, sem texto em volta:

\`\`\`json
[
  {
    "arquivo": "nome do arquivo da imagem",
    "codigo_folha": "${d.codigo}",
    "chamada": 7,
    "chamada_escrita": "07",
    "chamada_marcada": "07",
    "chamada_conflito": false,
    "turma": "texto escrito no campo TURMA, ou null",
    "respostas": [
      { "questao": ${d.questoes[0] ?? 1}, "marcada": "C", "gabarito": "C", "resultado": "certo" }
    ],
    "acertos": 0,
    "total_com_gabarito": ${comGabarito},
    "nota": 0.0,
    "revisar": false,
    "motivo_revisao": null
  }
]
\`\`\`

\`revisar\` é \`true\` sempre que houver conflito de chamada, ou qualquer resposta
\`"?"\` ou \`"*"\`, ou o código da folha não bater com ${d.codigo}. Em
\`motivo_revisao\`, diga em uma frase o que precisa de conferência humana.

Não escreva nome de aluno em nenhum campo além de \`turma\`. A identificação
oficial é o número de chamada.`
}

// ── Ações de tela ─────────────────────────────────────────────

export function imprimirFolhaResposta(prova, opcoes = {}) {
  const html = montarFolhaRespostaHtml(prova, opcoes)
  const win = window.open('', '_blank')
  if (!win) throw new Error('O navegador bloqueou a janela de impressão. Libere os pop-ups deste site.')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}
