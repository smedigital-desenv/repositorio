import { useEffect, useRef, useState } from 'react'
import { uploadImagem } from '../services/upload'
import { X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './RichEditor.module.css'

const SIMBOLOS_MATH = [
  { label: '+', value: '+' },
  { label: '−', value: '−' },
  { label: '×', value: '×' },
  { label: '÷', value: '÷' },
  { label: '=', value: '=' },
  { label: '≠', value: '≠' },
  { label: '<', value: '<' },
  { label: '>', value: '>' },
  { label: '≤', value: '≤' },
  { label: '≥', value: '≥' },
  { label: '√', value: '√' },
  { label: 'π', value: 'π' },
  { label: '∞', value: '∞' },
  { label: '°', value: '°' },
  { label: '%', value: '%' },
  { label: 'x²', value: 'x²' },
  { label: 'x³', value: 'x³' },
  { label: 'ⁿ', value: 'ⁿ' },
  { label: '½', value: '½' },
  { label: '⅓', value: '⅓' },
  { label: '¼', value: '¼' },
  { label: '∑', value: '∑' },
  { label: '∫', value: '∫' },
  { label: '∆', value: '∆' },
]

export default function RichEditor({ value = '', onChange, label = '', placeholder = '' }) {
  const editorRef = useRef(null)
  const [mostraSimbolos, setMostraSimbolos] = useState(false)
  const [uploadando, setUploadando] = useState(false)

  useEffect(() => {
    // Carregar TinyMCE dinamicamente
    if (!window.tinymce) {
      const script = document.createElement('script')
      script.src = 'https://cdn.tiny.cloud/1/no-api-key/tinymce/6/tinymce.min.js'
      script.async = true
      script.onload = initTinyMCE
      document.body.appendChild(script)
    } else {
      initTinyMCE()
    }
  }, [])

  function initTinyMCE() {
    window.tinymce.init({
      selector: `#editor-${Math.random().toString(36)}`,
      height: 400,
      menubar: false,
      plugins: ['lists', 'link', 'image', 'table'],
      toolbar: 'undo redo | formatselect | bold italic underline strikethrough | alignleft aligncenter alignright | bullist numlist outdent indent | link image table',
      image_upload_handler: handleImageUpload,
      content_css: false,
      skin: 'oxide',
      body_class: 'tinymce-body',
      setup: (editor) => {
        editor.on('change', () => onChange(editor.getContent()))
      },
      init_instance_callback: (editor) => {
        editorRef.current = editor
        if (value) editor.setContent(value)
      },
    })
  }

  async function handleImageUpload(blobInfo, progress) {
    try {
      setUploadando(true)
      const file = blobInfo.blob()
      const { url } = await uploadImagem(file)
      progress(100)
      return { location: url }
    } catch (err) {
      toast.error('Erro ao fazer upload da imagem')
      throw err
    } finally {
      setUploadando(false)
    }
  }

  function inserirSimbolo(simbolo) {
    if (editorRef.current) {
      editorRef.current.execCommand('mceInsertContent', false, simbolo)
    }
  }

  const editorId = `editor-${Math.random().toString(36)}`

  return (
    <div className={styles.container}>
      {label && <label className={styles.label}>{label}</label>}
      
      <textarea
        id={editorId}
        defaultValue={value}
        placeholder={placeholder}
      />

      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.btnSymbols} ${mostraSimbolos ? styles.ativo : ''}`}
          onClick={() => setMostraSimbolos(!mostraSimbolos)}
          title="Inserir símbolos matemáticos"
        >
          <Plus size={14} /> Símbolos
        </button>
        {uploadando && <span className={styles.uploading}>Enviando imagem...</span>}
      </div>

      {mostraSimbolos && (
        <div className={styles.symbolsPanel}>
          <div className={styles.symbolsGrid}>
            {SIMBOLOS_MATH.map(s => (
              <button
                key={s.value}
                type="button"
                className={styles.symbolBtn}
                onClick={() => inserirSimbolo(s.value)}
                title={s.label}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.btnClose}
            onClick={() => setMostraSimbolos(false)}
          >
            <X size={14} /> Fechar
          </button>
        </div>
      )}

      <p className={styles.hint}>
        💡 Dica: Arraste uma imagem para cá ou clique no botão "image" acima. Símbolos matemáticos à esquerda!
      </p>
    </div>
  )
}
