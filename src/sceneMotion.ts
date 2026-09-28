export type SceneInput = { progress: number; pointerX: number; pointerY: number }

export function storyPose(progress: number, compact: boolean) {
  const p = Math.max(0, Math.min(1, progress))
  const a = p < 0.5 ? 0 : 1
  const t = p < 0.5 ? p * 2 : (p - 0.5) * 2
  const eased = t * t * (3 - 2 * t)
  const interpolate = (keys: number[]) => keys[a] + (keys[a + 1] - keys[a]) * eased
  const strength = compact ? 0.25 : 1
  return {
    cameraZ: 8.9 + (interpolate([8.9, 7.55, 8.7]) - 8.9) * strength,
    cameraX: interpolate([0, -0.32, 0.25]) * strength,
    yaw: -0.46 + interpolate([0, 0.17, -0.08]) * strength,
    spread: interpolate([0, 0.35, 1]) * strength,
    context: interpolate([0, 1, 0.3]) * strength,
  }
}
