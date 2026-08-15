import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Printer, ClipboardCopy, Download, ScanLine } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  LETRAS,
  alternativasDaProva,
  questoesObjetivas,
  questoesDissertativas,
  codigoFolha,
  montarFolhaRespostaHtml,
  imprimirFolhaResposta,
  dadosCorrecao,
  promptGemini,
} from '../services/folhaResposta'
import styles from './FolhaRespostaModal.module.css'

// A4 em pixels de CSS (96 dpi) — a folha é gerada em mm, e a
// pré-visualização precisa encolher isso até caber no painel.
const FOLHA_L = 794
const FOLHA_A = 1123

export default function FolhaRespostaModal({ prova, onClose }) {
  const objetivas = useMemo(() => questoesObjetivas(prova), [prova])
  const dissertativas = useMemo(() => questoesDissertativas(prova), [prova])

  const [nLetras, setNLetras] = useState(() => alternativasDaProva(prova))
  const [campoNome, setCampoNome] = useState(true)
  const [avulsa, setAvulsa] = useState(objetivas.length === 0)
  const [qtdAvulsa, setQtdAvulsa] = useState(20)

  const opcoes = useMemo(() => ({
    nLetras,
    campoNome,
    codigo: codigoFolha(prova),
    numeros: avulsa
      ? Array.from({ length: Math.min(Math.max(qtdAvulsa, 1), 60) }, (_, i) => i + 1)
      : objetivas.map(q => q.numero),
    dissertativas: avulsa ? [] : dissertativas.map(q => q.numero),
  }), [nLetras, campoNome, avulsa, qtdAvulsa, objetivas, dissertativas, prova])

  const html = useMemo(() => montarFolhaRespostaHtml(prova, opcoes), [prova, opcoes])
  const nPaginas = useMemo(() => Math.max(1, html.split('class="folha"').length - 1), [html])

  const areaRef = useRef(null)
  const [escala, setEscala] = useState(0.6)

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const medir = () => setEscala(Math.min(1, (area.clientWidth - 28) / FOLHA_L))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(area)
    return () => ro.disconnect()
  }, [])

  async function copiar(texto, aviso) {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success(aviso)
    } catch {
      toast.error('O navegador bloqueou a cópia. Selecione o texto manualmente.')
    }
  }

  function baixarJson() {
    const dados = dadosCorrecao(prova, opcoes)
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gabarito-${dados.codigo}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function imprimir() {
    try {
      imprimirFolhaResposta(prova, opcoes)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const semGabarito = useMemo(() => {
    const gab = dadosCorrecao(prova, opcoes).gabarito
    return Object.entries(gab).filter(([, v]) => !v).map(([k]) => k)
  }, [prova, opcoes])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div className={styles.titulo}>
            <ScanLine size={17} />
            Folha de respostas para correção por IA
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.corpo}>

          <div className={styles.painel}>
            <div className={styles.grupo}>
              <span className={styles.grupoTitulo}>Alternativas por questão</span>
              <div className={styles.segmentos}>
                {[4, 5, 6].map(n => (
                  <button key={n}
                    className={`${styles.segmento} ${nLetras === n ? styles.segmentoOn : ''}`}
                    onClick={() => setNLetras(n)}>
                    A–{LETRAS[n - 1]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.grupo}>
              <span className={styles.grupoTitulo}>Questões</span>
              {objetivas.length > 0 && (
                <label className={styles.check}>
                  <input type="radio" checked={!avulsa} onChange={() => setAvulsa(false)} />
                  Usar as {objetivas.length} objetivas desta prova
                </label>
              )}
              <label className={styles.check}>
                <input type="radio" checked={avulsa} onChange={() => setAvulsa(true)} />
                Folha avulsa com
                <input
                  type="number" min="1" max="60"
                  className={styles.numero}
                  value={qtdAvulsa}
                  onFocus={() => setAvulsa(true)}
                  onChange={e => setQtdAvulsa(Number(e.target.value) || 1)} />
                questões
              </label>
            </div>

            <div className={styles.grupo}>
              <span className={styles.grupoTitulo}>Campos</span>
              <label className={styles.check}>
                <input type="checkbox" checked={campoNome}
                  onChange={e => setCampoNome(e.target.checked)} />
                Linha para o nome do aluno
              </label>
              <p className={styles.hint}>
                A identificação que a IA usa é o <b>número de chamada</b> — o nome
                manuscrito não é confiável na leitura automática.
              </p>
            </div>

            {dissertativas.length > 0 && !avulsa && (
              <div className={styles.alerta}>
                {dissertativas.length === 1 ? 'A questão' : 'As questões'}{' '}
                {dissertativas.map(q => q.numero).join(', ')}{' '}
                {dissertativas.length === 1 ? 'é dissertativa e fica' : 'são dissertativas e ficam'}{' '}
                fora da folha. A numeração das objetivas é mantida igual à da prova.
              </div>
            )}

            {semGabarito.length > 0 && (
              <div className={styles.alerta}>
                Sem alternativa correta cadastrada: questão(ões) {semGabarito.join(', ')}.
                A IA transcreve a marcação, mas não consegue corrigir essas.
              </div>
            )}

            <div className={styles.acoes}>
              <button className={styles.btnPrimary} onClick={imprimir}>
                <Printer size={14} /> Imprimir / PDF
              </button>
              <button className={styles.btnSecondary}
                onClick={() => copiar(promptGemini(prova, opcoes), 'Prompt copiado! Cole no Gemini junto com as folhas escaneadas.')}>
                <ClipboardCopy size={14} /> Copiar prompt do Gemini
              </button>
              <button className={styles.btnSecondary} onClick={baixarJson}>
                <Download size={14} /> Baixar gabarito (JSON)
              </button>
            </div>

            <div className={styles.fluxo}>
              <b>Como usar</b>
              <ol>
                <li>Imprima uma folha por aluno. Escreva a turma antes de fotocopiar.</li>
                <li>Escaneie em <b>300 dpi, tons de cinza</b> — nunca em preto-e-branco puro.</li>
                <li>Suba as imagens para uma pasta do Drive, uma pasta por turma.</li>
                <li>No Gemini, anexe as folhas e cole o prompt copiado aqui.</li>
                <li>Confira à mão toda folha que voltar com <code>revisar: true</code>.</li>
              </ol>
            </div>
          </div>

          <div className={styles.preview}>
            <div className={styles.previewRot}>
              Pré-visualização · {nPaginas === 1 ? '1 página' : `${nPaginas} páginas`}
            </div>
            <div className={styles.previewArea} ref={areaRef}>
              <div className={styles.previewPalco}
                style={{ height: FOLHA_A * nPaginas * escala + 24 * escala }}>
                <iframe
                  className={styles.iframe}
                  style={{
                    width: FOLHA_L,
                    height: FOLHA_A * nPaginas + 24,
                    transform: `scale(${escala})`,
                  }}
                  srcDoc={html}
                  title="Pré-visualização da folha de respostas" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
