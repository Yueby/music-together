/**
 * The platform runs a mini-app in a sandboxed frame without `allow-forms`. The browser then refuses every
 * native form submission *before* a `submit` event exists, so React `onSubmit` handlers never run and
 * dialogs built on `<form>` (create room, nickname, password…) silently do nothing.
 *
 * This turns a blocked submission into a plain `submit` event on the same form. Nothing navigates: the
 * event only reaches the application's own handlers, which already call `preventDefault()`.
 */

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])
const SUBMIT_BUTTONS = 'button:not([type]), button[type="submit"], input[type="submit"], input[type="image"]'

function isSubmitControl(element: Element): element is HTMLButtonElement | HTMLInputElement {
  if (element instanceof HTMLButtonElement) return element.type === 'submit'
  return element instanceof HTMLInputElement && (element.type === 'submit' || element.type === 'image')
}

function submit(form: HTMLFormElement, submitter: HTMLElement | null): void {
  if (!form.noValidate && !form.reportValidity()) return
  const init = { bubbles: true, cancelable: true }
  form.dispatchEvent(
    typeof SubmitEvent === 'function' ? new SubmitEvent('submit', { ...init, submitter }) : new Event('submit', init),
  )
}

/** Returns a function that removes the listeners. */
export function installFormSubmitFallback(target: Document = document): () => void {
  const onClick = (event: MouseEvent) => {
    const control = event.target instanceof Element ? event.target.closest('button, input') : null
    if (!control || !isSubmitControl(control) || control.disabled || !control.form) return
    event.preventDefault()
    submit(control.form, control)
  }

  // Implicit submission (Enter in a text field) only needs help when the form has no submit button;
  // otherwise the browser clicks that button, which `onClick` already handles. Never during IME composition.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.isComposing) return
    const input = event.target
    if (!(input instanceof HTMLInputElement) || !TEXT_INPUT_TYPES.has(input.type) || !input.form) return
    if (input.form.querySelector(SUBMIT_BUTTONS)) return
    event.preventDefault()
    submit(input.form, null)
  }

  target.addEventListener('click', onClick, true)
  target.addEventListener('keydown', onKeyDown, true)
  return () => {
    target.removeEventListener('click', onClick, true)
    target.removeEventListener('keydown', onKeyDown, true)
  }
}
