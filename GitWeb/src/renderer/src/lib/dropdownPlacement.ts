/**
 * Opening upward is only safe when the whole list fits there: anything above a
 * scroll container can't be scrolled to, while a list running past the bottom
 * still can. So it stays below unless that would overflow and above has room.
 */
export function opensUpward(above: number, below: number, listHeight: number): boolean {
  return below < listHeight && above >= listHeight
}
