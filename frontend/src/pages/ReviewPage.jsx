import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getFlashcardSet, updateReviewStatus } from '../api/client'
import Navbar from '../components/Navbar'
import ProgressBar from '../components/ProgressBar'

// ── Difficulty helpers ─────────────────────────────────────────────────────────

/**
 * Return a difficulty tier from a card's difficulty_weight.
 *   easy   weight < 1.0
 *   medium weight 1.0–2.0
 *   hard   weight > 2.0
 */
function getDifficulty(weight = 1.0) {
  if (weight < 1.0) return 'easy'
  if (weight <= 2.0) return 'medium'
  return 'hard'
}

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Easy',   color: '#059669', bg: '#D1FAE5', dot: '🟢' },
  medium: { label: 'Medium', color: '#B45309', bg: '#FEF3C7', dot: '🟡' },
  hard:   { label: 'Hard',   color: '#DC2626', bg: '#FEE2E2', dot: '🔴' },
}

/** Small pill shown on the flashcard corners */
function DifficultyBadge({ weight, position = 'front' }) {
  const tier   = getDifficulty(weight)
  const config = DIFFICULTY_CONFIG[tier]
  const isBack = position === 'back'

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 'var(--r-full)',
        background: isBack ? config.bg : 'rgba(255,255,255,0.18)',
        border: isBack ? `1px solid ${config.color}33` : '1px solid rgba(255,255,255,0.3)',
        backdropFilter: 'blur(4px)',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: isBack ? config.color : 'rgba(255,255,255,0.95)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        transition: 'all 0.3s ease',
        userSelect: 'none',
      }}
      title={`Difficulty weight: ${weight?.toFixed(2)}`}
    >
      <span style={{ fontSize: '0.65rem' }}>{config.dot}</span>
      {config.label}
    </div>
  )
}

/** Weight change animation (shown briefly after answering) */
function WeightChangePill({ delta, visible }) {
  if (!visible) return null
  const isPositive = delta > 0
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 120,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 20px',
        borderRadius: 'var(--r-full)',
        background: isPositive ? '#FEE2E2' : '#D1FAE5',
        color: isPositive ? '#DC2626' : '#059669',
        fontWeight: 700,
        fontSize: '0.875rem',
        boxShadow: 'var(--shadow-lg)',
        animation: 'fadeUpOut 1.2s ease forwards',
        zIndex: 200,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {isPositive ? `🔺 Difficulty +${delta.toFixed(1)}` : `🔻 Difficulty −${Math.abs(delta).toFixed(1)}`}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const { setId } = useParams()
  const navigate  = useNavigate()

  const [flashcardSet, setFlashcardSet] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')

  // Per-session card state
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [isFlipped, setIsFlipped]         = useState(false)
  const [knownCount, setKnownCount]       = useState(0)
  const [unknownCount, setUnknownCount]   = useState(0)
  const [isDone, setIsDone]               = useState(false)
  const [answering, setAnswering]         = useState(false)

  // Live weight tracking (updates as user answers)
  // Maps card.id → current difficulty_weight for this session
  const [liveWeights, setLiveWeights] = useState({})

  // Weight-change pill animation
  const [weightDelta, setWeightDelta]   = useState(null)
  const [pillVisible, setPillVisible]   = useState(false)

  // ── Load flashcard set ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getFlashcardSet(setId)
        if (!cancelled) {
          setFlashcardSet(res.data)
          // Seed live weights from the backend values
          const initial = {}
          for (const c of res.data.cards ?? []) {
            initial[c.id] = c.difficulty_weight ?? 1.0
          }
          setLiveWeights(initial)
        }
      } catch {
        if (!cancelled) setError('Could not load this flashcard set. It may not exist.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [setId])

  const cards   = flashcardSet?.cards ?? []
  const current = cards[currentIndex]

  // Current live weight for the card being shown
  const currentWeight = current ? (liveWeights[current.id] ?? current.difficulty_weight ?? 1.0) : 1.0

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleFlip = useCallback(() => setIsFlipped((f) => !f), [])

  const handleAnswer = useCallback(async (known) => {
    if (answering || !current) return
    setAnswering(true)

    const oldWeight = liveWeights[current.id] ?? current.difficulty_weight ?? 1.0
    const delta     = known ? -0.1 : 0.3

    // Optimistically update local weight
    const newWeight = known
      ? Math.max(0.1, parseFloat((oldWeight - 0.1).toFixed(4)))
      : Math.min(3.0, parseFloat((oldWeight + 0.3).toFixed(4)))

    setLiveWeights((prev) => ({ ...prev, [current.id]: newWeight }))

    // Show weight-change pill
    setWeightDelta(delta)
    setPillVisible(true)
    setTimeout(() => setPillVisible(false), 1200)

    // Fire-and-forget API call (non-blocking)
    updateReviewStatus(setId, { card_id: current.id, known })
      .then((res) => {
        // Sync with server's authoritative weight if available
        const serverWeight = res?.data?.new_weight
        if (serverWeight !== undefined) {
          setLiveWeights((prev) => ({ ...prev, [current.id]: serverWeight }))
        }
      })
      .catch(() => {/* swallow — offline or slow */})

    if (known) setKnownCount((k) => k + 1)
    else       setUnknownCount((u) => u + 1)

    const next = currentIndex + 1
    if (next >= cards.length) {
      setIsDone(true)
    } else {
      setCurrentIndex(next)
      setIsFlipped(false)
    }
    setAnswering(false)
  }, [answering, current, currentIndex, cards.length, liveWeights, setId])

  const restartSession = () => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setKnownCount(0)
    setUnknownCount(0)
    setIsDone(false)
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="spinner-center" style={{ height: 'calc(100vh - 65px)' }}>
          <div className="spinner spinner-blue" style={{ width: 44, height: 44, borderWidth: 3 }} />
        </div>
      </>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <Navbar />
        <main className="page">
          <div className="page-container" style={{ maxWidth: 600 }}>
            <div className="form-error" role="alert">{error}</div>
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>
              ← Back to Dashboard
            </button>
          </div>
        </main>
      </>
    )
  }

  // ── Summary screen ────────────────────────────────────────────────────────────
  if (isDone || cards.length === 0) {
    const total = knownCount + unknownCount
    const pct   = total > 0 ? Math.round((knownCount / total) * 100) : 0

    // Difficulty breakdown from live weights
    const easyCount   = cards.filter((c) => getDifficulty(liveWeights[c.id] ?? c.difficulty_weight) === 'easy').length
    const mediumCount = cards.filter((c) => getDifficulty(liveWeights[c.id] ?? c.difficulty_weight) === 'medium').length
    const hardCount   = cards.filter((c) => getDifficulty(liveWeights[c.id] ?? c.difficulty_weight) === 'hard').length

    let emoji = '💪'
    if (pct >= 80) emoji = '🏆'
    else if (pct >= 50) emoji = '🎉'

    return (
      <>
        <Navbar />
        <div className="review-page">
          <div className="review-container">
            <div className="summary-card">
              <div className="summary-icon">{emoji}</div>
              <h1 className="summary-title">Session Complete!</h1>
              <p className="summary-desc">
                You reviewed <strong>{total}</strong> card{total !== 1 ? 's' : ''} from{' '}
                <strong>&ldquo;{flashcardSet?.title}&rdquo;</strong>
              </p>

              {/* Primary stats: Known vs Not Known */}
              <div className="summary-stats">
                <div className="summary-stat summary-stat-known">
                  <span className="summary-stat-num">{knownCount}</span>
                  <span className="summary-stat-label">✅ Known</span>
                </div>
                <div className="summary-stat summary-stat-unknown">
                  <span className="summary-stat-num">{unknownCount}</span>
                  <span className="summary-stat-label">🔄 Need Practice</span>
                </div>
              </div>

              {/* Mastery bar */}
              <div style={{ maxWidth: 400, margin: '0 auto 1.5rem' }}>
                <ProgressBar current={knownCount} total={total} label="Session Score" />
                <p style={{ textAlign: 'center', marginTop: 6, color: 'var(--gray-500)', fontSize: '0.875rem' }}>
                  <strong>{pct}%</strong> known this session
                </p>
              </div>

              {/* Difficulty breakdown */}
              <div style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--r-xl)',
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
              }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--gray-600)', marginBottom: 10 }}>
                  📊 Card Difficulty After This Session
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <DifficultyRow dot="🟢" label="Easy" count={easyCount} total={cards.length} color="#059669" />
                  <DifficultyRow dot="🟡" label="Medium" count={mediumCount} total={cards.length} color="#B45309" />
                  <DifficultyRow dot="🔴" label="Hard" count={hardCount} total={cards.length} color="#DC2626" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button id="restart-btn" className="btn btn-primary btn-lg" onClick={restartSession}>
                  🔄 Review Again
                </button>
                <button id="back-dashboard-btn" className="btn btn-secondary btn-lg" onClick={() => navigate('/dashboard')}>
                  ← Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Active Review ─────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />

      {/* Weight-change animation pill */}
      <WeightChangePill delta={weightDelta} visible={pillVisible} />

      <div className="review-page">
        <div className="review-container">

          {/* Header */}
          <header className="review-header">
            <h1 className="review-title">{flashcardSet?.title}</h1>
            <p className="review-subtitle">Card {currentIndex + 1} of {cards.length}</p>
          </header>

          {/* Progress */}
          <ProgressBar current={currentIndex} total={cards.length} label="Progress" />

          {/* 3D Flashcard */}
          <div
            className="flashcard-scene"
            onClick={handleFlip}
            role="button"
            tabIndex={0}
            aria-label={isFlipped ? 'Showing answer — click to flip back' : 'Showing question — click to reveal answer'}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFlip() }}
          >
            <div className={`flashcard-wrapper${isFlipped ? ' flipped' : ''}`}>
              {/* Front — Question */}
              <div className="flashcard-face flashcard-front">
                <DifficultyBadge weight={currentWeight} position="front" />
                <div className="flashcard-label">Question</div>
                <div className="flashcard-text">{current?.question}</div>
                <div className="flashcard-hint">Click to reveal answer</div>
              </div>
              {/* Back — Answer */}
              <div className="flashcard-face flashcard-back">
                <DifficultyBadge weight={currentWeight} position="back" />
                <div className="flashcard-label">Answer</div>
                <div className="flashcard-text">{current?.answer}</div>
                <div className="flashcard-hint">How well did you know this?</div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          {!isFlipped ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button id="flip-btn" className="btn btn-primary btn-lg" onClick={handleFlip} style={{ minWidth: 180 }}>
                🔄 Flip Card
              </button>
            </div>
          ) : (
            <div className="review-actions">
              <button
                id="need-practice-btn"
                className="btn btn-danger btn-lg"
                onClick={() => handleAnswer(false)}
                disabled={answering}
                style={{ flex: 1 }}
              >
                😅 Need More Practice
              </button>
              <button
                id="i-know-this-btn"
                className="btn btn-success btn-lg"
                onClick={() => handleAnswer(true)}
                disabled={answering}
                style={{ flex: 1 }}
              >
                ✅ I Know This!
              </button>
            </div>
          )}

          {/* Running score + difficulty legend */}
          <div className="score-chips">
            <span className="score-chip score-chip-known">✅ {knownCount} Known</span>
            <span className="score-chip score-chip-unknown">🔄 {unknownCount} Need Practice</span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            marginTop: 10,
            fontSize: '0.75rem',
            color: 'var(--gray-400)',
          }}>
            <span>🟢 Easy (w&lt;1)</span>
            <span>🟡 Medium (w 1–2)</span>
            <span>🔴 Hard (w&gt;2)</span>
          </div>

        </div>
      </div>
    </>
  )
}

/** Compact row used inside the summary difficulty breakdown */
function DifficultyRow({ dot, label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ flex: '1 1 120px', minWidth: 100 }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color, marginBottom: 4 }}>
        {dot} {label} — {count} card{count !== 1 ? 's' : ''}
      </div>
      <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 'var(--r-full)',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
