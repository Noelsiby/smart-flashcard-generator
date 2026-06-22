import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <Link to="/dashboard" className="navbar-brand" aria-label="Go to dashboard">
        <div className="navbar-logo" aria-hidden="true">📚</div>
        <span className="navbar-title">FlashCard AI</span>
      </Link>

      <div className="navbar-nav">
        {user && (
          <div className="navbar-user">
            <div className="navbar-avatar" title={user.name} aria-hidden="true">
              {initials}
            </div>
            <span className="navbar-username">{user.name}</span>
          </div>
        )}
        <button
          id="logout-btn"
          className="btn btn-secondary btn-sm"
          onClick={handleLogout}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
