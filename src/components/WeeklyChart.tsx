import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { WeekDay } from '@/data/queries'

export interface ChartSeries {
  key: 'intensity' | 'temptation' | 'stress'
  name: string
  /** CSS color, e.g. var(--color-primary). */
  color: string
  dashed?: boolean
  area?: boolean
}

const HEIGHT = 150
const PAD = { top: 8, right: 8, bottom: 22, left: 22 }
const MAX = 10
const RISK_LINE = 7

/** Smooth path through points (Catmull-Rom → cubic Bézier, gentle tension). */
function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${points[0]![0]},${points[0]![1]}`
  let d = `M${points[0]![0]},${points[0]![1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2
    const t = 0.18
    const c1x = p1[0] + (p2[0] - p0[0]) * t
    const c1y = p1[1] + (p2[1] - p0[1]) * t
    const c2x = p2[0] - (p3[0] - p1[0]) * t
    const c2y = p2[1] - (p3[1] - p1[1]) * t
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

/**
 * Lightweight 7-day line/area chart (replaces recharts, ~400 KB lighter).
 * Tap a day to see its values. A visually hidden table carries the same data
 * for screen readers.
 */
export function WeeklyChart({ data, series }: { data: WeekDay[]; series: ChartSeries[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const innerW = Math.max(0, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const step = data.length > 1 ? innerW / (data.length - 1) : 0
  const x = (i: number) => PAD.left + i * step
  const y = (v: number) => PAD.top + innerH - (v / MAX) * innerH

  const activeDay = active !== null ? data[active] : undefined

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="Your last 7 days"
        className="overflow-visible"
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {[0, 5, 10].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <text
              x={PAD.left - 6}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              fontSize={10}
              fill="var(--color-muted-foreground)"
            >
              {tick}
            </text>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={y(RISK_LINE)}
          y2={y(RISK_LINE)}
          stroke="var(--color-destructive)"
          strokeOpacity={0.45}
          strokeDasharray="4 4"
        />

        {series.map((s) => {
          const points = data
            .map((d, i) => [i, d[s.key]] as const)
            .filter((p): p is readonly [number, number] => p[1] !== null)
            .map(([i, v]) => [x(i), y(v)] as [number, number])
          if (points.length === 0) return null
          const line = smoothPath(points)
          const area =
            s.area !== false && points.length > 1
              ? `${line} L${points.at(-1)![0]},${y(0)} L${points[0]![0]},${y(0)} Z`
              : null
          return (
            <g key={s.key}>
              {area && <path d={area} fill={`url(#${gradientId}-${s.key})`} />}
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '4 2' : undefined}
                strokeLinecap="round"
              />
              {points.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={s.dashed ? 2 : 3} fill={s.color} />
              ))}
            </g>
          )
        })}

        {data.map((d, i) => (
          <text
            key={d.date}
            x={x(i)}
            y={HEIGHT - 6}
            textAnchor="middle"
            fontSize={10}
            fill={active === i ? 'var(--color-foreground)' : 'var(--color-muted-foreground)'}
            fontWeight={active === i ? 600 : 400}
          >
            {d.day}
          </text>
        ))}

        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="var(--color-border)" />
        )}

        {/* Hit targets: one column per day. */}
        {data.map((d, i) => (
          <rect
            key={d.date}
            x={x(i) - step / 2}
            y={0}
            width={Math.max(step, 24)}
            height={HEIGHT}
            fill="transparent"
            onPointerDown={() => setActive(active === i ? null : i)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
          />
        ))}
      </svg>

      {activeDay && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(x(active!) - 60, 0), Math.max(width - 120, 0)),
          }}
        >
          <p className="mb-1 font-medium text-foreground">{activeDay.day}</p>
          {activeDay.hasData ? (
            series.map((s) => (
              <p key={s.key} style={{ color: s.color }}>
                {s.name}: <span className="font-semibold">{activeDay[s.key] ?? '—'}/10</span>
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">No check-in</p>
          )}
        </div>
      )}

      <table className="sr-only">
        <caption>Check-ins over the last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.day}</th>
              {series.map((s) => (
                <td key={s.key}>{d[s.key] === null ? 'No data' : `${d[s.key]} out of 10`}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
