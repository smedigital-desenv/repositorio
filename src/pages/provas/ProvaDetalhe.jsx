import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { buscarProva, registrarUsoProva, gerarPDFProva } from '../../services/provas'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, Download, Printer, Pencil } from 'lucide-react'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import styles from './ProvaDetalhe.module.css'

export default function ProvaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, isFormador, isAdmin } = useAuth()
  const podeEditar = isFormador || isAdmin

  const { data: prova, isLoading } = useQuery({
    queryKey: ['prova', id],
    queryFn: () => buscarProva(id),
  })

  useEffect(() => {
    if (id) registrarUsoProva(id)
  }, [id])

  async function handleGerarPDF() {
    if (!prova) return
    try {
      const html = await gerarPDFProva(prova)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${prova.titulo}.pdf`
      link.click()
      toast.success('PDF gerado!')
    } catch (err) {
      toast.error('Erro ao gerar PDF')
    }
  }

  function handleImprimir() {
    window.print()
  }

  if (isLoading) return <div className={styles.loading}>Carregando prova...</div>
  if (!prova) return <div className={styles.loading}>Prova não encontrada.</div>

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/provas')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className={styles.topbarAcoes}>
          <button className={styles.btnSecondary} onClick={handleImprimir}>
            <Printer size={14} /> Imprimir
          </button>
          <button className={styles.btnSecondary} onClick={handleGerarPDF}>
            <Download size={14} /> PDF
          </button>
          {podeEditar && (
            <button className={styles.btnSecondary} onClick={() => navigate(`/provas/${id}/editar`)}>
              <Pencil size={14} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className={styles.container}>
        {/* Cabeçalho */}
        <div className={styles.header}>
          <h1 className={styles.titulo}>{prova.titulo}</h1>
          {prova.descricao && <p className={styles.descricao}>{prova.descricao}</p>}
          
          <div className={styles.meta}>
            <span>Disciplina: <strong>{prova.disciplinas?.nome || '—'}</strong></span>
            <span>Ano: <strong>{prova.ano_escolar || '—'}</strong></span>
            <span>Questões: <strong>{prova.questoes?.length || 0}</strong></span>
          </div>

          {prova.instrucoes && (
            <div className={styles.instrucoes}>
              <p className={styles.instrTitulo}>Instruções:</p>
              <p>{prova.instrucoes}</p>
            </div>
          )}
        </div>

        {/* Questões */}
        <div className={styles.questoes}>
          {prova.questoes?.length === 0 ? (
            <p className={styles.vazio}>Nenhuma questão nesta prova.</p>
          ) : (
            prova.questoes.map((q, idx) => (
              <div key={q.id} className={styles.questao}>
                <h3 className={styles.qNum}>Questão {idx + 1}</h3>
                <div className={styles.enunciado}
                  dangerouslySetInnerHTML={{ __html: q.enunciado }} />

                {q.tipo === 'multipla_escolha' && q.alternativas?.length > 0 && (
                  <div className={styles.alternativas}>
                    {q.alternativas.map(alt => (
                      <div key={alt.id} className={styles.altItem}>
                        <span className={styles.altLetra}>{alt.letra})</span>
                        <span dangerouslySetInnerHTML={{ __html: alt.texto }} />
                      </div>
                    ))}
                  </div>
                )}

                {q.tipo === 'dissertativa' && (
                  <div className={styles.espacoResposta}>
                    _________________________________________________________________<br/>
                    _________________________________________________________________<br/>
                    _________________________________________________________________<br/>
                    _________________________________________________________________
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rodapé para impressão */}
      <div className={styles.printFooter}>
        <p>Data: ________________     Assinatura: ___________________________</p>
      </div>
    </div>
  )
}
