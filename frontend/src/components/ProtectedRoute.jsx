import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="spinner-center" style={{ height: '100vh' }}>
        <div
          className="spinner spinner-blue"
          style={{ width: '44px', height: '44px', borderWidth: '3px' }}
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
