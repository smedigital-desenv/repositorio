import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarProvas, listarDisciplinas } from '../../services/provas'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Search, Eye, Pencil, Trash2, FileText, ChevronDown } from 'lucide-react'
import styles from './Provas.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

export default function Provas() {
  const navigate = useNavigate()
  const { isFormador, isAdmin } = useAuth()
  const podeEditar = isFormador || isAdmin

  const [filtros, setFiltros] = useState({})
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const { data: provas = [], isLoading } = useQuery({
    queryKey: ['provas', filtros],
    queryFn: () => listarProvas(filtros),
  })

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  function setFiltro(key, val) {
    setFiltros(f => { const n = {...f}; if (val) n[key] = val; else delete n[key]; return n })
  }

  const provasFiltradas = provas.filter(p =>
    !buscaTexto || p.titulo?.toLowerCase().includes(buscaTexto.toLowerCase())
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Provas e Avaliações</h1>
          <p className={styles.subtitulo}>{provas.length} prova(s) criada(s)</p>
        </div>
        {podeEditar && (
          <button className={styles.btnPrimary} onClick={() => navigate('/provas/nova')}>
            <Plus size={15} /> Nova prova
          </button>
        )}
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por título..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`${styles.btnFiltro} ${mostrarFiltros ? styles.btnFiltroAtivo : ''}`}
          onClick={() => setMostrarFiltros(v => !v)}
        >
          Filtros <ChevronDown size={13} />
        </button>
      </div>

      {mostrarFiltros && (
        <div className={styles.filtrosPanel}>
          <select className={styles.filtroSelect} value={filtros.disciplina_id ?? ''}
            onChange={e => setFiltro('disciplina_id', e.target.value)}>
            <option value="">Todas as disciplinas</option>
            {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select className={styles.filtroSelect} value={filtros.ano_escolar ?? ''}
            onChange={e => setFiltro('ano_escolar', e.target.value)}>
            <option value="">Todos os anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className={styles.btnLimpar}
            onClick={() => { setFiltros({}); setBuscaTexto('') }}>
            Limpar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>Carregando provas...</div>
      ) : provasFiltradas.length === 0 ? (
        <div className={styles.vazio}>
          <FileText size={36} strokeWidth={1.5} />
          <p>Nenhuma prova encontrada</p>
          {podeEditar && (
            <button className={styles.btnPrimary} onClick={() => navigate('/provas/nova')}>
              <Plus size={14} /> Criar primeira prova
            </button>
          )}
        </div>
      ) : (
        <div className={styles.lista}>
          {provasFiltradas.map(p => (
            <div key={p.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitulo} onClick={() => navigate(`/provas/${p.id}`)}>
                    {p.titulo}
                  </h3>
                  <p className={styles.cardDesc}>{p.descricao?.slice(0, 100)}</p>
                </div>
                {podeEditar && (
                  <div className={styles.cardAcoes}>
                    <button className={styles.iconBtn} onClick={() => navigate(`/provas/${p.id}`)} title="Ver">
                      <Eye size={15} />
                    </button>
                    <button className={styles.iconBtn} onClick={() => navigate(`/provas/${p.id}/editar`)} title="Editar">
                      <Pencil size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.cardBadges}>
                {p.disciplinas && (
                  <span className={styles.badgeDisc}>{p.disciplinas.nome}</span>
                )}
                {p.ano_escolar && (
                  <span className={styles.badgeGray}>{p.ano_escolar}</span>
                )}
                <span className={styles.badgeQuestoes}>{p.total_questoes} questões</span>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.autor}>{p.perfis?.nome}</span>
                <span className={styles.data}>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
