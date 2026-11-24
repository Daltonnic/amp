import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useUpdateProfile } from '@/data/queries'
import type { Gender } from '@/data/types'
import { GENDER_OPTIONS } from '@/lib/audience'
import { hapticSuccess } from '@/lib/native'

/** Asks "man or woman?" of people who set up their account before the question existed. */
export function AboutYouPrompt({
  profileId,
  title = 'One quick question',
  description = 'Are you a man or a woman? This helps us choose the right words and pictures for you.',
}: {
  profileId: string
  title?: string
  description?: string
}) {
  const update = useUpdateProfile()
  const choose = (gender: Gender) =>
    update.mutate(
      { id: profileId, patch: { gender } },
      {
        onSuccess: () => hapticSuccess(),
        onError: () => toast.error('That didn’t save. Please try again.'),
      },
    )
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {GENDER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant="outline"
            disabled={update.isPending}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </Card>
  )
}
