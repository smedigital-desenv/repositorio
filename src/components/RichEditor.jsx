import { useRef, useEffect, useState, useCallback } from 'react'
import { uploadImagem } from '../services/upload'
import { Image, Bold, Italic, List, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './RichEditor.module.css'

const CATEGORIAS = [
  {
    nome: 'Operações',
    itens: [
      { label: '×', insert: '×' },
      { label: '÷', insert: '÷' },
      { label: '±', insert: '±' },
      { label: '√', insert: '√' },
      { label: '∛', insert: '∛' },
      { label: '∜', insert: '∜' },
    ],
  },
  {
    nome: 'Comparação',
    itens: [
      { label: '≠', insert: '≠' },
      { label: '≤', insert: '≤' },
      { label: '≥', insert: '≥' },
      { label: '≈', insert: '≈' },
      { label: '∝', insert: '∝' },
    ],
  },
  {
    nome: 'Frações',
    itens: [
      { label: '½', insert: '½' },
      { label: '⅓', insert: '⅓' },
      { label: '⅔', insert: '⅔' },
      { label: '¼', insert: '¼' },
      { label: '¾', insert: '¾' },
      { label: '⅕', insert: '⅕' },
    ],
  },
  {
    nome: 'Potência / Índice',
    itens: [
      { label: 'x²', insert: 'x²' },
      { label: 'x³', insert: 'x³' },
      { label: '²', insert: '²' },
      { label: '³', insert: '³' },
      { label: 'xₙ', insert: 'xₙ' },
      { label: '₁', insert: '₁' },
      { label: '₂', insert: '₂' },
    ],
  },
  {
    nome: 'Geometria',
    itens: [
      { label: '°', insert: '°' },
      { label: 'π', insert: 'π' },
      { label: '∠', insert: '∠' },
      { label: '△', insert: '△' },
      { label: '⊥', insert: '⊥' },
      { label: '∥', insert: '∥' },
      { label: '∞', insert: '∞' },
    ],
  },
  {
    nome: 'Conjuntos',
    itens: [
      { label: '∈', insert: '∈' },
      { label: '∉', insert: '∉' },
      { label: '⊂', insert: '⊂' },
      { label: '⊃', insert: '⊃' },
      { label: '∪', insert: '∪' },
      { label: '∩', insert: '∩' },
      { label: '∅', insert: '∅' },
    ],
  },
  {
    nome: 'Cálculo',
    itens: [
      { label: '∑', insert: '∑' },
      { label: '∫', insert: '∫' },
      { label: '∂', insert: '∂' },
      { label: '∆', insert: '∆' },
      { label: '∇', insert: '∇' },
      { label: 'lim', insert: 'lim' },
    ],
  },
  {
    nome: 'Letras Gregas',
    itens: [
      { label: 'α', insert: 'α' },
      { label: 'β', insert: 'β' },
      { label: 'γ', insert: 'γ' },
      { label: 'δ', insert: 'δ' },
      { label: 'λ', insert: 'λ' },
      { label: 'μ', insert: 'μ' },
      { label: 'σ', insert: 'σ' },
      { label: 'θ', insert: 'θ' },
      { label: 'φ', insert: 'φ' },
      { label: 'ω', insert: 'ω' },
    ],
  },
]

export default function RichEditor({ value = '', onChange, label = '', placeholder = '' }) {
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const [mostraSimbolos, setMostraSimbolos] = useState(false)
  const [uploading, setUploading] = useState(false)
  const lastSelection = useRef(null)

  // Inicializar o conteúdo
  useEffect(() => {
    if (editorRef.current && value && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [])

  // Salvar seleção antes de clicar em símbolos
  function salvarSelecao() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      lastSelection.current = sel.getRangeAt(0).cloneRange()
    }
  }

  // Inserir texto/HTML na posição do cursor
  function inserirNoEditor(texto) {
    editorRef.current?.focus()
    const sel = window.getSelection()

    // Restaurar seleção salva
    if (lastSelection.current) {
      sel.removeAllRanges()
      sel.addRange(lastSelection.current)
    }

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      const node = document.createTextNode(texto)
      range.insertNode(node)
      range.setStartAfter(node)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editorRef.current.innerHTML += texto
    }
    onChange(editorRef.current.innerHTML)
  }

  // Inserir imagem via URL
  function inserirImagem(url) {
    editorRef.current?.focus()
    const img = `<img src="${url}" style="max-width:100%;height:auto;margin:8px 0;border-radius:6px;" />`

    const sel = window.getSelection()
    if (lastSelection.current) {
      sel.removeAllRanges()
      sel.addRange(lastSelection.current)
    }

    document.execCommand('insertHTML', false, img)
    onChange(editorRef.current.innerHTML)
  }

  // Upload de imagem
  async function handleUploadImagem(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const { url } = await uploadImagem(file)
      inserirImagem(url)
      toast.success('Imagem inserida!')
    } catch (err) {
      toast.error('Erro ao enviar imagem: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Formatar texto selecionado
  function formatar(comando) {
    editorRef.current?.focus()
    document.execCommand(comando, false)
    onChange(editorRef.current.innerHTML)
  }

  function handleInput() {
    onChange(editorRef.current.innerHTML)
  }

  return (
    <div className={styles.container}>
      {label && <label className={styles.label}>{label}</label>}

      {/* Barra de formatação */}
      <div className={styles.formatBar}>
        <button type="button" className={styles.fmtBtn} onClick={() => formatar('bold')} title="Negrito">
          <Bold size={14} />
        </button>
        <button type="button" className={styles.fmtBtn} onClick={() => formatar('italic')} title="Itálico">
          <Italic size={14} />
        </button>
        <button type="button" className={styles.fmtBtn} onClick={() => formatar('insertUnorderedList')} title="Lista">
          <List size={14} />
        </button>
        <div className={styles.sep} />
        <button
          type="button"
          className={`${styles.fmtBtn} ${styles.fmtBtnSymbols} ${mostraSimbolos ? styles.ativo : ''}`}
          onMouseDown={salvarSelecao}
          onClick={() => setMostraSimbolos(v => !v)}
        >
          Σ Símbolos {mostraSimbolos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <div className={styles.sep} />
        <button
          type="button"
          className={`${styles.fmtBtn} ${uploading ? styles.fmtBtnDisabled : ''}`}
          onMouseDown={salvarSelecao}
          onClick={() => fileInputRef.current?.click()}
          title="Inserir imagem"
          disabled={uploading}
        >
          <Image size={14} /> {uploading ? 'Enviando...' : 'Imagem'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUploadImagem}
        />
      </div>

      {/* Painel de símbolos por categoria */}
      {mostraSimbolos && (
        <div className={styles.symbolsPanel}>
          {CATEGORIAS.map(cat => (
            <div key={cat.nome} className={styles.symbolCat}>
              <span className={styles.catNome}>{cat.nome}</span>
              <div className={styles.catItens}>
                {cat.itens.map(s => (
                  <button
                    key={s.insert}
                    type="button"
                    className={styles.symbolBtn}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      salvarSelecao()
                    }}
                    onClick={() => inserirNoEditor(s.insert)}
                    title={s.label}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={salvarSelecao}
        onKeyUp={salvarSelecao}
        data-placeholder={placeholder}
      />
    </div>
  )
}
