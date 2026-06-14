import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, BorderStyle,
} from 'docx'
import { CABECALHO_PADRAO } from '../components/ProvaHeader'

// ── Utilitários ────────────────────────────────────────────

// Converte px → EMU (English Metric Units)
// 1 polegada = 914400 EMU = 96 px
const PX_TO_EMU = 914400 / 96
function pxEmu(px) { return Math.round(px * PX_TO_EMU) }

// Faz fetch de uma imagem e retorna { data: Uint8Array, type }
// Retorna null em caso de erro (para não corromper o documento)
async function fetchImg(url) {
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const buf  = await resp.arrayBuffer()
    if (!buf || buf.byteLength === 0) return null
    const ct   = resp.headers.get('content-type') || ''
    const type = ct.includes('png') ? 'png' : ct.includes('gif') ? 'gif' : 'jpg'
    return { data: new Uint8Array(buf), type }
  } catch {
    return null
  }
}

// Extrai todos os src de <img> de um HTML string
function extrairSrcs(html = '') {
  const div = document.createElement('div')
  div.innerHTML = html
  return [...div.querySelectorAll('img')].map(el => el.getAttribute('src')).filter(Boolean)
}

// Pré-carrega todas as imagens únicas de um conjunto de HTMLs
async function preCarregarImagens(htmls) {
  const urls = [...new Set(htmls.flatMap(extrairSrcs))]
  const resultados = await Promise.all(urls.map(async url => [url, await fetchImg(url)]))
  return Object.fromEntries(resultados)
}

// ── Conversão HTML → Paragraphs ────────────────────────────

// Percorre nós do DOM e retorna array de "itens" {tipo, ...}
// cache = { url: { data, type } } pré-carregado
function coletarItens(no, cache) {
  const itens = []

  if (no.nodeType === Node.TEXT_NODE) {
    const t = no.textContent
    if (t) itens.push({ tipo: 'texto', texto: t })
    return itens
  }

  if (no.nodeType !== Node.ELEMENT_NODE) return itens

  const tag = no.tagName.toUpperCase()

  if (tag === 'IMG') {
    const src  = no.getAttribute('src')
    const img  = cache[src]
    if (img) {
      const maxW = 480, maxH = 280
      let w = parseInt(no.style?.width)  || parseInt(no.getAttribute('width'))  || maxW
      let h = parseInt(no.style?.height) || parseInt(no.getAttribute('height')) || 160
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH }
      itens.push({ tipo: 'imagem', data: img.data, type: img.type, w, h })
    }
    return itens
  }

  // Filhos
  for (const filho of no.childNodes) {
    itens.push(...coletarItens(filho, cache))
  }

  // Quebra de bloco
  if (['P','DIV','BR','LI','H1','H2','H3','H4','TR'].includes(tag)) {
    itens.push({ tipo: 'br' })
  }

  return itens
}

// Converte itens em Paragraph(s) do docx — agrupa por linha (separados por 'br')
function itensToParagrafos(itens, opts = {}) {
  const {
    fontSize = 22,
    bold = false,
    alignment = AlignmentType.LEFT,
    keepNext = false,
    indentLeft = 0,
    spacingBefore = 20,
    spacingAfter = 60,
  } = opts

  const paragrafos = []
  let linha = []

  const flush = () => {
    if (!linha.length) return
    const children = linha.map(item => {
      if (item.tipo === 'texto') {
        return new TextRun({ text: item.texto, bold, size: fontSize })
      }
      if (item.tipo === 'imagem') {
        try {
          return new ImageRun({
            data: item.data,
            type: item.type,
            transformation: { width: pxEmu(item.w), height: pxEmu(item.h) },
          })
        } catch {
          return new TextRun({ text: '[imagem]', size: fontSize, italics: true })
        }
      }
      return new TextRun({ text: '' })
    })

    paragrafos.push(new Paragraph({
      alignment,
      spacing: { before: spacingBefore, after: spacingAfter },
      keepNext,
      ...(indentLeft ? { indent: { left: indentLeft } } : {}),
      children,
    }))
    linha = []
  }

  for (const item of itens) {
    if (item.tipo === 'br') flush()
    else linha.push(item)
  }
  flush()

  return paragrafos.length ? paragrafos
    : [new Paragraph({ children: [new TextRun('')] })]
}

// Converte HTML string em Paragraphs usando cache de imagens
function htmlToParagrafos(html, cache, opts = {}) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  const itens = coletarItens(div, cache)
  return itensToParagrafos(itens, opts)
}

// Converte o HTML do cabeçalho respeitando alinhamento e tamanho de fonte por elemento
function cabecalhoToParagrafos(html, cache) {
  const div = document.createElement('div')
  div.innerHTML = html || CABECALHO_PADRAO

  const pars = []
  const els  = div.querySelectorAll('p, h1, h2, h3, div:not(:has(p,h1,h2,h3))')

  if (els.length === 0) {
    return htmlToParagrafos(html, cache, { alignment: AlignmentType.CENTER })
  }

  for (const el of els) {
    const style = el.getAttribute('style') || ''
    const bold  = /font-weight:\s*([7-9]\d\d|bold)/i.test(style) || /^H[1-3]$/.test(el.tagName)
    const mSize = style.match(/font-size:\s*([\d.]+)pt/)
    const fontSize = mSize ? Math.round(parseFloat(mSize[1]) * 2) : 22
    const mAlign   = style.match(/text-align:\s*(\w+)/)
    const alignment = mAlign?.[1] === 'right'  ? AlignmentType.RIGHT
                    : mAlign?.[1] === 'left'   ? AlignmentType.LEFT
                    : AlignmentType.CENTER

    const itens = coletarItens(el, cache).filter(i => i.tipo !== 'br')
    if (!itens.length) continue

    pars.push(...itensToParagrafos(itens, {
      fontSize, bold, alignment,
      spacingBefore: 30, spacingAfter: 30,
    }))
  }

  return pars.length ? pars : [new Paragraph({ children: [new TextRun('')] })]
}

// ── Exportação principal ───────────────────────────────────

export async function gerarWordProva(prova) {
  const cfg       = prova.cfg_impressao || {}
  const fontSize  = (cfg.tamanhoFonte || 11) * 2
  const separador = cfg.separadorQuestoes !== false
  const semQuebra = cfg.quebrarPagina     !== false

  // 1. Pré-carrega TODAS as imagens antes de montar o documento
  const todosHtmls = [
    prova.cabecalho || '',
    ...(prova.questoes || []).map(q => q.enunciado || ''),
    ...(prova.questoes || []).flatMap(q => (q.alternativas || []).map(a => a.texto || '')),
  ]
  const imgCache = await preCarregarImagens(todosHtmls)

  // 2. Cabeçalho
  const parsCabecalho = cabecalhoToParagrafos(prova.cabecalho, imgCache)

  const linhaSep = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    spacing: { before: 60, after: 120 },
    children: [],
  })

  // 3. Título
  const parTitulo = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: prova.titulo, bold: true, size: fontSize + 4 })],
  })

  // 4. Instruções
  const parsInstr = prova.instrucoes ? [new Paragraph({
    spacing: { before: 60, after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 8 } },
    indent: { left: 240 },
    children: [
      new TextRun({ text: 'Instruções: ', bold: true, size: fontSize }),
      new TextRun({ text: prova.instrucoes, size: fontSize }),
    ],
  })] : []

  // 5. Questões
  const parsQuestoes = []

  for (const [idx, q] of (prova.questoes || []).entries()) {

    // Separador
    if (separador && idx > 0) {
      parsQuestoes.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 6 } },
        spacing: { before: 80, after: 0 },
        children: [],
      }))
    }

    // Número + dificuldade
    const dif = q.nivel_dificuldade
      ? ' ' + '●'.repeat(q.nivel_dificuldade) + '○'.repeat(5 - q.nivel_dificuldade)
      : ''

    parsQuestoes.push(new Paragraph({
      spacing: { before: separador && idx > 0 ? 60 : 140, after: 60 },
      keepNext: semQuebra,
      children: [new TextRun({ text: `Questão ${idx + 1}${dif}`, bold: true, size: fontSize + 2 })],
    }))

    // Enunciado
    parsQuestoes.push(...htmlToParagrafos(q.enunciado, imgCache, {
      fontSize, keepNext: semQuebra, spacingBefore: 20, spacingAfter: 80,
    }))

    // Alternativas
    if (q.tipo === 'multipla_escolha' && q.alternativas?.length) {
      for (const alt of q.alternativas) {
        const itensAlt = coletarItens(
          Object.assign(document.createElement('div'), { innerHTML: alt.texto || '' }),
          imgCache
        ).filter(i => i.tipo !== 'br')

        parsQuestoes.push(...itensToParagrafos(
          [{ tipo: 'texto', texto: `${alt.letra})  ` }, ...itensAlt],
          { fontSize, keepNext: semQuebra, indentLeft: 360, spacingBefore: 20, spacingAfter: 20 }
        ))
      }
    }

    // Linhas dissertativas
    if (q.tipo === 'dissertativa') {
      for (let i = 0; i < 4; i++) {
        parsQuestoes.push(new Paragraph({
          spacing: { before: 40, after: 40 },
          keepNext: semQuebra && i < 3,
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '888888', space: 2 } },
          children: [new TextRun({ text: ' ', size: fontSize })],
        }))
      }
    }
  }

  // 6. Rodapé
  const parRodape = new Paragraph({
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 4 } },
    children: [
      new TextRun({ text: `Total: ${prova.questoes?.length || 0} questões`, size: 18 }),
      new TextRun({ text: '          Assinatura: ___________________________', size: 18 }),
    ],
  })

  // 7. Montar e exportar
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: fontSize } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
        },
      },
      children: [
        ...parsCabecalho,
        linhaSep,
        parTitulo,
        ...parsInstr,
        ...parsQuestoes,
        parRodape,
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${prova.titulo.replace(/[^\w\s]/g, '').trim()}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
