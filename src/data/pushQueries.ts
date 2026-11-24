import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  disablePush,
  enablePush,
  previewEnabled,
  pushState,
  pushSupport,
  setPreview,
  type PushState,
} from '@/lib/push'
import { useMyUserId } from './groupQueries'

export const pushKeys = {
  state: (userId: string | null) => ['push', 'state', userId] as const,
  preview: (userId: string | null) => ['push', 'preview', userId] as const,
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
  const preview = useQuery({
    queryKey: pushKeys.preview(me),
    queryFn: previewEnabled,
    enabled: state.data === 'on',
  })

  const enable = useMutation({
    /** Pass requestPushPermission(), called during the tap. */
    mutationFn: (permission?: Promise<NotificationPermission>) =>
      enablePush(preview.data ?? false, permission),
    onSuccess: (s: PushState) => qc.setQueryData(pushKeys.state(me), s),
  })
  const disable = useMutation({
    mutationFn: disablePush,
    onSuccess: () => qc.setQueryData<PushState>(pushKeys.state(me), 'off'),
  })
  const changePreview = useMutation({
    mutationFn: setPreview,
    onMutate: (show: boolean) => {
      const previous = qc.getQueryData<boolean>(pushKeys.preview(me))
      qc.setQueryData(pushKeys.preview(me), show)
      return { previous }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(pushKeys.preview(me), ctx?.previous),
  })

  return {
    support,
    available,
    state: state.data,
    preview: preview.data ?? false,
    enable,
    disable,
    changePreview,
    busy: enable.isPending || disable.isPending,
  }
}
