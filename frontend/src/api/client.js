import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://smart-flashcard-generator.onrender.com',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && err.config.url !== '/auth/login') {
      localStorage.removeItem('fc_token')
      localStorage.removeItem('fc_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ───────────────────────────────────────────────────────
export const signup = (data)  => api.post('/auth/signup', data)
export const login  = (data)  => api.post('/auth/login', data)

// ── Flashcards ─────────────────────────────────────────────────
export const getFlashcardSets  = ()         => api.get('/flashcards')
export const generateFlashcards = (data)    => api.post('/flashcards/generate', data)
export const saveFlashcardSet  = (data)     => api.post('/flashcards/save', data)
export const getFlashcardSet   = (setId)    => api.get(`/flashcards/${setId}`)
export const updateReviewStatus = (setId, data) => api.post(`/flashcards/${setId}/review`, data)

export default api
