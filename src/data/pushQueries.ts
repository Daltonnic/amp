import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  disablePush,
  enablePush,
  pushOptions,
  pushState,
  pushSupport,
  setPushOptions,
  type PushOptions,
  type PushState,
} from '@/lib/push'
import { useMyUserId } from './groupQueries'

export const pushKeys = {
  state: (userId: string | null) => ['push', 'state', userId] as const,
  options: (userId: string | null) => ['push', 'options', userId] as const,
}

/** Push notifications on this device: whether they're available, on, and the controls. */
export function usePush() {
  const me = useMyUserId()
  const qc = useQueryClient()
  const [support] = useState(pushSupport)
  const available = support === 'web' || support === 'native'

  const state = useQuery({
    queryKey: pushKeys.state(me),
    queryFn: () => pushState(me),
    enabled: available && Boolean(me),
  })
  const options = useQuery({
    queryKey: pushKeys.options(me),
    queryFn: pushOptions,
    enabled: state.data === 'on',
  })

  const enable = useMutation({
    /** Pass requestPushPermission(), called during the tap. */
    mutationFn: (permission?: Promise<NotificationPermission>) => enablePush({}, permission),
    onSuccess: (s: PushState) => qc.setQueryData(pushKeys.state(me), s),
  })
  const disable = useMutation({
    mutationFn: disablePush,
    onSuccess: () => qc.setQueryData<PushState>(pushKeys.state(me), 'off'),
  })
  const changeOptions = useMutation({
    mutationFn: setPushOptions,
    onMutate: (patch: Partial<PushOptions>) => {
      const previous = qc.getQueryData<PushOptions>(pushKeys.options(me))
      if (previous) qc.setQueryData(pushKeys.options(me), { ...previous, ...patch })
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(pushKeys.options(me), ctx?.previous),
  })

  return {
    support,
    available,
    state: state.data,
    options: options.data ?? { showPreview: false, messages: true, meetings: true },
    enable,
    disable,
    changeOptions,
    busy: enable.isPending || disable.isPending,
  }
}
