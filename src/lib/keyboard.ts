import { useEffect, useState } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNative } from './native'

/** True while the on-screen keyboard is open (native apps and mobile browsers). */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (isNative) {
      const handles = [
        Keyboard.addListener('keyboardWillShow', () => setOpen(true)),
        Keyboard.addListener('keyboardWillHide', () => setOpen(false)),
      ]
      return () => handles.forEach((h) => void h.then((x) => x.remove()))
    }
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setOpen(vv.height < window.innerHeight * 0.75)
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])
  return open
}
