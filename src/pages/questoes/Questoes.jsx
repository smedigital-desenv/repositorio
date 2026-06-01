import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listarQuestoes, listarDisciplinas } from '../../services/questoes'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Search, Filter, Star, BookOpen, ChevronDown, Eye, Pencil } from 'lucide-react'
import styles from './Questoes.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']
const STATUS_CONFIG = {
  rascunho:   { label: 'Rascunho'   },
  em_revisao: { label: 'Em revisão' },
  aprovado:   { label: 'Aprovado'   },
  publicado:  { label: 'Publicado'  },
  arquivado:  { label: 'Arquivado'  },
}
const TIPO_CONFIG = {
  multipla_escolha: { label: 'Múltipla escolha' },
  dissertativa:     { label: 'Dissertativa'      },
}

function Estrelas({ valor }) {
  return (
    <div className={styles.estrelas}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={12} className={i < Math.round(valor ?? 0) ? styles.estOn : styles.estOff} />
      ))}
    </div>
  )
}

function Dificuldade({ valor }) {
  return (
    <div className={styles.dificuldade}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < (valor ?? 0) ? styles.dotOn : styles.dotOff} />
      ))}
    </div>
  )
}

export default function Questoes() {
  const navigate = useNavigate()
  const [filtros, setFiltros] = useState({ status: 'publicado' })
  const [buscaTexto, setBuscaTexto] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const { data: questoes = [], isLoading } = useQuery({
    queryKey: ['questoes', filtros],
    queryFn: () => listarQuestoes(filtros),
  })

  const { data: disciplinas = [] } = useQuery({
    queryKey: ['disciplinas'],
    queryFn: listarDisciplinas,
  })

  function setFiltro(key, val) {
    setFiltros(f => { const n = {...f}; if (val) n[key] = val; else delete n[key]; return n })
  }

  const questoesFiltradas = questoes.filter(q =>
    !buscaTexto ||
    q.titulo?.toLowerCase().includes(buscaTexto.toLowerCase()) ||
    q.enunciado?.toLowerCase().includes(buscaTexto.toLowerCase())
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Banco de Questões</h1>
          <p className={styles.subtitulo}>{questoes.length} questões encontradas</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => navigate('/questoes/nova')}>
          <Plus size={15} /> Nova questão
        </button>
      </div>

      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por título ou enunciado..."
            value={buscaTexto}
            onChange={e => setBuscaTexto(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`${styles.btnFiltro} ${mostrarFiltros ? styles.btnFiltroAtivo : ''}`}
          onClick={() => setMostrarFiltros(v => !v)}
        >
          <Filter size={14} /> Filtros <ChevronDown size={13} />
        </button>
      </div>

      {mostrarFiltros && (
        <div className={styles.filtrosPanel}>
          <select className={styles.filtroSelect} value={filtros.status ?? ''}
            onChange={e => setFiltro('status', e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select className={styles.filtroSelect} value={filtros.tipo ?? ''}
            onChange={e => setFiltro('tipo', e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="multipla_escolha">Múltipla escolha</option>
            <option value="dissertativa">Dissertativa</option>
          </select>
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
          <select className={styles.filtroSelect} value={filtros.dificuldade ?? ''}
            onChange={e => setFiltro('dificuldade', e.target.value ? Number(e.target.value) : '')}>
            <option value="">Qualquer dificuldade</option>
            {[1,2,3,4,5].map(n => (
              <option key={n} value={n}>{n} — {['Muito fácil','Fácil','Médio','Difícil','Muito difícil'][n-1]}</option>
            ))}
          </select>
          <button className={styles.btnLimpar}
            onClick={() => { setFiltros({}); setBuscaTexto('') }}>
            Limpar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className={styles.loading}>Carregando questões...</div>
      ) : questoesFiltradas.length === 0 ? (
        <div className={styles.vazio}>
          <BookOpen size={36} strokeWidth={1.5} />
          <p>Nenhuma questão encontrada</p>
          <button className={styles.btnPrimary} onClick={() => navigate('/questoes/nova')}>
            <Plus size={14} /> Criar primeira questão
          </button>
        </div>
      ) : (
        <div className={styles.lista}>
          {questoesFiltradas.map(q => (
            <div key={q.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardBadges}>
                  <span className={`${styles.badge} ${styles['tipo_' + q.tipo]}`}>
                    {TIPO_CONFIG[q.tipo]?.label}
                  </span>
                  <span className={`${styles.badge} ${styles['status_' + q.status]}`}>
                    {STATUS_CONFIG[q.status]?.label}
                  </span>
                  {q.disciplinas && (
                    <span className={styles.badgeDisc}>
                      {q.disciplinas.nome}
                    </span>
                  )}
                  {q.ano_escolar && (
                    <span className={styles.badgeGray}>{q.ano_escolar}</span>
                  )}
                </div>
                <div className={styles.cardAcoes}>
                  <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}`)} title="Ver">
                    <Eye size={15} />
                  </button>
                  <button className={styles.iconBtn} onClick={() => navigate(`/questoes/${q.id}/editar`)} title="Editar">
                    <Pencil size={15} />
                  </button>
                </div>
              </div>

              <h3 className={styles.cardTitulo} onClick={() => navigate(`/questoes/${q.id}`)}>
                {q.titulo}
              </h3>

              <div className={styles.cardEnunciado}
                dangerouslySetInnerHTML={{ __html: q.enunciado?.slice(0, 220) + (q.enunciado?.length > 220 ? '…' : '') }}
              />

              {q.habilidades?.length > 0 && (
                <div className={styles.habilidades}>
                  {q.habilidades.slice(0, 4).map(h => (
                    <span key={h.id} className={styles.habilidadeTag} title={h.descricao}>{h.codigo}</span>
                  ))}
                  {q.habilidades.length > 4 && <span className={styles.habilidadeTag}>+{q.habilidades.length - 4}</span>}
                </div>
              )}

              <div className={styles.cardFooter}>
                <Dificuldade valor={q.nivel_dificuldade} />
                <Estrelas valor={q.media_avaliacao} />
                {q.total_avaliacoes > 0 && <span className={styles.totalAval}>({q.total_avaliacoes})</span>}
                <span className={styles.footerSep} />
                <span className={styles.autor}>{q.perfis?.nome}</span>
                <span className={styles.data}>{new Date(q.criado_em).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
