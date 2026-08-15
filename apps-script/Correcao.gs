/**
 * Correção de folhas de resposta por IA — Google Apps Script
 * Repositório Pedagógico Municipal · SME Ribeirão Preto
 *
 * Lê as folhas escaneadas de uma pasta do Drive, manda cada uma para o
 * Gemini transcrever, compara com o gabarito e escreve o resultado na
 * aba "Respostas" desta planilha.
 *
 * ── Divisão de trabalho ────────────────────────────────────────────
 * O Gemini SÓ TRANSCREVE o que está marcado. Quem compara com o
 * gabarito, conta acertos e calcula nota é este script.
 *
 * Isso não é preciosismo. Modelo que recebe o gabarito junto com a
 * imagem tende a "ler" o que o gabarito manda quando a marca está
 * ambígua, e erro de aritmética de modelo é silencioso. Separando as
 * duas coisas, a leitura fica sem viés e a conta fica exata.
 *
 * ── Instalação ─────────────────────────────────────────────────────
 * 1. Planilha nova → Extensões → Apps Script → cole este arquivo.
 * 2. Salve, recarregue a planilha. Aparece o menu "Correção IA".
 * 3. Correção IA → Preparar planilha.
 * 4. Correção IA → Configurar chave da API (chave do Google AI
 *    Studio: https://aistudio.google.com/apikey).
 * 5. Preencha a aba Config e cole o gabarito na aba Gabarito.
 * 6. Correção IA → Corrigir folhas da pasta.
 *
 * A chave da API fica nas Propriedades do Script, não na planilha.
 * Planilha se compartilha por engano; propriedade do script, não.
 */

// ── Nomes de aba ─────────────────────────────────────────────────
var ABA_CONFIG    = 'Config'
var ABA_GABARITO  = 'Gabarito'
var ABA_RESPOSTAS = 'Respostas'
var ABA_ITENS     = 'Itens'
var ABA_LOG       = 'Log'

var PROP_CHAVE = 'GEMINI_API_KEY'

// Apps Script corta a execução em 6 minutos (30 em conta Workspace).
// Paramos antes disso e deixamos o resto para a próxima rodada — os
// arquivos já processados são pulados, então é só rodar de novo.
var LIMITE_EXECUCAO_MS = 4.5 * 60 * 1000

// O corpo da requisição vai em base64, que infla o arquivo em 1/3.
// Acima disto a chamada estoura o limite da API.
var MAX_BYTES_ARQUIVO = 14 * 1024 * 1024

var TENTATIVAS = 4
var ESPERA_INICIAL_MS = 2000

var COLUNAS_STATUS = [
  'ID do arquivo', 'Arquivo', 'Chamada', 'Turma',
  'Chamada escrita', 'Chamada marcada', 'Conflito',
  'Acertos', 'Total', 'Nota', 'Revisar', 'Motivo',
]
var COL_ID = 1, COL_ARQUIVO = 2, COL_CHAMADA = 3, COL_TURMA = 4,
    COL_ESCRITA = 5, COL_MARCADA = 6, COL_CONFLITO = 7,
    COL_ACERTOS = 8, COL_TOTAL = 9, COL_NOTA = 10,
    COL_REVISAR = 11, COL_MOTIVO = 12
var PRIMEIRA_COL_QUESTAO = COLUNAS_STATUS.length + 1

var COR_ERRADO   = '#fde2e2'
var COR_ATENCAO  = '#fff3cd'
var COR_NEUTRO   = '#eeeeee'
var COR_REVISAR  = '#ffd8a8'

var MIMES_ACEITOS = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
]

// ── Menu ─────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Correção IA')
    .addItem('Preparar planilha', 'prepararPlanilha')
    .addItem('Configurar chave da API…', 'configurarChave')
    .addSeparator()
    .addItem('Corrigir folhas da pasta', 'corrigirFolhas')
    .addItem('Recalcular acertos e estatísticas', 'recalcularTudo')
    .addSeparator()
    .addItem('Limpar resultados', 'limparResultados')
    .addToUi()
}

// ── Preparação ───────────────────────────────────────────────────

function prepararPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()

  var config = obterOuCriarAba(ss, ABA_CONFIG)
  if (config.getLastRow() === 0) {
    config.getRange(1, 1, 1, 3).setValues([['Parâmetro', 'Valor', 'O que é']])
    config.getRange(2, 1, 6, 3).setValues([
      ['pasta_drive_id', '', 'ID da pasta do Drive com as folhas escaneadas (o trecho da URL depois de /folders/)'],
      ['codigo_folha',   '', 'Código impresso na folha, ex.: FR-A1B2C3. Folha com outro código é sinalizada'],
      ['alternativas',   5,  'Quantas alternativas por questão (4, 5 ou 6)'],
      ['modelo',         'gemini-2.5-pro', 'Modelo do Gemini. pro é o confiável para grade de respostas; flash é mais barato mas erra folha densa'],
      ['nota_maxima',    10, 'Escala da nota'],
      ['turma_padrao',   '', 'Usado quando a IA não consegue ler o campo TURMA da folha (opcional)'],
    ])
    config.setColumnWidth(1, 150)
    config.setColumnWidth(2, 220)
    config.setColumnWidth(3, 520)
    config.getRange(1, 1, 1, 3).setFontWeight('bold')
    config.setFrozenRows(1)
  }

  var gabarito = obterOuCriarAba(ss, ABA_GABARITO)
  if (gabarito.getLastRow() === 0) {
    gabarito.getRange(1, 1, 1, 2).setValues([['Questão', 'Correta']])
    gabarito.getRange(1, 1, 1, 2).setFontWeight('bold')
    gabarito.setFrozenRows(1)
    gabarito.getRange(2, 1).setNote(
      'Cole aqui o gabarito copiado do Repositório Pedagógico ' +
      '(Prova → Folha de respostas → Copiar gabarito para planilha).\n\n' +
      'Uma linha por questão: número na coluna A, letra correta na coluna B. ' +
      'Questão sem letra é transcrita mas não entra na nota.')
  }

  obterOuCriarAba(ss, ABA_RESPOSTAS)
  obterOuCriarAba(ss, ABA_ITENS)
  obterOuCriarAba(ss, ABA_LOG)

  SpreadsheetApp.getUi().alert(
    'Planilha preparada.\n\n' +
    'Agora: preencha a aba Config, cole o gabarito na aba Gabarito e ' +
    'configure a chave da API pelo menu.')
}

function configurarChave() {
  var ui = SpreadsheetApp.getUi()
  var atual = PropertiesService.getScriptProperties().getProperty(PROP_CHAVE)
  var resposta = ui.prompt(
    'Chave da API do Gemini',
    (atual ? 'Já existe uma chave configurada. ' : '') +
    'Cole a chave gerada em aistudio.google.com/apikey.\n\n' +
    'Ela fica nas Propriedades do Script, não na planilha.',
    ui.ButtonSet.OK_CANCEL)

  if (resposta.getSelectedButton() !== ui.Button.OK) return

  var chave = resposta.getResponseText().trim()
  if (!chave) { ui.alert('Nada foi salvo: a chave veio em branco.'); return }

  PropertiesService.getScriptProperties().setProperty(PROP_CHAVE, chave)
  ui.alert('Chave salva.')
}

// ── Leitura da configuração ──────────────────────────────────────

function obterConfig() {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_CONFIG)
  if (!aba) throw new Error('Aba "' + ABA_CONFIG + '" não existe. Rode "Preparar planilha".')

  var cfg = {}
  var ultima = aba.getLastRow()
  if (ultima >= 2) {
    var linhas = aba.getRange(2, 1, ultima - 1, 2).getValues()
    for (var i = 0; i < linhas.length; i++) {
      var chave = String(linhas[i][0]).trim()
      if (chave) cfg[chave] = linhas[i][1]
    }
  }

  var pasta = String(cfg.pasta_drive_id || '').trim()
  if (!pasta) throw new Error('Informe "pasta_drive_id" na aba Config.')

  // Aceita a URL inteira colada, não só o ID — é o erro mais comum.
  var m = pasta.match(/[-\w]{25,}/)
  if (m) pasta = m[0]

  var nAlt = Number(cfg.alternativas) || 5
  if (nAlt < 2 || nAlt > 6) throw new Error('"alternativas" precisa estar entre 2 e 6.')

  return {
    pastaId: pasta,
    codigoFolha: String(cfg.codigo_folha || '').trim(),
    nAlternativas: nAlt,
    letras: 'ABCDEF'.slice(0, nAlt).split(''),
    modelo: String(cfg.modelo || 'gemini-2.5-pro').trim(),
    notaMaxima: Number(cfg.nota_maxima) || 10,
    turmaPadrao: String(cfg.turma_padrao || '').trim(),
  }
}

function obterGabarito() {
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_GABARITO)
  if (!aba) throw new Error('Aba "' + ABA_GABARITO + '" não existe. Rode "Preparar planilha".')

  var ultima = aba.getLastRow()
  if (ultima < 2) throw new Error('A aba Gabarito está vazia. Cole o gabarito da prova.')

  var linhas = aba.getRange(2, 1, ultima - 1, 2).getValues()
  var questoes = []
  var mapa = {}
  var vistas = {}

  for (var i = 0; i < linhas.length; i++) {
    var num = parseInt(linhas[i][0], 10)
    if (isNaN(num)) continue
    if (vistas[num]) throw new Error('A questão ' + num + ' aparece duas vezes na aba Gabarito.')
    vistas[num] = true

    var letra = String(linhas[i][1] || '').trim().toUpperCase()
    questoes.push(num)
    mapa[num] = letra || null
  }

  if (questoes.length === 0) throw new Error('Nenhuma questão válida na aba Gabarito.')
  questoes.sort(function (a, b) { return a - b })

  return { questoes: questoes, mapa: mapa }
}

// ── Correção ─────────────────────────────────────────────────────

function corrigirFolhas() {
  var inicio = Date.now()
  var ui = SpreadsheetApp.getUi()

  var chave = PropertiesService.getScriptProperties().getProperty(PROP_CHAVE)
  if (!chave) { ui.alert('Configure a chave da API primeiro (menu Correção IA).'); return }

  var cfg, gab
  try {
    cfg = obterConfig()
    gab = obterGabarito()
  } catch (e) {
    ui.alert(String(e.message)); return
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var aba = prepararAbaRespostas(ss, gab.questoes)
  var indice = montarIndice(aba, gab.questoes)

  var arquivos = listarArquivos(cfg.pastaId)
  if (arquivos.length === 0) {
    ui.alert('Nenhuma imagem ou PDF encontrado na pasta informada.'); return
  }

  var pendentes = arquivos.filter(function (f) { return !indice.arquivos[f.getId()] })
  if (pendentes.length === 0) {
    ui.alert('Todas as ' + arquivos.length + ' folhas da pasta já foram corrigidas.\n\n' +
             'Para refazer, use "Limpar resultados".')
    return
  }

  var prompt = construirPrompt(cfg, gab.questoes)
  var processados = 0, falhas = 0, faltando = 0

  for (var i = 0; i < pendentes.length; i++) {
    if (Date.now() - inicio > LIMITE_EXECUCAO_MS) {
      faltando = pendentes.length - i
      break
    }

    var arquivo = pendentes[i]
    try {
      var folhas = lerFolha(arquivo, prompt, cfg, chave)
      for (var j = 0; j < folhas.length; j++) {
        gravarFolha(aba, indice, folhas[j], arquivo, cfg, gab)
      }
      processados++
      registrarLog('ok', arquivo.getName(), folhas.length + ' folha(s) lida(s)')
    } catch (e) {
      falhas++
      registrarLog('erro', arquivo.getName(), String(e.message))
    }
  }

  recalcularItens(gab, cfg)
  SpreadsheetApp.flush()

  var msg = processados + ' arquivo(s) processado(s).'
  if (falhas) msg += '\n' + falhas + ' com erro — veja a aba Log.'
  if (faltando) {
    msg += '\n\n' + faltando + ' arquivo(s) ficaram para a próxima rodada ' +
           '(limite de tempo do Apps Script). Rode "Corrigir folhas da pasta" ' +
           'de novo: os já processados são pulados.'
  }
  var revisar = contarRevisar(aba)
  if (revisar) msg += '\n\n' + revisar + ' folha(s) marcada(s) para conferência humana.'

  ui.alert(msg)
}

/** Arquivos da pasta que o Gemini consegue ler, em ordem de nome. */
function listarArquivos(pastaId) {
  var pasta
  try {
    pasta = DriveApp.getFolderById(pastaId)
  } catch (e) {
    throw new Error('Não consegui abrir a pasta ' + pastaId + '. ' +
                    'Confira o ID e se a conta que roda o script tem acesso.')
  }

  var lista = []
  var it = pasta.getFiles()
  while (it.hasNext()) {
    var f = it.next()
    if (MIMES_ACEITOS.indexOf(f.getMimeType()) !== -1) lista.push(f)
  }
  lista.sort(function (a, b) { return a.getName().localeCompare(b.getName(), 'pt-BR') })
  return lista
}

// ── Chamada ao Gemini ────────────────────────────────────────────

function construirPrompt(cfg, questoes) {
  var letras = cfg.letras.join(', ')
  return [
    'Transcreva as marcações desta folha de resposta escaneada.',
    '',
    'Seu trabalho é APENAS ler o que está marcado. Não corrija, não pontue,',
    'não avalie se a resposta está certa. Você não recebe o gabarito de propósito.',
    '',
    '## A folha',
    '',
    'Tem quatro quadrados pretos nos cantos; o do canto superior esquerdo é',
    'maior e indica o topo. Se a imagem estiver girada, corrija a orientação',
    'por esse quadrado antes de ler.',
    '',
    'Duas grades:',
    '1. NÚMERO DE CHAMADA — duas caixas com dígitos escritos à mão (D = dezena,',
    '   U = unidade) e uma grade com linhas D e U e colunas de 0 a 9.',
    '2. RESPOSTAS — a primeira coluna traz o número da questão com dois dígitos;',
    '   as demais são as alternativas ' + letras + '.',
    '',
    'Cada quadrado tem a letra (ou o dígito) impressa em cinza claro no centro.',
    'Essa letra impressa NÃO é marca do aluno: serve para você identificar a',
    'coluna. Marca do aluno é rabisco escuro de caneta cobrindo o quadrado —',
    'em geral cobre a letra parcial ou totalmente.',
    '',
    'ATENÇÃO: a folha contém textos impressos de instrução, entre eles um',
    'EXEMPLO que cita "Chamada 7" e um quadrado pintado de exemplo na área',
    '"COMO PREENCHER". Nada disso é resposta do aluno. Nunca copie número ou',
    'letra de texto impresso: só de marca de caneta dentro das grades.',
    '',
    'Questões impressas nesta folha: ' + questoes.join(', ') + '.',
    '',
    '## Regras de leitura',
    '',
    'Trabalhe bloco por bloco, linha por linha, sem pular nem resumir:',
    '1. Localize a linha pelo número impresso na primeira coluna. Nunca deduza',
    '   o número da questão pela posição na tabela.',
    '2. Olhe cada um dos quadrados daquela linha, um a um, e diga qual tem',
    '   rabisco de caneta. Só então registre a letra da coluna.',
    '3. Não use padrão, sequência ou "impressão geral": cada linha é uma',
    '   observação independente da imagem.',
    '',
    '- Devolva exatamente ' + questoes.length + ' itens em "respostas", um para cada número',
    '  da lista acima, em ordem crescente.',
    '- Marcada = o quadrado claramente mais escuro que os outros da mesma linha.',
    '- Nenhum quadrado escurecido na linha: "-"',
    '- Dois ou mais escurecidos na mesma linha: "*"',
    '- Marca fraca, rasurada, ambígua ou cortada na imagem: "?"',
    '- Na dúvida entre uma letra e "?", devolva "?". Não chute.',
    '',
    '## Número de chamada',
    '',
    'Leia as duas fontes de forma independente e sem tentar conciliá-las:',
    '- chamada_escrita: os dois dígitos manuscritos DENTRO das caixas "Escreva".',
    '  Caixas em branco, sem dígito manuscrito, são "?" — não deduza o valor da',
    '  grade ao lado nem de nenhum texto impresso.',
    '- chamada_marcada: os dígitos pintados nas linhas D e U da grade.',
    'Se uma fonte estiver ilegível ou em branco, devolva "?" naquele campo.',
    'Quem decide o que fazer com a divergência não é você.',
    '',
    '## Arquivo com várias folhas',
    '',
    'Se este arquivo tiver mais de uma página, devolva um item por página em',
    '"folhas", na ordem em que aparecem, com pagina_no_arquivo começando em 1.',
    'Se for uma única folha, devolva um item só.',
    '',
    'Copie em codigo_folha o código impresso no alto da folha (formato FR-XXXXXX)',
    'e em turma o que estiver escrito no campo TURMA, ou "" se estiver em branco.',
    'Em total_questoes_impressas, conte quantas linhas de questão a folha',
    'realmente tem (o rodapé dela diz "N QUESTOES") — mesmo que seja diferente',
    'da lista acima.',
  ].join('\n')
}

function esquemaResposta() {
  return {
    type: 'OBJECT',
    properties: {
      folhas: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            pagina_no_arquivo: { type: 'INTEGER' },
            codigo_folha:      { type: 'STRING' },
            turma:             { type: 'STRING' },
            total_questoes_impressas: { type: 'INTEGER' },
            chamada_escrita:   { type: 'STRING' },
            chamada_marcada:   { type: 'STRING' },
            respostas: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  questao: { type: 'INTEGER' },
                  marcada: { type: 'STRING' },
                },
                required: ['questao', 'marcada'],
              },
            },
            observacao: { type: 'STRING' },
          },
          required: ['chamada_escrita', 'chamada_marcada', 'respostas'],
        },
      },
    },
    required: ['folhas'],
  }
}

function lerFolha(arquivo, prompt, cfg, chave) {
  var blob = arquivo.getBlob()
  var bytes = blob.getBytes()
  if (bytes.length > MAX_BYTES_ARQUIVO) {
    throw new Error('Arquivo de ' + Math.round(bytes.length / 1048576) + ' MB — ' +
                    'acima do limite da API. Escaneie em 300 dpi tons de cinza, não em cor.')
  }

  var corpo = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: blob.getContentType(), data: Utilities.base64Encode(bytes) } },
      ],
    }],
    generationConfig: {
      // Leitura de marca não é tarefa criativa: temperatura 0 para que
      // a mesma folha dê o mesmo resultado se for reprocessada.
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: esquemaResposta(),
    },
  }

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(cfg.modelo) + ':generateContent'

  var resposta = requisitarComRetentativa(url, chave, corpo)
  var texto = extrairTexto(resposta)

  var dados
  try {
    dados = JSON.parse(texto)
  } catch (e) {
    throw new Error('A resposta do modelo não veio em JSON válido.')
  }

  var folhas = dados && dados.folhas ? dados.folhas : []
  if (!folhas.length) throw new Error('O modelo não devolveu nenhuma folha.')
  return folhas
}

function requisitarComRetentativa(url, chave, corpo) {
  var espera = ESPERA_INICIAL_MS
  var ultimoErro = ''

  for (var tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': chave },
      payload: JSON.stringify(corpo),
      muteHttpExceptions: true,
    })

    var codigo = resp.getResponseCode()
    if (codigo === 200) return JSON.parse(resp.getContentText())

    ultimoErro = 'HTTP ' + codigo + ': ' + resp.getContentText().slice(0, 300)

    // 429 é cota por minuto; 5xx é instabilidade. Ambos passam esperando.
    // 400/403 é chave, modelo ou permissão — insistir não resolve.
    if (codigo !== 429 && codigo < 500) break
    if (tentativa < TENTATIVAS) { Utilities.sleep(espera); espera *= 2 }
  }

  throw new Error(ultimoErro)
}

function extrairTexto(resposta) {
  var candidatos = resposta && resposta.candidates
  if (!candidatos || !candidatos.length) {
    var motivo = resposta && resposta.promptFeedback && resposta.promptFeedback.blockReason
    throw new Error('O modelo não devolveu conteúdo' + (motivo ? ' (' + motivo + ')' : '') + '.')
  }
  var partes = candidatos[0].content && candidatos[0].content.parts
  if (!partes || !partes.length) throw new Error('Resposta do modelo veio vazia.')

  var texto = ''
  for (var i = 0; i < partes.length; i++) {
    if (partes[i].text) texto += partes[i].text
  }
  if (!texto) throw new Error('Resposta do modelo veio sem texto.')
  return texto
}

// ── Gravação ─────────────────────────────────────────────────────

function prepararAbaRespostas(ss, questoes) {
  var aba = obterOuCriarAba(ss, ABA_RESPOSTAS)
  var cabecalho = COLUNAS_STATUS.concat(questoes.map(function (q) {
    return 'Q' + ('0' + q).slice(-2)
  }))

  var atual = aba.getLastColumn() > 0
    ? aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0]
    : []

  if (atual.join('') !== cabecalho.join('')) {
    if (aba.getLastRow() > 1) {
      throw new Error(
        'A aba Respostas já tem dados de um gabarito diferente ' +
        '(' + Math.max(0, atual.length - COLUNAS_STATUS.length) + ' questões, ' +
        'agora são ' + questoes.length + '). Use "Limpar resultados" antes de continuar.')
    }
    aba.clear()
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho])
    aba.getRange(1, 1, 1, cabecalho.length).setFontWeight('bold')
    aba.setFrozenRows(1)
    aba.setFrozenColumns(3)
  }

  return aba
}

/** Índice do que já está na planilha: evita reprocessar e permite juntar páginas. */
function montarIndice(aba, questoes) {
  var indice = { arquivos: {}, chamadas: {} }
  var ultima = aba.getLastRow()
  if (ultima < 2) return indice

  var largura = COLUNAS_STATUS.length + questoes.length
  var linhas = aba.getRange(2, 1, ultima - 1, largura).getValues()

  for (var i = 0; i < linhas.length; i++) {
    var ids = String(linhas[i][COL_ID - 1] || '').split(',')
    for (var j = 0; j < ids.length; j++) {
      var id = ids[j].trim()
      if (id) indice.arquivos[id] = true
    }
    var chamada = linhas[i][COL_CHAMADA - 1]
    if (chamada !== '' && chamada !== null) indice.chamadas[String(chamada)] = i + 2
  }
  return indice
}

function gravarFolha(aba, indice, folha, arquivo, cfg, gab) {
  var leitura = normalizarLeitura(folha, cfg, gab)
  var linhaExistente = leitura.chamada !== null
    ? indice.chamadas[String(leitura.chamada)]
    : null

  if (linhaExistente) {
    mesclarLinha(aba, linhaExistente, leitura, arquivo, cfg, gab)
    return
  }

  var linha = aba.getLastRow() + 1
  var valores = COLUNAS_STATUS.map(function () { return '' })
  valores[COL_ID - 1]      = arquivo.getId()
  valores[COL_ARQUIVO - 1] = arquivo.getName()
  valores[COL_CHAMADA - 1] = leitura.chamada === null ? '' : leitura.chamada
  valores[COL_TURMA - 1]   = leitura.turma
  valores[COL_ESCRITA - 1] = leitura.escrita
  valores[COL_MARCADA - 1] = leitura.marcada
  valores[COL_CONFLITO - 1] = leitura.conflito ? 'SIM' : ''

  var marcacoes = gab.questoes.map(function (q) { return leitura.respostas[q] || '?' })
  aba.getRange(linha, 1, 1, valores.length + marcacoes.length)
    .setValues([valores.concat(marcacoes)])

  if (leitura.chamada !== null) indice.chamadas[String(leitura.chamada)] = linha
  indice.arquivos[arquivo.getId()] = true

  aplicarCorrecaoNaLinha(aba, linha, cfg, gab, leitura.avisos)
}

/**
 * Segunda página do mesmo aluno: completa o que faltava em vez de criar
 * outra linha. Divergência entre páginas vira aviso, nunca sobrescrita
 * silenciosa.
 */
function mesclarLinha(aba, linha, leitura, arquivo, cfg, gab) {
  var largura = COLUNAS_STATUS.length + gab.questoes.length
  var atuais = aba.getRange(linha, 1, 1, largura).getValues()[0]
  var avisos = leitura.avisos.slice()

  var ids = String(atuais[COL_ID - 1] || '').split(',').map(function (s) { return s.trim() })
  if (ids.indexOf(arquivo.getId()) === -1) {
    atuais[COL_ID - 1] = ids.concat([arquivo.getId()]).filter(String).join(',')
    atuais[COL_ARQUIVO - 1] = String(atuais[COL_ARQUIVO - 1] || '') + ' + ' + arquivo.getName()
  }

  for (var i = 0; i < gab.questoes.length; i++) {
    var q = gab.questoes[i]
    var nova = leitura.respostas[q]
    if (!nova) continue

    var col = PRIMEIRA_COL_QUESTAO + i - 1
    var antiga = String(atuais[col] || '')

    if (antiga === '' || antiga === '?') {
      atuais[col] = nova
    } else if (nova !== '?' && nova !== antiga) {
      avisos.push('questão ' + q + ' lida como ' + antiga + ' e ' + nova + ' em páginas diferentes')
      atuais[col] = '?'
    }
  }

  if (!atuais[COL_TURMA - 1] && leitura.turma) atuais[COL_TURMA - 1] = leitura.turma

  aba.getRange(linha, 1, 1, largura).setValues([atuais])
  aplicarCorrecaoNaLinha(aba, linha, cfg, gab, avisos)
}

/**
 * Converte a leitura crua do modelo no que vai para a planilha.
 * Aqui é onde o conflito de chamada é decidido — e a decisão é sempre
 * não decidir: divergiu, a folha vai para conferência humana.
 */
function normalizarLeitura(folha, cfg, gab) {
  var avisos = []

  var escrita = normalizarDigitos(folha.chamada_escrita)
  var marcada = normalizarDigitos(folha.chamada_marcada)
  var chamada = null
  var conflito = false

  if (escrita !== null && marcada !== null && escrita === marcada) {
    chamada = escrita
  } else {
    conflito = true
    if (escrita === null && marcada === null) avisos.push('número de chamada ilegível nas duas grades')
    else if (escrita === null) avisos.push('número escrito ilegível (marcado: ' + marcada + ')')
    else if (marcada === null) avisos.push('número marcado ilegível (escrito: ' + escrita + ')')
    else avisos.push('chamada escrita ' + escrita + ' diverge da marcada ' + marcada)
  }

  var codigo = String(folha.codigo_folha || '').trim().toUpperCase()
  if (cfg.codigoFolha && codigo && codigo !== cfg.codigoFolha.toUpperCase()) {
    avisos.push('código da folha (' + codigo + ') diferente do configurado (' + cfg.codigoFolha + ')')
  }

  // Pega gabarito incompleto: aba Gabarito com 8 questões para uma
  // folha impressa com 45 é erro de configuração, não de leitura.
  var impressas = parseInt(folha.total_questoes_impressas, 10)
  if (!isNaN(impressas) && impressas > 0 && impressas !== gab.questoes.length) {
    avisos.push('a folha tem ' + impressas + ' questões impressas, mas a aba Gabarito lista ' +
                gab.questoes.length + ' — confira o gabarito')
  }

  var validas = {}
  for (var i = 0; i < cfg.letras.length; i++) validas[cfg.letras[i]] = true

  var respostas = {}
  var lidas = folha.respostas || []
  for (var j = 0; j < lidas.length; j++) {
    var num = parseInt(lidas[j].questao, 10)
    if (isNaN(num) || gab.mapa[num] === undefined) continue

    var marca = String(lidas[j].marcada || '').trim().toUpperCase()
    if (marca !== '-' && marca !== '*' && marca !== '?' && !validas[marca]) marca = '?'
    respostas[num] = marca
  }

  var faltando = gab.questoes.filter(function (q) { return !respostas[q] })
  if (faltando.length) {
    avisos.push('sem leitura para ' + faltando.length + ' questão(ões): ' + faltando.join(', '))
  }

  if (folha.observacao) avisos.push(String(folha.observacao).trim())

  return {
    chamada: chamada,
    conflito: conflito,
    escrita: escrita === null ? '?' : escrita,
    marcada: marcada === null ? '?' : marcada,
    turma: String(folha.turma || '').trim() || cfg.turmaPadrao,
    respostas: respostas,
    avisos: avisos,
  }
}

/** "07", "7", " 7 " viram 7. "?", "1?" e vazio viram null. */
function normalizarDigitos(valor) {
  var txt = String(valor === null || valor === undefined ? '' : valor).trim()
  if (!txt || !/^\d{1,3}$/.test(txt)) return null
  return parseInt(txt, 10)
}

/**
 * Compara com o gabarito, conta acertos e pinta a linha.
 * Roda em cima do que está na planilha, não da leitura em memória:
 * assim o professor pode corrigir uma marcação à mão e mandar
 * recalcular sem reprocessar a imagem.
 */
function aplicarCorrecaoNaLinha(aba, linha, cfg, gab, avisosExtras) {
  var nQ = gab.questoes.length
  var marcacoes = aba.getRange(linha, PRIMEIRA_COL_QUESTAO, 1, nQ).getValues()[0]

  var acertos = 0, comGabarito = 0
  var problemas = 0
  var fundos = []

  for (var i = 0; i < nQ; i++) {
    var q = gab.questoes[i]
    var correta = gab.mapa[q]
    var marca = String(marcacoes[i] || '').trim().toUpperCase()

    if (!correta) { fundos.push(COR_NEUTRO); continue }
    comGabarito++

    if (marca === '-' || marca === '*' || marca === '?' || marca === '') {
      problemas++
      fundos.push(COR_ATENCAO)
    } else if (marca === correta) {
      acertos++
      fundos.push(null)
    } else {
      fundos.push(COR_ERRADO)
    }
  }

  var nota = comGabarito > 0
    ? Math.round((acertos / comGabarito) * cfg.notaMaxima * 10) / 10
    : ''

  var conflito = String(aba.getRange(linha, COL_CONFLITO).getValue() || '') === 'SIM'
  var avisos = (avisosExtras || []).slice()
  if (problemas) avisos.push(problemas + ' questão(ões) em branco, duplas ou ilegíveis')

  var revisar = conflito || problemas > 0 || avisos.length > 0

  aba.getRange(linha, COL_ACERTOS).setValue(acertos)
  aba.getRange(linha, COL_TOTAL).setValue(comGabarito)
  aba.getRange(linha, COL_NOTA).setValue(nota)
  aba.getRange(linha, COL_REVISAR).setValue(revisar ? 'SIM' : '')
  aba.getRange(linha, COL_MOTIVO).setValue(avisos.join('; '))

  aba.getRange(linha, PRIMEIRA_COL_QUESTAO, 1, nQ)
    .setBackgrounds([fundos.map(function (c) { return c || '#ffffff' })])
  aba.getRange(linha, COL_REVISAR).setBackground(revisar ? COR_REVISAR : '#ffffff')
}

// ── Estatísticas e manutenção ────────────────────────────────────

function recalcularTudo() {
  var cfg = obterConfig()
  var gab = obterGabarito()
  var aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_RESPOSTAS)
  if (!aba || aba.getLastRow() < 2) { SpreadsheetApp.getUi().alert('Não há resultados para recalcular.'); return }

  for (var linha = 2; linha <= aba.getLastRow(); linha++) {
    aplicarCorrecaoNaLinha(aba, linha, cfg, gab, [])
  }
  recalcularItens(gab, cfg)
  SpreadsheetApp.getUi().alert('Acertos, notas e estatísticas recalculados.')
}

/** Quantos marcaram cada alternativa em cada questão — leitura pedagógica da prova. */
function recalcularItens(gab, cfg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var respostas = ss.getSheetByName(ABA_RESPOSTAS)
  var itens = obterOuCriarAba(ss, ABA_ITENS)
  itens.clear()

  var cabecalho = ['Questão', 'Correta', 'Respondentes', 'Acertos', '% acerto']
    .concat(cfg.letras)
    .concat(['Em branco', 'Marca dupla', 'Ilegível'])
  itens.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho])
  itens.getRange(1, 1, 1, cabecalho.length).setFontWeight('bold')
  itens.setFrozenRows(1)

  if (!respostas || respostas.getLastRow() < 2) return

  var nQ = gab.questoes.length
  var dados = respostas.getRange(2, PRIMEIRA_COL_QUESTAO, respostas.getLastRow() - 1, nQ).getValues()
  var linhas = []

  for (var i = 0; i < nQ; i++) {
    var q = gab.questoes[i]
    var correta = gab.mapa[q]
    var contagem = {}
    for (var k = 0; k < cfg.letras.length; k++) contagem[cfg.letras[k]] = 0
    var branco = 0, dupla = 0, ilegivel = 0

    for (var j = 0; j < dados.length; j++) {
      var marca = String(dados[j][i] || '').trim().toUpperCase()
      if (marca === '-') branco++
      else if (marca === '*') dupla++
      else if (marca === '?' || marca === '') ilegivel++
      else if (contagem[marca] !== undefined) contagem[marca]++
    }

    var respondentes = dados.length
    var acertos = correta ? (contagem[correta] || 0) : ''
    var pct = correta && respondentes ? Math.round((acertos / respondentes) * 1000) / 10 : ''

    linhas.push(
      [q, correta || '—', respondentes, acertos, pct === '' ? '' : pct + '%']
        .concat(cfg.letras.map(function (l) { return contagem[l] }))
        .concat([branco, dupla, ilegivel]))
  }

  itens.getRange(2, 1, linhas.length, cabecalho.length).setValues(linhas)
}

function limparResultados() {
  var ui = SpreadsheetApp.getUi()
  var r = ui.alert('Limpar resultados',
    'Apaga tudo da aba Respostas e da aba Itens. O gabarito e a configuração ficam.\n\n' +
    'Na próxima correção todas as folhas da pasta serão lidas de novo — ' +
    'o que consome cota da API. Confirma?',
    ui.ButtonSet.YES_NO)
  if (r !== ui.Button.YES) return

  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var respostas = ss.getSheetByName(ABA_RESPOSTAS)
  if (respostas) respostas.clear()
  var itens = ss.getSheetByName(ABA_ITENS)
  if (itens) itens.clear()

  ui.alert('Resultados apagados.')
}

// ── Utilidades ───────────────────────────────────────────────────

function obterOuCriarAba(ss, nome) {
  return ss.getSheetByName(nome) || ss.insertSheet(nome)
}

function contarRevisar(aba) {
  if (aba.getLastRow() < 2) return 0
  var col = aba.getRange(2, COL_REVISAR, aba.getLastRow() - 1, 1).getValues()
  var n = 0
  for (var i = 0; i < col.length; i++) if (String(col[i][0]) === 'SIM') n++
  return n
}

function registrarLog(tipo, arquivo, mensagem) {
  var aba = obterOuCriarAba(SpreadsheetApp.getActiveSpreadsheet(), ABA_LOG)
  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, 4).setValues([['Quando', 'Situação', 'Arquivo', 'Mensagem']])
    aba.getRange(1, 1, 1, 4).setFontWeight('bold')
    aba.setFrozenRows(1)
  }
  aba.appendRow([new Date(), tipo, arquivo, mensagem])
}
