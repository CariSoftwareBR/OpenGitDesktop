/**
 * "Turn to dust" (the Infinity War snap): a snapshot of a region is scattered
 * across stacked canvas layers — pixels further right land in later layers —
 * and each layer drifts up and away, so the content crumbles left to right.
 */

const LAYERS = 32
const DURATION_MS = 1700
const STAGGER_MS = 28
/** Pixels this close to the background colour stay put — only content flies. */
const BACKGROUND_TOLERANCE = 5

export interface Dust {
  /** Starts the crumble (mounting the overlay if needed); resolves once it's gone. */
  play: () => Promise<void>
  /** Shows the overlay, still and opaque — freezing the region until play(). */
  mount: () => void
  /** Drops the overlay without playing — for when the change it covered didn't happen. */
  discard: () => void
}

export interface DustOptions {
  /**
   * Mount the overlay right away (default), freezing the region's look so the
   * caller can swap the content underneath. With false, nothing shows until
   * play() — for snapshots taken ahead of a change that may still fail.
   */
  mount?: boolean
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Snapshots `rect` (viewport CSS px) of the page and builds its dust. */
export async function captureDust(rect: DOMRect, options?: DustOptions): Promise<Dust> {
  const snapshot = await window.api.app.capturePage({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  })
  return prepareDust(rect, snapshot, options)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Falha ao carregar a captura.'))
    image.src = src
  })
}

/**
 * Builds the dust overlay over `rect` from `snapshotUrl` and (by default)
 * mounts it on top of the page, so the caller can swap the real content out
 * underneath before calling play().
 */
export async function prepareDust(rect: DOMRect, snapshotUrl: string, options: DustOptions = {}): Promise<Dust> {
  const image = await loadImage(snapshotUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight

  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })
  if (!sourceCtx) throw new Error('Canvas indisponível.')
  sourceCtx.drawImage(image, 0, 0)
  const pixels = sourceCtx.getImageData(0, 0, width, height).data

  // The top-left corner sits in the container's padding: that's the backdrop.
  const bgR = pixels[0]
  const bgG = pixels[1]
  const bgB = pixels[2]

  const layers = Array.from({ length: LAYERS }, () => new ImageData(width, height))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      if (
        Math.abs(r - bgR) < BACKGROUND_TOLERANCE &&
        Math.abs(g - bgG) < BACKGROUND_TOLERANCE &&
        Math.abs(b - bgB) < BACKGROUND_TOLERANCE
      ) {
        continue
      }
      // Mostly by position (left crumbles first), with enough noise that the
      // edge of the sweep is ragged instead of a straight wipe.
      const bias = (x / width) * 0.7 + Math.random() * 0.3
      const layer = layers[Math.min(LAYERS - 1, Math.floor(bias * LAYERS))].data
      layer[i] = r
      layer[i + 1] = g
      layer[i + 2] = b
      layer[i + 3] = pixels[i + 3]
    }
  }

  const overlay = document.createElement('div')
  overlay.setAttribute('aria-hidden', 'true')
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: 'none',
    zIndex: '60'
  })

  // Painted opaque at first so the swap underneath is invisible; the backdrop
  // is dropped the moment the crumble starts.
  const base = document.createElement('canvas')
  base.width = width
  base.height = height
  base.getContext('2d')?.drawImage(image, 0, 0)
  Object.assign(base.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' })
  overlay.appendChild(base)

  const canvases = layers.map((data) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')?.putImageData(data, 0, 0)
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      willChange: 'transform, opacity'
    })
    overlay.appendChild(canvas)
    return canvas
  })

  const mount = (): void => {
    if (!overlay.isConnected) document.body.appendChild(overlay)
  }
  if (options.mount !== false) mount()

  return {
    mount,
    discard: () => overlay.remove(),
    // Web Animations rather than CSS transitions: the layers were only just
    // mounted, so a transition would have no computed "before" state to start
    // from and would jump straight to the end.
    play: async () => {
      mount()
      base.remove()
      const animations = canvases.map((canvas, index) => {
        const angle = (Math.random() - 0.5) * Math.PI * 0.5 - Math.PI / 6
        const distance = 50 + Math.random() * 70
        const dx = Math.cos(angle) * distance
        const dy = Math.sin(angle) * distance - 20
        const turn = (Math.random() - 0.5) * 24
        return canvas.animate(
          [
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, filter: 'blur(0)' },
            // The dust stays dense for the first half of its drift, then fades.
            { offset: 0.45, opacity: 0.9 },
            { transform: `translate(${dx}px, ${dy}px) rotate(${turn}deg)`, opacity: 0, filter: 'blur(1.5px)' }
          ],
          {
            duration: DURATION_MS,
            delay: index * STAGGER_MS,
            easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)',
            fill: 'both'
          }
        )
      })
      await Promise.allSettled(animations.map((a) => a.finished))
      overlay.remove()
    }
  }
}
