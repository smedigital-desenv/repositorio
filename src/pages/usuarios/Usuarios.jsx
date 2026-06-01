import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listarUsuarios, alterarPapel, toggleUsuario } from '../../services/usuarios'
import { useAuth } from '../../contexts/AuthContext'
import { UserPlus, Search, Shield, UserCheck, UserX, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import NovoUsuarioModal from './NovoUsuarioModal'
import styles from './Usuarios.module.css'

const PAPEIS = {
  professor:     { label: 'Professor',     cor: 'blue' },
  formador:      { label: 'Formador',      cor: 'green' },
  administrador: { label: 'Administrador', cor: 'purple' },
}

export default function Usuarios() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState('')
  const [filtroPapel, setFiltroPapel] = useState('')
  const [modalAberto, setModalAberto] = useState(false)

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })

  const mutarPapel = useMutation({
    mutationFn: ({ id, papel }) => alterarPapel(id, papel),
    onSuccess: () => {
      queryClient.invalidateQueries(['usuarios'])
      toast.success('Papel atualizado')
    },
    onError: () => toast.error('Erro ao atualizar papel'),
  })

  const mutarToggle = useMutation({
    mutationFn: ({ id, ativo }) => toggleUsuario(id, ativo),
    onSuccess: () => {
      queryClient.invalidateQueries(['usuarios'])
      toast.success('Usuário atualizado')
    },
    onError: () => toast.error('Erro ao atualizar usuário'),
  })

  const usuariosFiltrados = usuarios.filter(u => {
    const matchBusca = !busca ||
      u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      u.email?.toLowerCase().includes(busca.toLowerCase())
    const matchPapel = !filtroPapel || u.papel === filtroPapel
    return matchBusca && matchPapel
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Usuários</h1>
          <p className={styles.subtitulo}>{usuarios.length} usuários cadastrados</p>
        </div>
        {isAdmin && (
          <button className={styles.btnPrimary} onClick={() => setModalAberto(true)}>
            <UserPlus size={15} aria-hidden />
            Novo usuário
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className={styles.filtros}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} aria-hidden />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <select
          className={styles.select}
          value={filtroPapel}
          onChange={e => setFiltroPapel(e.target.value)}
        >
          <option value="">Todos os papéis</option>
          <option value="professor">Professor</option>
          <option value="formador">Formador</option>
          <option value="administrador">Administrador</option>
        </select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className={styles.loading}>Carregando usuários...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Escola</th>
                <th>Status</th>
                {isAdmin && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className={styles.vazio}>
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map(u => (
                  <tr key={u.id} className={!u.ativo ? styles.rowInativo : ''}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>
                          {u.nome?.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase() || '?'}
                        </div>
                        <span>{u.nome || '—'}</span>
                      </div>
                    </td>
                    <td className={styles.email}>{u.email}</td>
                    <td>
                      {isAdmin ? (
                        <select
                          className={`${styles.papelSelect} ${styles['papel_' + u.papel]}`}
                          value={u.papel}
                          onChange={e => mutarPapel.mutate({ id: u.id, papel: e.target.value })}
                        >
                          {Object.entries(PAPEIS).map(([val, { label }]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`${styles.papelBadge} ${styles['papel_' + u.papel]}`}>
                          {PAPEIS[u.papel]?.label ?? u.papel}
                        </span>
                      )}
                    </td>
                    <td className={styles.escola}>{u.escola_nome || '—'}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${u.ativo ? styles.ativo : styles.inativo}`}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          className={styles.toggleBtn}
                          onClick={() => mutarToggle.mutate({ id: u.id, ativo: !u.ativo })}
                          title={u.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                        >
                          {u.ativo
                            ? <><UserX size={14} aria-hidden /> Desativar</>
                            : <><UserCheck size={14} aria-hidden /> Ativar</>
                          }
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <NovoUsuarioModal
          onClose={() => setModalAberto(false)}
          onSuccess={() => {
            setModalAberto(false)
            queryClient.invalidateQueries(['usuarios'])
          }}
        />
      )}
    </div>
  )
}
