import { describe, expect, it } from 'vitest'
import { opensUpward } from '../src/renderer/src/lib/dropdownPlacement'

describe('opensUpward', () => {
  it('stays below whenever the list fits there', () => {
    expect(opensUpward(500, 256, 256)).toBe(false)
  })

  it('opens upward at the bottom of the pane when the whole list fits above', () => {
    expect(opensUpward(600, 40, 175)).toBe(true)
  })

  it('stays below when it fits on neither side, since overflow above could not be scrolled to', () => {
    // A long list in the minimum 600px window: the case that used to end up behind the top bar.
    expect(opensUpward(230, 236, 256)).toBe(false)
  })
})
