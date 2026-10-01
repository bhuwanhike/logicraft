/**
 * The lightweight frame that ships with the HTML.
 *
 * It is what the visitor sees while the 3D bundle is still downloading, so it is
 * deliberately a *frame of the film* rather than a spinner: the same road, the
 * same four disconnected panels, the same cool grade. When WebGL takes over the
 * poster cross-fades out and the scene starts in exactly the same place, so the
 * swap is invisible.
 */
export function PosterFrame({ hidden = false }) {
  return (
    <div className={`hero-poster ${hidden ? 'hero-poster-gone' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="poster-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#080e1c" />
            <stop offset="58%" stopColor="#101c33" />
            <stop offset="100%" stopColor="#0b1220" />
          </linearGradient>
          <linearGradient id="poster-haze" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="poster-road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2333" />
            <stop offset="100%" stopColor="#080d15" />
          </linearGradient>
        </defs>

        <rect width="1200" height="700" fill="url(#poster-sky)" />
        <rect width="1200" height="700" fill="url(#poster-haze)" />

        {/* Skyline */}
        <g fill="#0a1020">
          {Array.from({ length: 34 }).map((_, i) => {
            const h = 60 + ((i * 71) % 210);
            return <rect key={i} x={i * 36 - 20} y={470 - h} width="25" height={h} rx="2" />;
          })}
        </g>
        <g fill="#1b2b4a" opacity="0.55">
          {Array.from({ length: 120 }).map((_, i) => (
            <rect
              key={i}
              x={(i * 83) % 1160}
              y={300 + ((i * 137) % 150)}
              width="4"
              height="6"
              rx="1"
            />
          ))}
        </g>

        {/* Four disconnected panels */}
        {[
          { x: 300, y: 108, w: 216, h: 104, label: 'Fleet Tracker' },
          { x: 552, y: 74, w: 216, h: 104, label: 'Warehouse System' },
          { x: 800, y: 116, w: 216, h: 104, label: 'Ticketing Tool' },
          { x: 1010, y: 82, w: 180, h: 100, label: 'Spreadsheets' }
        ].map((p, i) => (
          <g key={p.label} opacity={0.9 - i * 0.06} style={{ transformOrigin: `${p.x + p.w / 2}px ${p.y + p.h / 2}px` }}>
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx="10"
              fill="rgba(26,42,68,0.55)"
              stroke="#4a5f7d"
              strokeWidth="1.5"
            />
            <rect x={p.x} y={p.y} width={p.w} height="28" rx="10" fill="rgba(124,147,180,0.14)" />
            <text
              x={p.x + 16}
              y={p.y + 20}
              fill="#b9cdea"
              fontSize="15"
              fontWeight="700"
              fontFamily="Manrope, sans-serif"
            >
              {p.label}
            </text>
            <circle cx={p.x + p.w - 20} cy={p.y + 14} r="5" fill="#f2a93b" opacity="0.7" />
            <rect x={p.x + 16} y={p.y + 46} width={p.w - 90} height="7" rx="3.5" fill="rgba(160,185,220,0.22)" />
            <rect x={p.x + 16} y={p.y + 62} width={p.w - 120} height="7" rx="3.5" fill="rgba(160,185,220,0.14)" />
            <rect x={p.x + 16} y={p.y + 78} width={p.w - 70} height="7" rx="3.5" fill="rgba(160,185,220,0.18)" />
            <rect x={p.x} y={p.y + p.h + 4} width={p.w * 0.2} height="3" rx="1.5" fill="#3b82f6" opacity="0.6" />
          </g>
        ))}

        {/* Road */}
        <rect x="0" y="470" width="1200" height="46" fill="url(#poster-road)" />
        <rect x="0" y="470" width="1200" height="2" fill="rgba(150,180,225,0.22)" />
        {Array.from({ length: 20 }).map((_, i) => (
          <rect key={i} x={i * 62 + 8} y="491" width="32" height="4" rx="2" fill="rgba(240,198,96,0.35)" />
        ))}

        {/* Truck, mid-route */}
        <g transform="translate(636 398)">
          <circle cx="30" cy="72" r="17" fill="#0b1018" stroke="#7d8ea3" strokeWidth="3" />
          <circle cx="86" cy="72" r="17" fill="#0b1018" stroke="#7d8ea3" strokeWidth="3" />
          <rect x="6" y="20" width="46" height="52" rx="5" fill="#2563eb" />
          <rect x="52" y="0" width="96" height="72" rx="6" fill="#e8eef6" />
          <rect x="62" y="18" width="76" height="13" rx="3" fill="#2563eb" />
          <rect x="62" y="38" width="46" height="8" rx="3" fill="rgba(15,28,48,0.35)" />
          <rect x="62" y="52" width="60" height="6" rx="3" fill="rgba(59,130,246,0.5)" />
          <circle cx="16" cy="44" r="5" fill="#eaf3ff" />
        </g>

        {/* Signal ping already radiating — the "detection" read, held as a still */}
        <circle cx="800" cy="430" r="120" fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.22" />
        <circle cx="800" cy="430" r="76" fill="none" stroke="#60a5fa" strokeWidth="2.5" opacity="0.34" />
        <circle cx="800" cy="430" r="38" fill="#60a5fa" opacity="0.16" />

        {/* Desk glow on the right */}
        <g opacity="0.85">
          <rect x="960" y="392" width="180" height="118" rx="8" fill="#0b1220" stroke="#2b3646" strokeWidth="2" />
          <rect x="972" y="404" width="156" height="94" rx="4" fill="#0d1728" />
          <rect x="972" y="404" width="156" height="10" fill="#111c30" />
          <rect x="980" y="422" width="84" height="42" rx="3" fill="rgba(255,255,255,0.05)" />
          <path d="M 986 458 L 1010 448 L 1032 442 L 1058 428" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeDasharray="4 4" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={1072 + i * 19} y="422" width="15" height="20" rx="3" fill="rgba(59,130,246,0.28)" />
          ))}
          <rect x="1072" y="448" width="53" height="20" rx="3" fill="rgba(255,255,255,0.05)" />
          <rect x="1072" y="472" width="53" height="26" rx="3" fill="rgba(255,255,255,0.05)" />
          <rect x="1000" y="510" width="100" height="6" rx="3" fill="#2b3646" />
        </g>
      </svg>
      <div className="hero-poster-badge">
        <span className="hero-poster-dot" />
        Loading control tower
      </div>
    </div>
  );
}
