import React from 'react';
import './GasGauge.css';

const R    = 40;
const CIRC = 2 * Math.PI * R; // ≈ 251.33

/**
 * Convert a raw gas reading to a 0–1 fill fraction where
 * 0 = perfectly safe and 1 = deep danger zone.
 */
function toFill(gas, value) {
  switch (gas) {
    case 'H2S':   return Math.min(1, Math.max(0, value / 15));        // danger > 10, cap at 15
    case 'CO':    return Math.min(1, Math.max(0, value / 300));       // danger > 200, cap at 300
    case 'O2':    return Math.min(1, Math.max(0, (21.0 - value) / (21.0 - 14.0))); // lower O2 = worse
    case 'CH4':   return Math.min(1, Math.max(0, value / 40));        // danger > 25, cap at 40
    case 'WATER': return Math.min(1, Math.max(0, value / 50));        // danger > 30 cm, cap at 50
    default:      return 0;
  }
}

const GAS_LABELS = { H2S: 'H₂S', CO: 'CO', O2: 'O₂', CH4: 'CH₄', WATER: 'Water' };

/**
 * Compact circular SVG arc gauge.
 *
 * Props:
 *   gas    — 'H2S' | 'CO' | 'O2' | 'CH4'
 *   value  — numeric reading (number | null)
 *   unit   — display unit string e.g. 'ppm', '%', '% LEL'
 *   status — 'safe' | 'warning' | 'danger'
 */
export default function GasGauge({ gas, value, unit, status }) {
  const fill   = value != null ? toFill(gas, value) : 0;
  const offset = CIRC * (1 - fill);
  const label  = GAS_LABELS[gas] ?? gas;

  const isLoading = value == null;

  return (
    <div className={`gg-card gg-${status ?? 'safe'}${isLoading ? ' gg-loading' : ''}`}>
      <svg
        className="gg-svg"
        viewBox="0 0 100 100"
        width="90"
        height="90"
        aria-label={`${label}: ${value ?? '…'} ${unit}`}
      >
        {/* Background track */}
        <circle
          cx="50" cy="50" r={R}
          className="gg-track"
          strokeWidth="8"
          fill="none"
        />
        {/* Value arc */}
        <circle
          cx="50" cy="50" r={R}
          className={`gg-arc gg-arc-${status ?? 'safe'}`}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={isLoading ? CIRC : offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.4s ease' }}
        />
        {/* Centre value */}
        <text
          x="50" y="46"
          className="gg-val"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {isLoading ? '—' : (value < 10 ? value.toFixed(1) : Math.round(value))}
        </text>
        {/* Unit label below value */}
        <text
          x="50" y="62"
          className="gg-unit"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {isLoading ? '' : unit}
        </text>
      </svg>

      <span className="gg-name">{label}</span>
    </div>
  );
}
