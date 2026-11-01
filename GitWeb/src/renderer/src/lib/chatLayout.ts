/**
 * Narrowest the AI chat may get, docked or floating. The tool cards (commit
 * lists, approval flows, the before/after of a reorganization, PR checks) are
 * laid out with container queries down to this width; below it their
 * two-column parts would have to squeeze text into slivers. Changing this
 * means re-checking every card at the new width.
 */
export const AI_CHAT_MIN_WIDTH = 360
export const AI_CHAT_MIN_HEIGHT = 320
