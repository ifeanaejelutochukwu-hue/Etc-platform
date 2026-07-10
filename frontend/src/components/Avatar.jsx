/**
 * Avatar — shows initials with a consistent colour derived from the username.
 */

const COLOURS = [
  '#7c6aff', '#e056fd', '#ff6b81', '#ffa502',
  '#2ed573', '#1e90ff', '#ff4757', '#eccc68',
];

function colourFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return COLOURS[Math.abs(h) % COLOURS.length];
}

export default function Avatar({ name = '', size = 36, style = {} }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

  const bg = colourFor(name);

  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: '#fff',
        userSelect: 'none',
        ...style,
      }}
    >
      {initials}
    </div>
  );
}
