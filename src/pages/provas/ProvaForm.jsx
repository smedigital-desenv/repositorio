import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  criarProva, atualizarProva, buscarProva,
  listarDisciplinas, listarQuestoesBuscaRapida
} from '../../services/provas'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Trash2, ChevronLeft, Save, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './ProvaForm.module.css'

const ANOS = ['1º ano','2º ano','3º ano','4º ano','5º ano','6º ano','7º ano','8º ano','9º ano']

export default function ProvaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const isEdicao = !!id

  const [form, setForm] = useState({
    titulo: '', descricao: '', disciplina_id: '', ano_escolar: '', instrucoes: ''
  })
  const [questoes, setQuestoes] = useState([])
  const [buscaTexto, setBuscaTexto] = useState('')
  const [filtroDisc, setFiltroDisc] = useState('')
  const [dragIndex, setDragIndex] = useState(null)

  const { data: provaExistente } = useQuery({
    queryKey: ['prova', id],
    queryFn: () => buscarProva(id),
    enabled: isEdicao,
  })

  useEffect(() => {
    if (provaExistente) {
      setForm({
        titulo: provaExistente.titulo,
        descricao: provaExistente.descricao || '',
        disciplina_id: provaExistente.disciplina_id || '',
        ano_escolar: provaExistente.ano_escolar || '',
        instrucoes: provaExistente.instrucoes || '',
      })
      setQuestoes(provaExistente.questoes?.map(q => q.id) || [])
    }
  }, [provaExistente])

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: listarDisciplinas })

  const { data: questoesBusca = [] } = useQuery({
    queryKey: ['questoes-busca', { disciplina_id: filtroDisc, busca: buscaTexto }],
    queryFn: () => listarQuestoesBuscaRapida({ disciplina_id: filtroDisc, busca: buscaTexto }),
  })

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error('Título é obrigatório')
      if (questoes.length === 0) throw new Error('Adicione pelo menos uma questão')

      const dados = { ...form, disciplina_id: form.disciplina_id || null, autor_id: usuario.id }

      if (isEdicao) {
        return atualizarProva(id, dados, questoes)
      } else {
        return criarProva(dados, questoes)
      }
    },
    onSuccess: (data) => {
      toast.success(isEdicao ? 'Prova atualizada!' : 'Prova criada!')
      navigate(`/provas/${data.id}`)
    },
    onError: (err) => toast.error(err.message),
  })

  function addQuestao(qId) {
    if (!questoes.includes(qId)) {
      setQuestoes([...questoes, qId])
      toast.success('Questão adicionada')
    } else {
      toast.error('Questão já está na prova')
    }
  }

  function removeQuestao(idx) {
    setQuestoes(qs => qs.filter((_, i) => i !== idx))
  }

  function moveQuestao(fromIdx, toIdx) {
    const novas = [...questoes]
    const [removed] = novas.splice(fromIdx, 1)
    novas.splice(toIdx, 0, removed)
    setQuestoes(novas)
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className={styles.btnBack} onClick={() => navigate('/provas')}>
          <ChevronLeft size={16} /> Voltar
        </button>
        <h1 className={styles.titulo}>{isEdicao ? 'Editar prova' : 'Nova prova'}</h1>
        <button className={styles.btnPrimary}
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}>
          <Save size={14} /> {salvar.isPending ? 'Salvando...' : 'Salvar prova'}
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.colMain}>
          <div className={styles.card}>
            <label className={styles.label}>Título da prova *</label>
            <input className={styles.input}
              placeholder="Ex: Avaliação de Expressões Numéricas"
              value={form.titulo}
              onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
            />
          </div>

          <div className={styles.card}>
            <label className={styles.label}>Descrição</label>
            <textarea className={styles.textarea}
              placeholder="Contexto ou objetivo da prova..."
              value={form.descricao}
              onChange={e => setForm(f => ({...f, descricao: e.target.value}))}
              rows={3}
            />
          </div>

          <div className={styles.card}>
            <label className={styles.label}>Instruções para o aluno</label>
            <textarea className={styles.textarea}
              placeholder="Ex: Responda todas as questões. Deixe os cálculos..."
              value={form.instrucoes}
              onChange={e => setForm(f => ({...f, instrucoes: e.target.value}))}
              rows={2}
            />
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitulo}>Questões selecionadas ({questoes.length})</p>
            {questoes.length === 0 ? (
              <p className={styles.vazioQuestoes}>Nenhuma questão adicionada. Selecione à direita.</p>
            ) : (
              <div className={styles.questoesList}>
                {questoes.map((qId, idx) => {
                  const q = questoesBusca.find(qq => qq.id === qId)
                  return (
                    <div key={qId} className={styles.questaoItem}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => moveQuestao(dragIndex, idx)}>
                      <GripVertical size={14} className={styles.dragHandle} />
                      <span className={styles.qNum}>{idx + 1}.</span>
                      <span className={styles.qTitulo}>{q?.titulo || 'Questão não encontrada'}</span>
                      <button className={styles.removeBtn} onClick={() => removeQuestao(idx)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className={styles.colSide}>
          <div className={styles.card}>
            <label className={styles.label}>Disciplina</label>
            <select className={styles.select}
              value={form.disciplina_id}
              onChange={e => {
                setForm(f => ({...f, disciplina_id: e.target.value}))
                setFiltroDisc(e.target.value)
              }}>
              <option value="">Selecione...</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>

          <div className={styles.card}>
            <label className={styles.label}>Ano escolar</label>
            <select className={styles.select}
              value={form.ano_escolar}
              onChange={e => setForm(f => ({...f, ano_escolar: e.target.value}))}>
              <option value="">Selecione...</option>
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitulo}>Buscar questões</p>
            <input className={styles.input}
              placeholder="Título da questão..."
              value={buscaTexto}
              onChange={e => setBuscaTexto(e.target.value)}
              style={{marginBottom: 8}}
            />
            <div className={styles.questoesDisponiveis}>
              {questoesBusca.length === 0 ? (
                <p className={styles.hint}>Nenhuma questão encontrada</p>
              ) : (
                questoesBusca.slice(0, 20).map(q => (
                  <button key={q.id} className={styles.btnAddQuestao}
                    onClick={() => addQuestao(q.id)}>
                    <Plus size={13} /> {q.titulo?.slice(0, 40)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
