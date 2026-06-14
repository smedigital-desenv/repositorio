import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, PageOrientation,
  ShadingType, HeadingLevel, PageBreak, HorizontalPositionRelativeFrom,
} from 'docx'
import { CABECALHO_PADRAO } from '../components/ProvaHeader'

// Converte HTML simples em TextRuns do docx (bold, italic, texto puro)
function htmlParaRuns(html = '') {
  if (!html) return [new TextRun('')]
  const div = document.createElement('div')
  div.innerHTML = html
  const texto = div.innerText || div.textContent || ''
  if (!texto.trim()) return [new TextRun('')]

  // Usa innerText que já interpreta <br>, parágrafos etc
  return [new TextRun({ text: texto })]
}

// Extrai texto puro do HTML
function htmlParaTexto(html = '') {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.innerText || div.textContent || '').trim()
}

// Parse básico do HTML do cabeçalho → parágrafos do docx
function cabecalhoParaParagrafos(html) {
  const div = document.createElement('div')
  div.innerHTML = html || CABECALHO_PADRAO

  const paragrafos = []

  // Extrai elementos de texto (p, div, span)
  const elementos = div.querySelectorAll('p, div > span, h1, h2, h3')
  const visitados = new Set()

  const processarElemento = (el) => {
    if (visitados.has(el)) return
    visitados.add(el)

    const texto = (el.innerText || el.textContent || '').trim()
    if (!texto) return

    const style = el.getAttribute('style') || ''
    const isBold = style.includes('font-weight:700') ||
                   style.includes('font-weight:800') ||
                   style.includes('bold') ||
                   el.tagName === 'H1' || el.tagName === 'H2'

    // Tamanho da fonte
    const matchSize = style.match(/font-size:\s*([\d.]+)pt/)
    const fontSize = matchSize ? Math.round(parseFloat(matchSize[1]) * 2) : 22 // half-points

    // Alinhamento
    const matchAlign = style.match(/text-align:\s*(\w+)/)
    const align = matchAlign ? matchAlign[1] : 'center'
    const alignment = align === 'right' ? AlignmentType.RIGHT :
                      align === 'left'  ? AlignmentType.LEFT :
                                          AlignmentType.CENTER

    paragrafos.push(new Paragraph({
      alignment,
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text: texto, bold: isBold, size: fontSize })],
    }))
  }

  if (elementos.length > 0) {
    elementos.forEach(processarElemento)
  } else {
    // Fallback: divide por \n
    const linhas = (div.innerText || div.textContent || '').split('\n').filter(l => l.trim())
    linhas.forEach(linha => {
      paragrafos.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: linha.trim() })],
      }))
    })
  }

  return paragrafos
}

export async function gerarWordProva(prova) {
  const cfg = prova.cfg_impressao || {}
  const fontSize = (cfg.tamanhoFonte || 11) * 2  // docx usa half-points
  const separador = cfg.separadorQuestoes !== false
  const semQuebra  = cfg.quebrarPagina !== false

  // ── Cabeçalho ─────────────────────────────────────────────
  const parsCabecalho = cabecalhoParaParagrafos(prova.cabecalho)

  // Linha separadora após cabeçalho
  const linhaSep = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    spacing: { before: 60, after: 120 },
    children: [],
  })

  // ── Título da prova ────────────────────────────────────────
  const parTitulo = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 80 },
    children: [new TextRun({
      text: prova.titulo,
      bold: true,
      size: (cfg.tamanhoFonte || 11) * 2 + 4,
    })],
  })

  // ── Instruções ─────────────────────────────────────────────
  const parsInstrucoes = prova.instrucoes ? [
    new Paragraph({
      spacing: { before: 60, after: 120 },
      border: { left: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 8 } },
      indent: { left: 240 },
      children: [
        new TextRun({ text: 'Instruções: ', bold: true, size: fontSize }),
        new TextRun({ text: prova.instrucoes, size: fontSize }),
      ],
    })
  ] : []

  // ── Questões ───────────────────────────────────────────────
  const parsQuestoes = []

  ;(prova.questoes || []).forEach((q, idx) => {
    const children = []

    // Separador entre questões
    if (separador && idx > 0) {
      parsQuestoes.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 6 } },
        spacing: { before: 80, after: 0 },
        children: [],
      }))
    }

    // Número da questão + dificuldade
    const dif = q.nivel_dificuldade
      ? ' ' + '●'.repeat(q.nivel_dificuldade) + '○'.repeat(5 - q.nivel_dificuldade)
      : ''

    parsQuestoes.push(new Paragraph({
      spacing: { before: separador && idx > 0 ? 60 : 140, after: 60 },
      keepNext: semQuebra,
      children: [
        new TextRun({ text: `Questão ${idx + 1}${dif}`, bold: true, size: fontSize + 2 }),
      ],
    }))

    // Enunciado (texto puro + preserva imagens como [imagem])
    const textoEnunciado = htmlParaTexto(q.enunciado)
    if (textoEnunciado) {
      parsQuestoes.push(new Paragraph({
        spacing: { before: 20, after: 80 },
        keepNext: semQuebra,
        children: [new TextRun({ text: textoEnunciado, size: fontSize })],
      }))
    }

    // Alternativas
    if (q.tipo === 'multipla_escolha' && q.alternativas?.length) {
      q.alternativas.forEach(alt => {
        const textoAlt = htmlParaTexto(alt.texto)
        parsQuestoes.push(new Paragraph({
          spacing: { before: 20, after: 20 },
          keepNext: semQuebra,
          indent: { left: 360 },
          children: [
            new TextRun({ text: `${alt.letra}) `, bold: true, size: fontSize }),
            new TextRun({ text: textoAlt, size: fontSize }),
          ],
        }))
      })
    }

    // Espaço para resposta dissertativa
    if (q.tipo === 'dissertativa') {
      for (let i = 0; i < 4; i++) {
        parsQuestoes.push(new Paragraph({
          spacing: { before: 40, after: 40 },
          keepNext: semQuebra && i < 3,
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: '888888', space: 2 } },
          children: [new TextRun({ text: ' '.repeat(80), size: fontSize })],
        }))
      }
    }
  })

  // ── Rodapé ─────────────────────────────────────────────────
  const parRodape = new Paragraph({
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 4 } },
    tabStops: [{ type: 'right', position: 8640 }],
    children: [
      new TextRun({ text: `Total: ${prova.questoes?.length || 0} questões`, size: 18 }),
      new TextRun({ text: '\tAssinatura: ___________________________', size: 18 }),
    ],
  })

  // ── Montar documento ───────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: fontSize },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 }, // ~1.2cm top/bottom, ~1.9cm sides
        },
      },
      children: [
        ...parsCabecalho,
        linhaSep,
        parTitulo,
        ...parsInstrucoes,
        ...parsQuestoes,
        parRodape,
      ],
    }],
  })

  // Gera blob e faz download
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${prova.titulo.replace(/[^a-zA-Z0-9\s]/g, '').trim()}.docx`
  link.click()
  URL.revokeObjectURL(url)
}
