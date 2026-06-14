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
    window.print()
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
