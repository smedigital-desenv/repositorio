import { useState, useEffect, useRef } from 'react'
import { uploadImagem } from '../services/upload'
import { Image, AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './ProvaHeader.module.css'

const CORES_TEXTO = ['#002b5e','#1e293b','#0f172a','#1d4ed8','#047857','#b91c1c','#92400e','#6d28d9','#0891b2']
const CORES_FUNDO = ['#ffffff','#f0f9ff','#f0fdf4','#fefce8','#fff1f2','#f5f3ff','#e0f2fe','#002b5e','#1e293b']

const DEFAULTS = {
  nomeProfessor: '',
  nomeEscola: '',
  logoUrl: '',
  corFundo: '#ffffff',
  corTexto: '#002b5e',
  alinhamento: 'center',
  mostrarData: true,
  mostrarLinha: true,
  negrito: false,
}

export default function ProvaHeader({ value = {}, onChange }) {
  const fileRef = useRef(null)
  const [aberto, setAberto] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cfg, setCfg] = useState({ ...DEFAULTS, ...value })

  // Sincroniza quando value chega de fora (edição de prova existente)
  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      setCfg({ ...DEFAULTS, ...value })
    }
  }, [JSON.stringify(value)])

  function set(key, val) {
    const novo = { ...cfg, [key]: val }
    setCfg(novo)
    onChange(novo)
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const { url } = await uploadImagem(file, 'cabecalhos')
      set('logoUrl', url)
      toast.success('Logo inserida!')
    } catch (err) {
      toast.error('Erro ao enviar logo: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const align = cfg.alinhamento || 'center'

  return (
    <div className={styles.wrap}>

      {/* ── Preview ── */}
      <div className={styles.preview} style={{ background: cfg.corFundo }}>

        {/* Linha 1: logo sozinho, com alinhamento */}
        {cfg.logoUrl && (
          <div className={styles.previewLogoRow} style={{ textAlign: align }}>
            <img src={cfg.logoUrl} alt="Logo" className={styles.previewLogo} />
          </div>
        )}

        {/* Linha 2: nome da escola */}
        {cfg.nomeEscola && (
          <div className={styles.previewEscola} style={{
            textAlign: align,
            fontWeight: cfg.negrito ? 800 : 600,
            color: cfg.corTexto,
          }}>
            {cfg.nomeEscola}
          </div>
        )}

        {/* Linha 3: professor */}
        {cfg.nomeProfessor && (
          <div className={styles.previewProf} style={{ textAlign: align, color: cfg.corTexto }}>
            Professor(a): {cfg.nomeProfessor}
          </div>
        )}

        {/* Linha 4: data e nota */}
        {cfg.mostrarData && (
          <div className={styles.previewData} style={{ textAlign: align, color: cfg.corTexto }}>
            Data: ___/___/______&nbsp;&nbsp;&nbsp;Nota: _______
          </div>
        )}

        {cfg.mostrarLinha && (
          <div className={styles.previewLinha} style={{ borderColor: cfg.corTexto }} />
        )}

        {/* Placeholder vazio */}
        {!cfg.logoUrl && !cfg.nomeEscola && !cfg.nomeProfessor && (
          <div className={styles.previewVazio}>
            Clique em "Editar cabeçalho" para personalizar
          </div>
        )}
      </div>

      {/* ── Toggle ── */}
      <button type="button" className={styles.toggleBtn} onClick={() => setAberto(v => !v)}>
        {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {aberto ? 'Fechar editor de cabeçalho' : 'Editar cabeçalho da prova'}
      </button>

      {/* ── Painel ── */}
      {aberto && (
        <div className={styles.painel}>
          <div className={styles.painelGrid}>

            {/* Coluna 1 — Informações */}
            <div className={styles.painelCol}>
              <p className={styles.painelTitulo}>Informações</p>

              <label className={styles.fieldLabel}>Nome da escola / secretaria</label>
              <input className={styles.fieldInput}
                placeholder="E.M. Prof. João Silva"
                value={cfg.nomeEscola}
                onChange={e => set('nomeEscola', e.target.value)}
              />

              <label className={styles.fieldLabel}>Nome do professor(a)</label>
              <input className={styles.fieldInput}
                placeholder="Maria Oliveira"
                value={cfg.nomeProfessor}
                onChange={e => set('nomeProfessor', e.target.value)}
              />

              <div className={styles.checkRow}>
                <input type="checkbox" id="hdr-data" checked={!!cfg.mostrarData}
                  onChange={e => set('mostrarData', e.target.checked)} />
                <label htmlFor="hdr-data">Mostrar linha de data / nota</label>
              </div>
              <div className={styles.checkRow}>
                <input type="checkbox" id="hdr-linha" checked={!!cfg.mostrarLinha}
                  onChange={e => set('mostrarLinha', e.target.checked)} />
                <label htmlFor="hdr-linha">Mostrar linha separadora</label>
              </div>
              <div className={styles.checkRow}>
                <input type="checkbox" id="hdr-negrito" checked={!!cfg.negrito}
                  onChange={e => set('negrito', e.target.checked)} />
                <label htmlFor="hdr-negrito">Nome da escola em negrito</label>
              </div>
            </div>

            {/* Coluna 2 — Visual */}
            <div className={styles.painelCol}>
              <p className={styles.painelTitulo}>Visual</p>

              <label className={styles.fieldLabel}>Logo / Brasão</label>
              <div className={styles.logoRow}>
                {cfg.logoUrl
                  ? <img src={cfg.logoUrl} alt="logo" className={styles.logoThumb} />
                  : <div className={styles.logoEmpty}><Image size={18} /></div>
                }
                <div className={styles.logoBtns}>
                  <button type="button" className={styles.btnSm}
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}>
                    {uploading ? 'Enviando...' : 'Escolher imagem'}
                  </button>
                  {cfg.logoUrl && (
                    <button type="button" className={styles.btnSmDanger}
                      onClick={() => set('logoUrl', '')}>
                      <Trash2 size={11} /> Remover
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={handleLogo} />
              </div>

              <label className={styles.fieldLabel}>Alinhamento</label>
              <div className={styles.alignRow}>
                {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([v, Icon]) => (
                  <button key={v} type="button"
                    className={`${styles.alignBtn} ${cfg.alinhamento === v ? styles.alignBtnOn : ''}`}
                    onClick={() => set('alinhamento', v)}>
                    <Icon size={14} />
                  </button>
                ))}
              </div>

              <label className={styles.fieldLabel}>Cor do texto</label>
              <div className={styles.colorRow}>
                {CORES_TEXTO.map(c => (
                  <button key={c} type="button"
                    className={`${styles.colorDot} ${cfg.corTexto === c ? styles.colorDotOn : ''}`}
                    style={{ background: c }}
                    onClick={() => set('corTexto', c)} />
                ))}
                <input type="color" value={cfg.corTexto}
                  onChange={e => set('corTexto', e.target.value)}
                  className={styles.colorPicker} title="Cor personalizada" />
              </div>

              <label className={styles.fieldLabel}>Cor de fundo</label>
              <div className={styles.colorRow}>
                {CORES_FUNDO.map(c => (
                  <button key={c} type="button"
                    className={`${styles.colorDot} ${cfg.corFundo === c ? styles.colorDotOn : ''}`}
                    style={{ background: c, border: c === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                    onClick={() => set('corFundo', c)} />
                ))}
                <input type="color" value={cfg.corFundo}
                  onChange={e => set('corFundo', e.target.value)}
                  className={styles.colorPicker} title="Cor personalizada" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
