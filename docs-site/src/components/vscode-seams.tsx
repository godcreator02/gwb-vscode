'use client';

import { useState } from 'react';
import { modules, seams } from './vscode-seams.data.mjs';

const INK = '#1b1b1b';
const PAPER = '#fbf6e9';

type Module = (typeof modules)[number] & { disk?: boolean };

function ModuleBox({ module }: { module: Module }) {
  const { x, y, w, h, title, lines, color, disk } = module;
  return (
    <g>
      <rect x={x + 5} y={y + 5} width={w} height={h} fill={INK} rx={disk ? 14 : 4} />
      <rect x={x} y={y} width={w} height={h} fill={color} stroke={INK} strokeWidth={2.5} rx={disk ? 14 : 4} strokeDasharray={disk ? '7 5' : undefined} />
      <text x={x + 12} y={y + 24} fontSize={15} fontWeight={800} fill={INK}>
        {title}
      </text>
      {lines.map((line, index) => (
        <text key={line} x={x + 12} y={y + 46 + index * 19} fontSize={13} fill={INK}>
          {line}
        </text>
      ))}
    </g>
  );
}

export function VscodeSeams() {
  const [active, setActive] = useState(4);
  const current = seams.find((s) => s.n === active)!;
  return (
    <div style={{ background: PAPER, border: `3px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, borderRadius: 6, padding: 16, margin: '24px 0' }}>
      <svg viewBox="0 0 840 480" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="gwb-vscode 接缝图">
        <defs>
          <marker id="vscode-seam-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={INK} />
          </marker>
        </defs>
        {modules.map((m) => (
          <ModuleBox key={m.id} module={m} />
        ))}
        {seams.map((s) => {
          const isActive = s.n === active;
          return (
            <g key={s.n} onClick={() => setActive(s.n)} style={{ cursor: 'pointer' }}>
              <line
                x1={s.from[0]}
                y1={s.from[1]}
                x2={s.to[0]}
                y2={s.to[1]}
                stroke={isActive ? '#e4002b' : INK}
                strokeWidth={isActive ? 4 : 2.5}
                strokeDasharray={s.kind === 'disk' ? '8 6' : undefined}
                markerEnd="url(#vscode-seam-arrow)"
              />
              <line x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]} stroke="transparent" strokeWidth={18} />
              <circle cx={s.label[0]} cy={s.label[1]} r={13} fill={isActive ? '#e4002b' : '#fff'} stroke={INK} strokeWidth={2.5} />
              <text x={s.label[0]} y={s.label[1] + 5} textAnchor="middle" fontSize={14} fontWeight={800} fill={isActive ? '#fff' : INK}>
                {s.n}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {seams.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setActive(s.n)}
            style={{
              border: `2px solid ${INK}`,
              borderRadius: 4,
              padding: '2px 10px',
              fontSize: 13,
              fontWeight: 700,
              background: s.n === active ? '#e4002b' : '#fff',
              color: s.n === active ? '#fff' : INK,
              cursor: 'pointer',
            }}
          >
            {s.n} {s.title}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12, background: '#fff', border: `2.5px solid ${INK}`, borderRadius: 4, padding: '10px 14px', color: INK }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>
          {current.n} · {current.title}
          <span style={{ fontWeight: 500, fontSize: 12, marginLeft: 8 }}>{current.kind === 'disk' ? '虚线：读写磁盘' : '实线：调用'}</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{current.text}</div>
      </div>
    </div>
  );
}
