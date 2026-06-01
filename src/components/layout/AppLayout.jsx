import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  BookOpen, HelpCircle, FileText, FolderOpen, ClipboardList,
  Sitemap, Layers, Heart, BarChart2, Map, Eye,
  LogOut, ChevronDown, Menu, X, BookMarked
} from 'lucide-react'
import styles from './AppLayout.module.css'

const NAV_ITEMS = [
  {
    section: 'Principal',
    items: [
      { to: '/questoes',   label: 'Banco de Questões',     icon: HelpCircle,    badge: null },
      { to: '/planos',     label: 'Planos de Aula',        icon: FileText,      badge: null },
      { to: '/materiais',  label: 'Materiais Pedagógicos', icon: FolderOpen,    badge: null },
      { to: '/provas',     label: 'Provas e Avaliações',   icon: ClipboardList, badge: null },
    ]
  },
  {
    section: 'Organização',
    items: [
      { to: '/matriz',    label: 'Matriz Curricular', icon: Sitemap, badge: null },
      { to: '/colecoes',  label: 'Minhas Coleções',   icon: Layers,  badge: null },
      { to: '/favoritos', label: 'Favoritos',         icon: Heart,   badge: null },
    ]
  },
  {
    section: 'Gestão',
    items: [
      { to: '/relatorios', label: 'Relatórios',          icon: BarChart2, badge: null },
      { to: '/cobertura',  label: 'Cobertura Curricular', icon: Map,      badge: null },
      { to: '/revisao',    label: 'Fila de Revisão',      icon: Eye,      badge: 'revisao' },
    ]
  },
]

function NavItem({ to, label, Icon, badge, badgeCount }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
      }
    >
      <Icon size={16} aria-hidden />
      <span>{label}</span>
      {badge && badgeCount > 0 && (
        <span className={styles.badgeWarning}>{badgeCount}</span>
      )}
    </NavLink>
  )
}

export default function AppLayout() {
  const { perfil, papel, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const papelLabel = {
    professor: 'Professor',
    formador: 'Formador',
    administrador: 'Administrador',
  }[papel] ?? ''

  const iniciais = perfil?.nome
    ? perfil.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebar = (
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
      {/* Logo */}
      <div className={styles.sidebarHeader}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <BookMarked size={16} />
          </div>
          <div>
            <div className={styles.logoText}>RepedMunicipal</div>
            <div className={styles.logoSub}>SME · Repositório Pedagógico</div>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className={styles.nav} aria-label="Navegação principal">
        {NAV_ITEMS.map(group => (
          <div key={group.section}>
            <div className={styles.navSection}>{group.section}</div>
            {group.items.map(item => (
              <NavItem
                key={item.to}
                to={item.to}
                label={item.label}
                Icon={item.icon}
                badge={item.badge}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Usuário */}
      <div className={styles.sidebarFooter}>
        <div className={styles.userChip}>
          <div className={styles.avatar}>{iniciais}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{perfil?.nome ?? 'Carregando...'}</div>
            <div className={styles.userRole}>{papelLabel}</div>
          </div>
          <button
            className={styles.signOutBtn}
            onClick={handleSignOut}
            title="Sair"
            aria-label="Sair da conta"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className={styles.shell}>
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {sidebar}

      <div className={styles.main}>
        {/* Topbar mobile */}
        <header className={styles.mobileTopbar}>
          <button
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Abrir menu"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className={styles.mobileLogo}>RepedMunicipal</div>
        </header>

        {/* Conteúdo da página */}
        <main className={styles.content} id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
