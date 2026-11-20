import { Link } from 'react-router'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { paths } from '@/app/routes'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center pt-safe pb-safe">
      <BrandMark className="size-14" />
      <h1 className="font-display text-xl font-semibold">This page wandered off</h1>
      <p className="text-sm text-muted-foreground">Let's get you back on the journey.</p>
      <Button asChild>
        <Link to={paths.home} replace>
          Go home
        </Link>
      </Button>
    </div>
  )
}
