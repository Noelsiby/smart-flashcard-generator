import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getFlashcardSets } from '../api/client'
import Navbar from '../components/Navbar'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function DashboardPage() {
  const { user }              = useAuth()
  const navigate              = useNavigate()
  const [sets, setSets]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getFlashcardSets()
        if (!cancelled) setSets(res.data.sets ?? [])
      } catch {
        if (!cancelled) setError('Failed to load your flashcard sets. Please try refreshing.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  const today = new Date().toDateString()
  let reviewedToday = 0
  let knownTotal = 0
  let unknownTotal = 0

  sets.forEach(set => {
    set.cards?.forEach(card => {
      if (card.last_reviewed) {
        if (new Date(card.last_reviewed).toDateString() === today) {
          reviewedToday++
        }
      }
      knownTotal += (card.known_count || 0)
      unknownTotal += (card.unknown_count || 0)
    })
  })

  const totalReviews = knownTotal + unknownTotal
  const knownPct = totalReviews > 0 ? Math.round((knownTotal / totalReviews) * 100) : 0

  return (
    <>
      <Navbar />
      <main className="page">
        <div className="page-container">

          {/* Welcome Banner */}
          <section className="dashboard-welcome" aria-label="Welcome banner">
            <p className="welcome-greeting">{getGreeting()}</p>
            <h1 className="welcome-name">Hello, {firstName}! 👋</h1>
            <p className="welcome-desc">
              {sets.length === 0
                ? "You haven't created any flashcard sets yet. Generate your first one from your study notes!"
                : `Keep studying — you're doing great!`}
            </p>

            {sets.length > 0 && (
              <div style={{ display: 'flex', gap: '24px', marginTop: '24px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', padding: '16px 24px', borderRadius: 'var(--r-xl)', minWidth: '150px' }}>
                  <div style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>Total Sets</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800 }}>{sets.length}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', padding: '16px 24px', borderRadius: 'var(--r-xl)', minWidth: '150px' }}>
                  <div style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>Cards Reviewed Today</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800 }}>{reviewedToday}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', padding: '16px 24px', borderRadius: 'var(--r-xl)', minWidth: '150px' }}>
                  <div style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>Overall Known</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800 }}>{knownPct}%</div>
                </div>
              </div>
            )}
          </section>

          {/* Sets section */}
          <div className="sets-header">
            <h2 className="sets-title">
              📑 My Flashcard Sets
              {sets.length > 0 && (
                <span className="badge badge-blue" style={{ marginLeft: 12 }}>{sets.length}</span>
              )}
            </h2>
            <button
              id="create-set-btn"
              className="btn btn-primary"
              onClick={() => navigate('/generate')}
            >
              ✨ Create New Set
            </button>
          </div>

          {/* Loading Skeletons */}
          {loading && (
            <div className="sets-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="set-card" style={{ animation: 'pulse 1.5s infinite ease-in-out', opacity: 0.7 }}>
                  <div style={{ width: '70%', height: 24, background: 'var(--gray-200)', borderRadius: 'var(--r-md)', marginBottom: 16 }} />
                  <div className="set-card-meta">
                    <div style={{ width: '30%', height: 16, background: 'var(--gray-200)', borderRadius: 'var(--r-md)' }} />
                    <div style={{ width: '40%', height: 16, background: 'var(--gray-200)', borderRadius: 'var(--r-md)' }} />
                  </div>
                  <div className="set-card-actions" style={{ marginTop: 16 }}>
                    <div style={{ width: 80, height: 36, background: 'var(--gray-200)', borderRadius: 'var(--r-full)' }} />
                    <div style={{ width: 70, height: 36, background: 'var(--gray-200)', borderRadius: 'var(--r-full)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="form-error" role="alert">{error}</div>
          )}

          {/* Empty state */}
          {!loading && !error && sets.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3 className="empty-state-title">No flashcard sets yet</h3>
              <p className="empty-state-desc">
                Paste any study notes and let us generate interactive flashcards for you — instantly.
              </p>
              <button
                id="generate-first-btn"
                className="btn btn-primary btn-lg"
                onClick={() => navigate('/generate')}
              >
                ✨ Generate My First Set
              </button>
            </div>
          )}

          {/* Sets grid */}
          {!loading && !error && sets.length > 0 && (
            <div className="sets-grid">
              {sets.map((set, idx) => (
                <article
                  key={set.id}
                  className="set-card"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <h3 className="set-card-title">{set.title}</h3>
                  <div className="set-card-meta">
                    <div className="set-card-stat">
                      🃏&nbsp;<strong>{set.cards?.length ?? 0}</strong>&nbsp;cards
                    </div>
                    <div className="set-card-stat">
                      📅&nbsp;{formatDate(set.created_at)}
                    </div>
                  </div>
                  <div className="set-card-actions">
                    <button
                      id={`review-btn-${set.id}`}
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/review/${set.id}`)}
                    >
                      🎯 Review
                    </button>
                    <button
                      id={`view-btn-${set.id}`}
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/review/${set.id}`)}
                    >
                      👁 View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

        </div>
      </main>
    </>
  )
}
