/**
 * Haibara Pet Engine — drag/throw physics.
 *
 * This is a tiny, self-contained implementation for the new engine. It does not
 * import legacy pet code; the only inputs are box coordinates in CSS pixels.
 */

export type Vec2 = { x: number; y: number }

export type Box = { x: number; y: number; w: number; h: number }

export const GRAVITY = 1500
export const RESTITUTION = 0.72
export const GROUND_FRICTION = 2.0
export const SPRING = 170
export const DAMPING = 26

/** Critically damped-ish spring used by the pointer follow. */
export function springStep(value: number, velocity: number, target: number, dt: number): [number, number] {
  const accel = (target - value) * SPRING - velocity * DAMPING
  const nextVelocity = velocity + accel * dt
  return [value + nextVelocity * dt, nextVelocity]
}

/** Clamp a pet box inside the viewport, with a small sprite-bleed so her body reaches the edge. */
export function clampBox(box: Box): Box {
  const BLEED_X = 120
  const maxX = Math.max(-BLEED_X, window.innerWidth - box.w + BLEED_X)
  const maxY = Math.max(0, window.innerHeight - box.h)
  return { ...box, x: Math.min(Math.max(-BLEED_X, box.x), maxX), y: Math.min(Math.max(0, box.y), maxY) }
}

/** Advance one gravity/bounce frame; returns the next box and velocity. */
export function throwStep(box: Box, velocity: Vec2, dt: number): { box: Box; velocity: Vec2 } {
  const nextVelocity = { x: velocity.x, y: velocity.y + GRAVITY * dt }
  const nextBox = { ...box, x: box.x + nextVelocity.x * dt, y: box.y + nextVelocity.y * dt }
  const maxX = Math.max(0, window.innerWidth - box.w)
  const maxY = Math.max(0, window.innerHeight - box.h)
  if (nextBox.x < 0) {
    nextBox.x = 0
    nextVelocity.x = Math.abs(nextVelocity.x) * RESTITUTION
  } else if (nextBox.x > maxX) {
    nextBox.x = maxX
    nextVelocity.x = -Math.abs(nextVelocity.x) * RESTITUTION
  }
  if (nextBox.y < 0) {
    nextBox.y = 0
    nextVelocity.y = Math.abs(nextVelocity.y) * RESTITUTION
  } else if (nextBox.y > maxY) {
    nextBox.y = maxY
    const impact = Math.abs(nextVelocity.y)
    nextVelocity.y = impact > 90 ? -impact * RESTITUTION : 0
    nextVelocity.x *= Math.max(0, 1 - GROUND_FRICTION * dt)
    if (Math.abs(nextVelocity.x) < 4) nextVelocity.x = 0
  }
  return { box: nextBox, velocity: nextVelocity }
}

/** Convert a drag delta into an initial throw velocity. */
export function dragVelocity(samples: Array<{ x: number; y: number; t: number }>): Vec2 {
  if (samples.length < 2) return { x: 0, y: 0 }
  const last = samples[samples.length - 1]
  const first = samples[Math.max(0, samples.length - 5)]
  const dt = Math.max(0.016, (last.t - first.t) / 1000)
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
}
