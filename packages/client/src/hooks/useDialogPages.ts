import { useCallback, useState } from 'react'

/** A page a dialog can go into: it names itself, and the title bar shows that name next to the back button. */
export interface DialogPage {
  title: string
}

/**
 * The pages a dialog has been taken into, beyond its own first page. `current` is the last one (or `null` on the first
 * page): the dialog shows it in place of its own content, and `back` returns one level. The pages themselves are
 * standalone views (a playlist, an artist); the dialog is only the container that holds them.
 */
export function useDialogPages<P extends DialogPage>() {
  const [stack, setStack] = useState<P[]>([])
  const open = useCallback((page: P) => setStack((pages) => [...pages, page]), [])
  const back = useCallback(() => setStack((pages) => pages.slice(0, -1)), [])
  const reset = useCallback(() => setStack((pages) => (pages.length === 0 ? pages : [])), [])
  return { current: stack.length > 0 ? stack[stack.length - 1] : null, depth: stack.length, open, back, reset }
}

export type DialogPages<P extends DialogPage> = ReturnType<typeof useDialogPages<P>>
