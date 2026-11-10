// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFormSubmitFallback } from './formSubmitFallback.ts'

let remove: () => void
beforeEach(() => {
  remove = installFormSubmitFallback()
})
afterEach(() => {
  remove()
  document.body.replaceChildren()
})

function mount(html: string) {
  document.body.innerHTML = html
  const form = document.querySelector('form')!
  const onSubmit = vi.fn((event: Event) => event.preventDefault())
  form.addEventListener('submit', onSubmit)
  return { form, onSubmit }
}

describe('installFormSubmitFallback', () => {
  it('turns a click on a submit button into a submit event, including the default (typeless) button', () => {
    for (const markup of [
      '<button type="submit">go</button>',
      '<button>go</button>',
      '<input type="submit" value="go">',
    ]) {
      const { onSubmit } = mount(`<form><input name="a" value="x">${markup}</form>`)
      document.querySelector<HTMLElement>('button, input[type="submit"]')!.click()
      expect(onSubmit).toHaveBeenCalledOnce()
    }
  })

  it('reports the clicked button as the submitter', () => {
    const { onSubmit } = mount('<form><button type="submit" id="send">go</button></form>')
    document.getElementById('send')!.click()
    expect((onSubmit.mock.calls[0][0] as SubmitEvent).submitter?.id).toBe('send')
  })

  it('does not submit for plain buttons, disabled buttons or invalid required fields', () => {
    const plain = mount('<form><button type="button">no</button></form>')
    document.querySelector('button')!.click()
    expect(plain.onSubmit).not.toHaveBeenCalled()

    const disabled = mount('<form><button disabled>no</button></form>')
    document.querySelector('button')!.click()
    expect(disabled.onSubmit).not.toHaveBeenCalled()

    const invalid = mount('<form><input required><button>go</button></form>')
    document.querySelector('button')!.click()
    expect(invalid.onSubmit).not.toHaveBeenCalled()
  })

  it('submits on Enter only when the form has no submit button, and never while composing', () => {
    const noButton = mount('<form><input id="q" type="text"></form>')
    const input = document.getElementById('q')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }))
    expect(noButton.onSubmit).not.toHaveBeenCalled()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(noButton.onSubmit).toHaveBeenCalledOnce()

    const withButton = mount('<form><input id="q" type="text"><button>go</button></form>')
    document
      .getElementById('q')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    // The browser itself clicks the default button in this case; the click path covers it.
    expect(withButton.onSubmit).not.toHaveBeenCalled()
  })

  it('takes over the click only while installed', () => {
    // jsdom (unlike the sandboxed frame) submits natively, so observe whether the default was claimed.
    const claimed = () => {
      mount('<form><button>go</button></form>')
      let prevented = false
      document.body.addEventListener('click', (event) => (prevented = event.defaultPrevented))
      document.querySelector('button')!.click()
      return prevented
    }
    expect(claimed()).toBe(true)
    remove()
    expect(claimed()).toBe(false)
    remove = installFormSubmitFallback()
  })
})
