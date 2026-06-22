import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateFlashcards, saveFlashcardSet } from '../api/client'
import Navbar from '../components/Navbar'

function countSentences(text) {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0).length
}

// Source badge shown in the preview header
function SourceBadge({ source }) {
  if (!source) return null
  const isAi = source === 'ai'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 'var(--r-full)',
        fontSize: '0.7rem',
        fontWeight: 700,
        background: isAi ? '#D1FAE5' : '#FEF3C7',
        color: isAi ? '#065F46' : '#92400E',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {isAi ? '🤖 AI Generated' : '⚙️ Rule-based'}
    </span>
  )
}

// Animated progress dots shown while the AI model processes
function LoadingMessage({ loading }) {
  if (!loading) return null
  return (
    <div
      style={{
        background: 'var(--blue-50)',
        border: '1px solid var(--blue-200)',
        borderRadius: 'var(--r-lg)',
        padding: '12px 16px',
        marginBottom: 16,
        fontSize: '0.8125rem',
        color: 'var(--blue-700)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⏳</span>
      <div>
        <strong>AI is processing your notes…</strong>
        <br />
        <span style={{ opacity: 0.8 }}>
          The first request loads the NLP models (~900 MB) and may take
          1–3 minutes. Subsequent requests are much faster.
        </span>
      </div>
    </div>
  )
}

export default function GeneratePage() {
  const navigate = useNavigate()
  const [title, setTitle]              = useState('')
  const [text, setText]                = useState('')
  const [loading, setLoading]          = useState(false)
  const [saving, setSaving]            = useState(false)
  const [error, setError]              = useState('')
  const [generatedCards, setGenerated] = useState([])
  const [source, setSource]            = useState(null)   // 'ai' | 'stub'
  const [step, setStep]                = useState('input') // 'input' | 'preview'

  const handleGenerate = async () => {
    if (!title.trim()) { setError('Please give your flashcard set a title.'); return }
    if (text.trim().length < 100) { setError('Please paste at least 100 characters'); return }

    setLoading(true)
    setError('')
    try {
      const res = await generateFlashcards({ text: text.trim(), title: title.trim() })
      setGenerated(res.data.cards)
      setSource(res.data.source ?? null)
      setStep('preview')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate flashcards. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await saveFlashcardSet({ title: title.trim(), cards: generatedCards })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save flashcard set. Please try again.')
      setSaving(false)
    }
  }

  const handleReset = () => {
    setStep('input')
    setGenerated([])
    setSource(null)
    setError('')
  }

  const sentenceCount  = text ? countSentences(text) : 0

  return (
    <>
      <Navbar />
      <main className="page">
        <div className="page-container">

          <div className="page-header">
            <h1 className="page-title">🤖 AI Flashcard Generator</h1>
            <p className="page-subtitle">
              Paste your study notes — our NLP engine extracts key concepts and generates questions automatically
            </p>
          </div>

          <div className="generate-layout">

            {/* ── Input form ── */}
            <div className="generate-form-card">
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="set-title">
                  📌 Flashcard Set Title
                </label>
                <input
                  id="set-title"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Biology Ch.3 — Cell Division"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setError('') }}
                  disabled={step === 'preview'}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label" htmlFor="study-notes">
                  📝 Paste Your Study Notes
                </label>
                <textarea
                  id="study-notes"
                  className="form-input"
                  placeholder={
                    'Paste your study notes here.\n\n' +
                    'The AI engine will:\n' +
                    '  1. Split text into sentences using spaCy\n' +
                    '  2. Detect key entities and concepts (NER)\n' +
                    '  3. Generate a question for each key sentence (T5 model)\n\n' +
                    'Example:\n' +
                    'Photosynthesis is the process by which plants use sunlight to produce food. ' +
                    'Chlorophyll is the green pigment that captures light energy in plant cells.'
                  }
                  value={text}
                  onChange={(e) => { setText(e.target.value); setError('') }}
                  disabled={step === 'preview'}
                  style={{ minHeight: 300 }}
                />
                {text && (
                  <p className="hint-text">
                    {sentenceCount} sentence{sentenceCount !== 1 ? 's' : ''} detected —
                    AI will select the most informative ones
                  </p>
                )}
              </div>

              {/* AI loading notice */}
              <LoadingMessage loading={loading} />

              {error && (
                <div className="form-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>
              )}

              {step === 'input' ? (
                <button
                  id="generate-btn"
                  className="btn btn-primary btn-lg btn-full"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" aria-hidden="true" /> : '🤖'}
                  {loading ? 'AI is generating cards…' : 'Generate with AI'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    id="save-set-btn"
                    className="btn btn-success btn-lg"
                    style={{ flex: 1 }}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <span className="spinner" aria-hidden="true" /> : '💾'}
                    {saving ? 'Saving…' : 'Save Flashcard Set'}
                  </button>
                  <button
                    id="edit-notes-btn"
                    className="btn btn-secondary"
                    onClick={handleReset}
                  >
                    ↩ Edit
                  </button>
                </div>
              )}

              {/* How it works info box */}
              {step === 'input' && !loading && (
                <div style={{
                  marginTop: 20,
                  padding: '14px 16px',
                  background: 'var(--gray-50)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--r-lg)',
                  fontSize: '0.8rem',
                  color: 'var(--gray-500)',
                  lineHeight: 1.6,
                }}>
                  <strong style={{ color: 'var(--gray-700)' }}>How it works:</strong>
                  <br />
                  🧠 <strong>spaCy</strong> segments and extracts named entities (people, places, concepts)
                  <br />
                  🤖 <strong>T5 model</strong> generates a natural-language question for each key sentence
                  <br />
                  📋 The original sentence becomes the answer
                </div>
              )}
            </div>

            {/* ── Preview panel ── */}
            <div className="preview-section">
              <div className="preview-card">
                <div className="preview-header">
                  🃏 Preview
                  {generatedCards.length > 0 && (
                    <span className="badge badge-blue">{generatedCards.length} cards</span>
                  )}
                  <SourceBadge source={source} />
                </div>

                {generatedCards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--gray-400)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🪄</div>
                    <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                      Click <strong>Generate with AI</strong> and your flashcards will appear here — review them before saving.
                    </p>
                    <p style={{ fontSize: '0.75rem', marginTop: 8, color: 'var(--gray-300)' }}>
                      Powered by spaCy NER + HuggingFace T5
                    </p>
                  </div>
                ) : (
                  <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
                    {generatedCards.map((card, i) => (
                      <div key={card.id} className="preview-card-item" style={{ animationDelay: `${i * 40}ms` }}>
                        <p className="preview-card-q">Q{i + 1}: {card.question}</p>
                        <p className="preview-card-a">A: {card.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </>
  )
}
