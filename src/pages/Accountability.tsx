import { useState, type ComponentProps, type FormEvent } from 'react'
import { Mail, MessageSquare, Phone, Plus, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, PageHeader, Screen } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label, Skeleton } from '@/components/ui/controls'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useContacts, useCreateContact, useDeleteContact, useProfile } from '@/data/queries'
import type { AccountabilityContact, AccountabilityContactInput } from '@/data/types'
import { hapticSuccess } from '@/lib/native'
import { contactSupport } from '@/lib/support'
import { errorMessage } from '@/lib/utils'

const EMPTY: AccountabilityContactInput = { name: '', email: '', phone: '', relationship: '' }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function Accountability() {
  const contacts = useContacts()
  const list = contacts.data ?? []

  return (
    <Screen>
      <PageHeader
        title="Accountability"
        subtitle="Trusted people in your corner."
        action={<AddContactDialog />}
      />
      {contacts.isPending ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : list.length === 0 ? (
        <EmptyState icon={<UserPlus className="size-8" aria-hidden="true" />}>
          <p>No contacts yet. Add someone you trust.</p>
          <p className="mt-1 text-xs">Healing happens in honest community.</p>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((contact) => (
            <li key={contact.id}>
              <ContactCard contact={contact} />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}

function AddContactDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<AccountabilityContactInput>(EMPTY)
  const create = useCreateContact()
  const emailInvalid = form.email.trim() !== '' && !EMAIL_RE.test(form.email.trim())

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || emailInvalid) return
    create.mutate(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        relationship: form.relationship.trim(),
      },
      { onError: (err) => toast.error(errorMessage(err)) },
    )
    setOpen(false)
    setForm(EMPTY)
  }

  const field = (
    key: keyof AccountabilityContactInput,
    label: string,
    props: ComponentProps<typeof Input>,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`c-${key}`}>{label}</Label>
      <Input
        id={`c-${key}`}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden="true" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Trusted Contact</DialogTitle>
          <DialogDescription>
            Someone who can pray with you, check on you, and hold the line with love.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {field('name', 'Name', {
            placeholder: 'Their name',
            autoComplete: 'off',
            required: true,
            maxLength: 120,
          })}
          {field('email', 'Email', {
            type: 'email',
            inputMode: 'email',
            placeholder: 'email@example.com',
            autoCapitalize: 'none',
            maxLength: 254,
            'aria-invalid': emailInvalid,
          })}
          {emailInvalid && <p className="-mt-2 text-xs text-destructive">Enter a valid email address.</p>}
          {field('phone', 'Phone (optional)', {
            type: 'tel',
            inputMode: 'tel',
            placeholder: 'Phone number',
            maxLength: 40,
          })}
          {field('relationship', 'Relationship', { placeholder: 'Pastor, friend, mentor...', maxLength: 80 })}
          <Button type="submit" disabled={!form.name.trim() || emailInvalid} className="w-full">
            <UserPlus aria-hidden="true" /> Add Contact
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ContactCard({ contact }: { contact: AccountabilityContact }) {
  const profile = useProfile()
  const remove = useDeleteContact()
  const [sending, setSending] = useState(false)
  const pending = contact.id.startsWith('temp-')

  const requestCheckIn = async () => {
    if (!contact.email) {
      toast.error('No email on file for this contact.')
      return
    }
    setSending(true)
    try {
      const result = await contactSupport({
        contact,
        kind: 'check_in_request',
        senderName: profile.data?.display_name,
      })
      if (result === 'sent') {
        hapticSuccess()
        toast.success(`Check-in request sent to ${contact.name}`)
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{contact.name}</p>
          {contact.relationship && (
            <p className="mt-0.5 text-xs text-muted-foreground">{contact.relationship}</p>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={pending}
              aria-label={`Remove ${contact.name}`}
              className="-mr-2 -mt-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Remove {contact.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be notified. You can add them again anytime.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction destructive onClick={() => remove.mutate(contact.id)}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={pending || sending}
          onClick={() => void requestCheckIn()}
        >
          <Mail className="size-3.5" aria-hidden="true" /> {sending ? 'Sending…' : 'Request Check-In'}
        </Button>
        {contact.phone && (
          <>
            <Button size="sm" variant="outline" asChild>
              <a href={`sms:${contact.phone}`} aria-label={`Text ${contact.name}`}>
                <MessageSquare className="size-3.5" aria-hidden="true" /> Text
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`}>
                <Phone className="size-3.5" aria-hidden="true" /> Call
              </a>
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
