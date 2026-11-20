import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { hapticTap } from '@/lib/native'

const THRESHOLD = 68

/** Find the element that actually scrolls (the app shell's scroll container). */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return document.scrollingElement as HTMLElement | null
}

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>
  children: ReactNode
}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const crossed = useRef(false)

  const onTouchStart = (e: TouchEvent) => {
    const scroller = scrollParent(root.current)
    if (!scroller || scroller.scrollTop <= 0) startY.current = e.touches[0]?.clientY ?? null
  }
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null || refreshing) return
    const delta = (e.touches[0]?.clientY ?? 0) - startY.current
    if (delta > 0) {
      const next = Math.min(delta * 0.42, THRESHOLD + 14)
      if (next >= THRESHOLD && !crossed.current) {
        crossed.current = true
        hapticTap()
      }
      setPull(next)
    }
  }
  const onTouchEnd = async () => {
    startY.current = null
    crossed.current = false
    if (pull >= THRESHOLD) {
      setRefreshing(true)
      setPull(0)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    } else {
      setPull(0)
    }
  }

  const height = refreshing ? 46 : pull
  const progress = Math.min(pull / THRESHOLD, 1)
  return (
    <div ref={root} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height }}
        aria-hidden={!refreshing}
      >
        <RefreshCw
          className={`size-4 text-primary ${refreshing ? 'animate-spin' : ''}`}
          style={{
            opacity: refreshing ? 1 : progress,
            transform: refreshing ? undefined : `rotate(${progress * 200}deg)`,
          }}
          aria-label={refreshing ? 'Refreshing' : undefined}
        />
      </div>
      {children}
    </div>
  )
}
