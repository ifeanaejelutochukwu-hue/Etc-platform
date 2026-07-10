/**
 * IconBtn — a square icon-only button with optional active/danger variants.
 */
export default function IconBtn({ children, onClick, active = false, danger = false, title = '', disabled = false, size = 36, style = {} }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        minWidth: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: active
          ? danger ? 'rgba(239,68,68,0.18)' : 'rgba(124,106,255,0.18)'
          : 'var(--bg-raised)',
        color: active
          ? danger ? 'var(--danger)' : 'var(--brand)'
          : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background var(--transition), color var(--transition)',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
