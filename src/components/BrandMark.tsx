import { cn } from '@/lib/utils'

/** The AMP flame mark (from the brand guide). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/flame.png"
      alt=""
      aria-hidden="true"
      className={cn('object-contain', className)}
      draggable={false}
    />
  )
}

/** Full logo with the "Apostolic Moral Purity" wordmark; swaps to a light version in dark mode. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/brand/logo.png"
        alt="Apostolic Moral Purity"
        className={cn('object-contain dark:hidden', className)}
        draggable={false}
      />
      <img
        src="/brand/logo-dark.png"
        alt="Apostolic Moral Purity"
        className={cn('hidden object-contain dark:block', className)}
        draggable={false}
      />
    </>
  )
}
