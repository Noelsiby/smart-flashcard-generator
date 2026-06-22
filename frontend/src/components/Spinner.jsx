/**
 * Spinner component
 * @param {number}  size   - diameter in px (default 20)
 * @param {'white'|'blue'} color - spinner colour variant
 */
export default function Spinner({ size = 20, color = 'white' }) {
  return (
    <span
      className={`spinner${color === 'blue' ? ' spinner-blue' : ''}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}
