import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { buscarProva, registrarUsoProva } from '../../services/provas'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, Printer, Pencil } from 'lucide-react'
import { useEffect } from 'react'
import { CABECALHO_PADRAO } from '../../components/ProvaHeader'
import styles from './ProvaDetalhe.module.css'

export default function ProvaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isFormador, isAdmin, usuario } = useAuth()
  const podeEditar = isFormador || isAdmin

  const { data: prova, isLoading } = useQuery({
    queryKey: ['prova', id],
    queryFn: () => buscarProva(id),
  })

  useEffect(() => {
    if (id) registrarUsoProva(id)
  }, [id])

  function handleImprimir() {
    const cfg = prova.cfg_impressao || {}
    const fontSize = cfg.tamanhoFonte ? `${cfg.tamanhoFonte}pt` : '11pt'
    const separador = cfg.separadorQuestoes !== false
    const semQuebra = cfg.quebrarPagina !== false
    const cabecalhoHtml = prova.cabecalho || CABECALHO_PADRAO

    const questoesHtml = (prova.questoes || []).map((q, idx) => {
      const alts = q.tipo === 'multipla_escolha' && q.alternativas?.length
        ? q.alternativas.map(a =>
            `<div style="display:flex;gap:8px;margin:3px 0;font-size:${fontSize}">
              <span style="font-weight:700;min-width:18px">${a.letra})</span>
              <span>${a.texto}</span>
            </div>`
          ).join('')
        : q.tipo === 'dissertativa'
          ? Array(4).fill('<div style="border-bottom:1px solid #888;height:18px;margin-bottom:10px"></div>').join('')
          : ''

      const dif = q.nivel_dificuldade
        ? `<span style="font-size:9pt;color:#666;margin-left:8px">${'●'.repeat(q.nivel_dificuldade)}${'○'.repeat(5-q.nivel_dificuldade)}</span>`
        : ''

      const sep = separador && idx > 0
        ? `<hr style="border:none;border-top:1px solid #ddd;margin:14px 0"/>`
        : idx > 0 ? '<div style="margin-top:16px"></div>' : ''

      return `${sep}
        <div style="page-break-inside:${semQuebra ? 'avoid' : 'auto'}">
          <p style="font-weight:700;font-size:${fontSize};margin:0 0 6px">
            Questão ${idx + 1}${dif}
          </p>
          <div style="font-size:${fontSize};margin-bottom:8px">${q.enunciado}</div>
          ${alts}
        </div>`
    }).join('')

    const instrHtml = prova.instrucoes
      ? `<div style="font-size:10pt;background:#f8f8f8;border-left:3px solid #999;padding:8px 12px;margin:10px 0">
          <strong>Instruções:</strong> ${prova.instrucoes}
        </div>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${prova.titulo}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; color: #000; }
    img { max-width: 100%; height: auto; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${cabecalhoHtml}
  <h2 style="text-align:center;font-size:14pt;font-weight:700;margin:12px 0 6px">${prova.titulo}</h2>
  ${instrHtml}
  <div>${questoesHtml}</div>
  <div style="display:flex;justify-content:space-between;margin-top:24px;padding-top:8px;border-top:1px solid #ccc;font-size:9pt;color:#555">
    <span>Total: ${prova.questoes?.length || 0} questões</span>
    <span>Assinatura: ___________________________</span>
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  if (isLoading) return <div className={styles.loading}>Carregando prova...</div>
  if (!prova) return <div className={styles.loading}>Prova não encontrada.</div>

  const cfg = prova.cfg_impressao || {}
  const fontSize = cfg.tamanhoFonte ? `${cfg.tamanhoFonte}pt` : '11pt'
  const separador = cfg.separadorQuestoes !== false
  const semQuebra = cfg.quebrarPagina !== false
  const cabecalhoHtml = prova.cabecalho || CABECALHO_PADRAO

  return (
    <div className={styles.page}>
      {/* Topbar — não aparece na impressão */}
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/provas')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className={styles.topbarInfo}>
          <span className={styles.topbarTitulo}>{prova.titulo}</span>
          <span className={styles.topbarMeta}>
            {prova.questoes?.length || 0} questões
            {prova.ano_escolar && ` · ${prova.ano_escolar}`}
          </span>
        </div>
        <div className={styles.topbarAcoes}>
          <button className={styles.btnSecondary} onClick={handleImprimir}>
            <Printer size={14} /> Imprimir / PDF
          </button>
          {(podeEditar || prova.autor_id === usuario?.id) && (
            <button className={styles.btnSecondary}
              onClick={() => navigate(`/provas/${id}/editar`)}>
              <Pencil size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo imprimível */}
      <div className={styles.printArea} style={{ fontSize }}>

        {/* Cabeçalho HTML personalizado */}
        <div className={styles.cabecalho}
          dangerouslySetInnerHTML={{ __html: cabecalhoHtml }} />

        {/* Título da prova */}
        <h1 className={styles.tituloprova}>{prova.titulo}</h1>

        {prova.instrucoes && (
          <div className={styles.instrucoes}>
            <strong>Instruções:</strong> {prova.instrucoes}
          </div>
        )}

        {/* Questões */}
        <div className={styles.questoes}>
          {prova.questoes?.length === 0 ? (
            <p className={styles.vazio}>Nenhuma questão nesta prova.</p>
          ) : (
            prova.questoes.map((q, idx) => (
              <div key={q.id}
                className={styles.questao}
                style={{
                  pageBreakInside: semQuebra ? 'avoid' : 'auto',
                  borderTop: separador && idx > 0
                    ? '1px solid #e2e8f0' : 'none',
                  paddingTop: separador && idx > 0 ? '14px' : '0',
                  marginTop: idx > 0 ? '14px' : '0',
                }}>
                <div className={styles.qHeader}>
                  <span className={styles.qNum}>Questão {idx + 1}</span>
                  {q.nivel_dificuldade && (
                    <span className={styles.qDif}>
                      {'●'.repeat(q.nivel_dificuldade)}{'○'.repeat(5 - q.nivel_dificuldade)}
                    </span>
                  )}
                </div>

                <div className={styles.enunciado}
                  style={{ fontSize }}
                  dangerouslySetInnerHTML={{ __html: q.enunciado }} />

                {q.tipo === 'multipla_escolha' && q.alternativas?.length > 0 && (
                  <div className={styles.alternativas}>
                    {q.alternativas.map(alt => (
                      <div key={alt.id} className={styles.altItem} style={{ fontSize }}>
                        <span className={styles.altLetra}>{alt.letra})</span>
                        <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                      </div>
                    ))}
                  </div>
                )}

                {q.tipo === 'dissertativa' && (
                  <div className={styles.espacoResposta}>
                    {Array(4).fill(null).map((_, i) => (
                      <div key={i} className={styles.linhaResposta} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className={styles.rodape}>
          <span>Total: {prova.questoes?.length || 0} questões</span>
          <span>Assinatura: ___________________________</span>
        </div>
      </div>
    </div>
  )
}
