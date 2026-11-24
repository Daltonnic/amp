import { useState } from 'react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { NameFields, namePartsOf, profileNamePatch } from '@/components/NameFields'
import { Button } from '@/components/ui/button'
import { useUpdateProfile } from '@/data/queries'
import type { Profile } from '@/data/types'
import { isNameComplete } from '@/lib/names'
import { hapticSuccess } from '@/lib/native'
import { errorMessage } from '@/lib/utils'

/**
 * Shown instead of the app to anyone whose profile has no name yet (people
 * who set up before a name was required). There's no way past it without one.
 */
export function NameRequired({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [name, setName] = useState(() => namePartsOf(profile))
  const ready = isNameComplete(name)

  return (
    <div className="flex min-h-dvh flex-col pt-safe pb-safe">
      <div className="mx-auto w-full max-w-lg flex-1 space-y-6 px-6 py-8">
        <BrandMark className="h-10 w-auto" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">What's your name?</h1>
          <p className="mt-2 text-muted-foreground">
            Please add your name to keep using AMP. Your first name is required, and you choose how it shows
            to others.
          </p>
        </div>
        <NameFields value={name} onChange={setName} />
        <Button
          size="lg"
          className="w-full"
          disabled={!ready || update.isPending}
          onClick={() =>
            update.mutate(
              { id: profile.id, patch: profileNamePatch(name) },
              {
                onSuccess: () => {
                  hapticSuccess()
                  toast.success('Thank you. Welcome back.')
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            )
          }
        >
          {update.isPending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
