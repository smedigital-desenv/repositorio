import { useState, useEffect, useRef } from 'react'
import { uploadImagem } from '../services/upload'
import { ChevronDown, ChevronUp, Trash2, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './ProvaHeader.module.css'

export const CABECALHO_PADRAO = `<div style="text-align:center;padding:12px 0 6px">
  <p style="font-size:11pt;font-weight:700;margin:0">PREFEITURA MUNICIPAL DE RIBEIRÃO PRETO</p>
  <p style="font-size:10pt;margin:4px 0 0">SECRETARIA MUNICIPAL DE EDUCAÇÃO</p>
  <p style="font-size:9pt;margin:6px 0 0">Professor(a): ________________________________&nbsp;&nbsp;&nbsp;Data: ___/___/_____</p>
  <p style="font-size:9pt;margin:4px 0 0">Aluno(a): ____________________________________&nbsp;&nbsp;&nbsp;Nota: __________</p>
</div>`

export default function ProvaHeader({ value, onChange }) {
  const fileRef = useRef(null)
  const [aberto, setAberto] = useState(false)
  const [uploading, setUploading] = useState(false)
  const editorRef = useRef(null)
  const isFocused = useRef(false)

  const html = value ?? CABECALHO_PADRAO

  // Sincroniza editor com value externo
  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      if (editorRef.current.innerHTML !== html) {
        editorRef.current.innerHTML = html
      }
    }
  }, [html])

  function handleInput() {
    onChange(editorRef.current.innerHTML)
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const { url } = await uploadImagem(file, 'cabecalhos')
      // Insere a imagem no cursor
      editorRef.current?.focus()
      document.execCommand('insertHTML', false,
        `<img src="${url}" style="max-height:64px;width:auto;vertical-align:middle;margin:4px 8px 4px 0" />`
      )
      onChange(editorRef.current.innerHTML)
      toast.success('Logo inserida!')
    } catch (err) {
      toast.error('Erro ao enviar logo: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function fmt(cmd, val) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(editorRef.current.innerHTML)
  }

  function resetar() {
    if (!confirm('Restaurar o cabeçalho padrão?')) return
    onChange(CABECALHO_PADRAO)
    if (editorRef.current) editorRef.current.innerHTML = CABECALHO_PADRAO
  }

  return (
    <div className={styles.wrap}>

      {/* Preview sempre visível */}
      <div className={styles.preview}
        dangerouslySetInnerHTML={{ __html: html }} />

      {/* Toggle */}
      <div className={styles.toggleRow}>
        <button type="button" className={styles.toggleBtn}
          onClick={() => setAberto(v => !v)}>
          {aberto ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          {aberto ? 'Fechar editor' : 'Editar cabeçalho'}
        </button>
        <button type="button" className={styles.resetBtn} onClick={resetar}>
          Restaurar padrão
        </button>
      </div>

      {/* Editor */}
      {aberto && (
        <div className={styles.editorWrap}>
          {/* Barra de formatação */}
          <div className={styles.toolbar}>
            <button type="button" className={styles.toolBtn}
              onMouseDown={e => { e.preventDefault(); fmt('bold') }} title="Negrito">
              <b>B</b>
            </button>
            <button type="button" className={styles.toolBtn}
              onMouseDown={e => { e.preventDefault(); fmt('italic') }} title="Itálico">
              <i>I</i>
            </button>
            <button type="button" className={styles.toolBtn}
              onMouseDown={e => { e.preventDefault(); fmt('underline') }} title="Sublinhado">
              <u>U</u>
            </button>
            <div className={styles.sep} />
            <button type="button" className={styles.toolBtn}
              onMouseDown={e => { e.preventDefault(); fmt('justifyLeft') }} title="Esquerda">⬅</button>
            <button type="button" className={styles.toolBtn}
              onMouseDown={e => { e.preventDefault(); fmt('justifyCenter') }} title="Centro">⬛</button>
            <button type="button" className={styles.toolBtn}
              onMouseDown={e => { e.preventDefault(); fmt('justifyRight') }} title="Direita">➡</button>
            <div className={styles.sep} />

            <label className={styles.toolLabel}>Tamanho</label>
            <select className={styles.toolSelect}
              onChange={e => fmt('fontSize', e.target.value)}>
              {[1,2,3,4,5,6,7].map(n => (
                <option key={n} value={n}>{['8','10','12','14','18','24','36'][n-1]}pt</option>
              ))}
            </select>

            <label className={styles.toolLabel}>Cor</label>
            <input type="color" className={styles.toolColor} defaultValue="#000000"
              onChange={e => fmt('foreColor', e.target.value)} title="Cor do texto" />

            <div className={styles.sep} />
            <button type="button" className={`${styles.toolBtn} ${styles.toolBtnImg}`}
              onClick={() => fileRef.current?.click()}
              title="Inserir logo/imagem" disabled={uploading}>
              <Image size={13} /> {uploading ? 'Enviando...' : 'Logo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*"
              style={{display:'none'}} onChange={handleLogo} />
          </div>

          {/* Área editável */}
          <div
            ref={editorRef}
            className={styles.editor}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onFocus={() => { isFocused.current = true }}
            onBlur={() => { isFocused.current = false }}
          />
        </div>
      )}
    </div>
  )
}
