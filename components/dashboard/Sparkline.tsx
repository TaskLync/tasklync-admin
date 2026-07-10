// components/dashboard/Sparkline.tsx
'use client'

interface SparklineProps {
  data: number[]
  positive: boolean
}

export function Sparkline({ data, positive }: SparklineProps) {
  if (!data.length) return null

  const width = 64
  const height = 24
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.5}
        className={positive ? 'stroke-[#16A34A]' : 'stroke-[#DC2626]'}
      />
    </svg>
  )
}