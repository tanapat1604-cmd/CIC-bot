import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { storyPose, type SceneInput } from './sceneMotion'

type SceneProps = { reduced: boolean; active: boolean; compact: boolean; input: RefObject<SceneInput>; onReady: () => void; onFailure: () => void }

function Panel({ width, height, depth = 0.09, color, position = [0, 0, 0], radius = 0.1 }: { width: number; height: number; depth?: number; color: string; position?: [number, number, number]; radius?: number }) {
  const geometry = useMemo(() => {
    const x = -width / 2, y = -height / 2, r = Math.min(radius, width / 2, height / 2)
    const shape = new THREE.Shape()
    shape.moveTo(x + r, y)
    shape.lineTo(x + width - r, y)
    shape.quadraticCurveTo(x + width, y, x + width, y + r)
    shape.lineTo(x + width, y + height - r)
    shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    shape.lineTo(x + r, y + height)
    shape.quadraticCurveTo(x, y + height, x, y + height - r)
    shape.lineTo(x, y + r)
    shape.quadraticCurveTo(x, y, x + r, y)
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 })
  }, [width, height, depth, radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={position}><meshStandardMaterial color={color} roughness={0.38} metalness={0.15} /></mesh>
}

function Model({ reduced, active, compact, input, onReady }: Omit<SceneProps, 'onFailure'>) {
  const group = useRef<THREE.Group>(null)
  const orb = useRef<THREE.Group>(null)
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const tiles = useRef<(THREE.Group | null)[]>([])
  const contextCards = useRef<(THREE.Group | null)[]>([])
  const state = useRef({ elapsed: 0, initialized: false, wasReduced: reduced, ready: false, progress: 0 })
  const resume = useRef(true)
  useEffect(() => { resume.current = true }, [active])
  useFrame(({ camera, gl, invalidate }, delta) => {
    const motion = state.current
    // Readiness means a real WebGL frame has rendered, not merely a mounted canvas.
    if (!motion.ready) {
      if (gl.info.render.frame > 0) { motion.ready = true; queueMicrotask(onReady) }
      else invalidate()
    }
    if (!group.current || !orb.current) return
    if (!active && motion.initialized && motion.wasReduced === reduced) return
    const snap = !motion.initialized || reduced
    // Exclude the first frame after a pause; otherwise use real delta time.
    const dt = resume.current ? 0 : delta
    if (reduced) motion.elapsed = 0
    else if (!resume.current) motion.elapsed += dt
    resume.current = false
    const t = motion.elapsed
    const approach = (current: number, target: number) => snap ? target : THREE.MathUtils.damp(current, target, 5, dt)
    motion.progress = approach(motion.progress, reduced ? 0 : input.current.progress)
    const pose = storyPose(motion.progress, compact)
    const px = reduced || compact ? 0 : input.current.pointerX
    const py = reduced || compact ? 0 : input.current.pointerY
    const float = reduced ? 0 : 1
    group.current.rotation.set(
      approach(group.current.rotation.x, 0.10 + py * 0.055),
      approach(group.current.rotation.y, pose.yaw + px * 0.12),
      approach(group.current.rotation.z, -0.025 + px * 0.015),
    )
    group.current.position.x = approach(group.current.position.x, px * 0.10)
    group.current.position.y = approach(group.current.position.y, py * 0.07)
    camera.position.x = approach(camera.position.x, pose.cameraX)
    camera.position.z = approach(camera.position.z, pose.cameraZ)
    camera.lookAt(0, 0.12, 0)
    const move = (object: THREE.Object3D | null, x: number, y: number, z: number) => {
      if (object) object.position.set(approach(object.position.x, x), approach(object.position.y, y), approach(object.position.z, z))
    }
    // Only the rings rotate; the bot's eyes remain upright at every phase.
    move(orb.current, 1.52 + pose.spread * 0.15, -0.25 + Math.sin(t * 1.05) * 0.19 * float, 1.22)
    rings.current[0]?.rotation.set(0.9 + Math.sin(t * 0.45) * 0.28, 0.32 + t * 0.34, 0.35 + t * 0.20)
    rings.current[1]?.rotation.set(-0.45 + t * 0.18, 0.7 + Math.sin(t * 0.55) * 0.22, -0.45 - t * 0.27)
    move(tiles.current[0], -2.12 - pose.spread * 0.28, -0.6 + Math.sin(t * 0.83 + 0.6) * 0.13 * float, 0.85 + pose.spread * 0.35)
    move(tiles.current[1], 1.85 + pose.spread * 0.25, 1.63 + Math.sin(t * 0.69 + 2) * 0.12 * float, 0.05 + pose.spread * 0.4)
    move(tiles.current[2], -1.7 - pose.spread * 0.15, 1.89 + Math.sin(t * 0.92 + 4) * 0.10 * float, -0.40)
    tiles.current.forEach((tile, i) => { if (tile) tile.rotation.set(0.03, i === 1 ? -0.18 : 0.14, (i === 1 ? -0.12 : 0.08) + Math.sin(t * 0.5 + i) * 0.035 * float) })
    contextCards.current.forEach((card, i) => move(card, -0.5 + i * 0.72, -0.03 + pose.context * 0.08 * i, 0.4 + pose.context * (0.36 + i * 0.1)))
    motion.initialized = true
    motion.wasReduced = reduced
  })
  return <group ref={group}>
    <group position={[-0.24, 0.17, 0]}>
      <Panel width={4.25} height={2.85} depth={0.35} position={[0, 0, -0.15]} color="#8e9eb9" radius={0.17} />
      <Panel width={4.13} height={2.73} color="#172441" position={[0, 0, 0.2]} radius={0.14} />
      <Panel width={3.89} height={2.46} color="#eef2fa" position={[0, 0.02, 0.3]} radius={0.08} />
      <Panel width={3.88} height={0.28} color="#ffffff" position={[0, 1.08, 0.4]} radius={0.04} />
      {['#4774ff', '#a9bed9', '#c3cedd'].map((color, i) => <mesh key={color} position={[-1.74 + i * 0.17, 1.08, 0.52]}><sphereGeometry args={[0.036, 12, 12]} /><meshBasicMaterial color={color} /></mesh>)}
      <Panel width={0.66} height={2.04} color="#dfe6f4" position={[-1.55, -0.11, 0.4]} radius={0.03} />
      {[0, 1, 2, 3, 4].map(i => <Panel key={i} width={0.42} height={0.07} color={i === 0 ? '#3564ff' : '#b0bfd6'} position={[-1.55, 0.62 - i * 0.28, 0.51]} radius={0.02} />)}
      <Panel width={1.5} height={0.13} color="#253b63" position={[-0.16, 0.68, 0.4]} radius={0.03} />
      <Panel width={1.9} height={0.06} color="#b1bdd1" position={[0.04, 0.42, 0.4]} radius={0.02} />
      {[0, 1, 2].map(i => <group key={i} ref={node => { contextCards.current[i] = node }}><Panel width={0.61} height={0.48} color={i === 0 ? '#3564ff' : '#ffffff'} /><Panel width={0.36} height={0.05} color={i === 0 ? '#bdeeff' : '#c1cce0'} position={[0, -0.09, 0.11]} radius={0.02} /></group>)}
      {[0, 1, 2].map(i => <Panel key={i} width={1.4 - i * 0.2} height={0.055} color="#b1bdd1" position={[-0.2 - i * 0.1, -0.5 - i * 0.18, 0.4]} radius={0.02} />)}
      <Panel width={0.38} height={0.62} color="#8393af" position={[0, -1.64, -0.03]} />
      <Panel width={1.35} height={0.11} depth={0.7} color="#aebbd0" position={[0, -1.98, -0.2]} radius={0.05} />
    </group>
    <group ref={orb}>
      <mesh><sphereGeometry args={[0.66, compact ? 28 : 40, compact ? 20 : 32]} /><meshStandardMaterial color="#2857ef" metalness={0.42} roughness={0.23} /></mesh>
      <mesh ref={node => { rings.current[0] = node }}><torusGeometry args={[0.85, 0.035, 10, compact ? 48 : 80]} /><meshStandardMaterial color="#71e1ed" metalness={0.5} roughness={0.2} /></mesh>
      <mesh ref={node => { rings.current[1] = node }}><torusGeometry args={[0.94, 0.023, 8, compact ? 48 : 80]} /><meshStandardMaterial color="#b9cafa" metalness={0.6} roughness={0.2} /></mesh>
      <mesh position={[-0.2, 0.17, 0.59]}><sphereGeometry args={[0.095, 16, 16]} /><meshBasicMaterial color="#e6fbff" /></mesh>
      <mesh position={[0.15, 0.17, 0.62]}><sphereGeometry args={[0.095, 16, 16]} /><meshBasicMaterial color="#e6fbff" /></mesh>
    </group>
    <group ref={node => { tiles.current[0] = node }}>
      <Panel width={1.13} height={0.86} depth={0.08} color="#ffffff" />
      {[0, 1, 2].map(i => <Panel key={i} width={0.58 - i * 0.08} height={0.055} color={i === 0 ? '#3866f5' : '#bbcadf'} position={[-0.06, 0.2 - i * 0.17, 0.1]} radius={0.02} />)}
    </group>
    <group ref={node => { tiles.current[1] = node }}>
      <Panel width={0.94} height={0.79} color="#f9fcff" />
      <mesh position={[0, 0, 0.17]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.3, 0.3, 0.09]} /><meshStandardMaterial color="#3967f4" /></mesh>
      <mesh position={[0.2, -0.1, 0.24]}><sphereGeometry args={[0.15, 20, 20]} /><meshStandardMaterial color="#60d5e8" /></mesh>
    </group>
    <group ref={node => { tiles.current[2] = node }}><Panel width={0.82} height={0.61} color="#315cf5" /><Panel width={0.39} height={0.04} color="#d1e4ff" position={[0, 0.08, 0.12]} /><Panel width={0.24} height={0.04} color="#8beafa" position={[-0.07, -0.08, 0.12]} /></group>
    <mesh position={[0, -2.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[6.5, 4]} />
      <shaderMaterial transparent depthWrite={false} vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}" fragmentShader="varying vec2 vUv; void main(){vec2 p=(vUv-0.5)*2.0;float a=exp(-dot(p,p)*5.0)*0.16;gl_FragColor=vec4(0.08,0.15,0.28,a);}" />
    </mesh>
  </group>
}

function Unavailable({ onFailure }: { onFailure: () => void }) {
  useEffect(onFailure, [onFailure])
  return null
}

export default function Scene({ reduced, active, compact, input, onReady, onFailure }: SceneProps) {
  const [lost, setLost] = useState(false)
  const camera = useMemo(() => ({ position: [0, 0.45, 8.9] as [number, number, number], fov: 40 }), [])
  return <Canvas aria-hidden="true" camera={camera} dpr={[1, compact ? 1 : 1.5]} frameloop={lost ? 'never' : active && !reduced ? 'always' : 'demand'} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={<Unavailable onFailure={onFailure} />} onCreated={({ gl }) => {
    gl.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); setLost(true); onFailure() }, { once: true })
  }}>
    <ambientLight intensity={1.6} />
    <directionalLight position={[-3, 5, 6]} intensity={3.2} color="#ffffff" />
    <directionalLight position={[4, 1, 2]} intensity={1.8} color="#a5d8ff" />
    <directionalLight position={[1, 3, -4]} intensity={2.5} color="#a9e7f5" />
    <Model reduced={reduced} active={active && !lost} compact={compact} input={input} onReady={onReady} />
  </Canvas>
}
