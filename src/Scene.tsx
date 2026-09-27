import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import SceneFallback from './SceneFallback'

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

function Model({ step, reduced }: { step: number; reduced: boolean }) {
  const group = useRef<THREE.Group>(null)
  const orb = useRef<THREE.Group>(null)
  useFrame(({ clock, pointer }, delta) => {
    if (!group.current || !orb.current || reduced) return
    const t = clock.getElapsedTime()
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, -0.24 + step * 0.12 + pointer.x * 0.08, 3, delta)
    group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, 0.06 + pointer.y * 0.025, 3, delta)
    group.current.position.y = Math.sin(t * 0.7) * 0.055
    orb.current.rotation.z = t * 0.13
  })
  return <group ref={group} rotation={[0.06, -0.24 + step * 0.12, -0.045]}>
    <group position={[-0.24, 0.17, 0]}>
      <Panel width={4.25} height={2.85} depth={0.2} color="#a3afc4" radius={0.17} />
      <Panel width={4.13} height={2.73} color="#172441" position={[0, 0, 0.2]} radius={0.14} />
      <Panel width={3.89} height={2.46} color="#eef2fa" position={[0, 0.02, 0.3]} radius={0.08} />
      <Panel width={3.88} height={0.28} color="#ffffff" position={[0, 1.08, 0.4]} radius={0.04} />
      {['#4774ff', '#a9bed9', '#c3cedd'].map((color, i) => <mesh key={color} position={[-1.74 + i * 0.17, 1.08, 0.52]}><sphereGeometry args={[0.036, 12, 12]} /><meshBasicMaterial color={color} /></mesh>)}
      <Panel width={0.66} height={2.04} color="#dfe6f4" position={[-1.55, -0.11, 0.4]} radius={0.03} />
      {[0, 1, 2, 3, 4].map(i => <Panel key={i} width={0.42} height={0.07} color={i === step ? '#3564ff' : '#b0bfd6'} position={[-1.55, 0.62 - i * 0.28, 0.51]} radius={0.02} />)}
      <Panel width={1.5} height={0.13} color="#253b63" position={[-0.16, 0.68, 0.4]} radius={0.03} />
      <Panel width={1.9} height={0.06} color="#b1bdd1" position={[0.04, 0.42, 0.4]} radius={0.02} />
      {[0, 1, 2].map(i => <group key={i} position={[-0.5 + i * 0.72, -0.03, 0.4]}><Panel width={0.61} height={0.48} color={i === step ? '#3564ff' : '#ffffff'} /><Panel width={0.36} height={0.05} color={i === step ? '#bdeeff' : '#c1cce0'} position={[0, -0.09, 0.11]} radius={0.02} /></group>)}
      {[0, 1, 2].map(i => <Panel key={i} width={1.4 - i * 0.2} height={0.055} color="#b1bdd1" position={[-0.2 - i * 0.1, -0.5 - i * 0.18, 0.4]} radius={0.02} />)}
      <Panel width={0.38} height={0.62} color="#8393af" position={[0, -1.64, -0.03]} />
      <Panel width={1.35} height={0.11} depth={0.7} color="#aebbd0" position={[0, -1.98, -0.2]} radius={0.05} />
    </group>
    <group ref={orb} position={[1.48, -0.28, 1.12]}>
      <mesh><sphereGeometry args={[0.66, 40, 32]} /><meshStandardMaterial color="#2857ef" metalness={0.42} roughness={0.2} /></mesh>
      <mesh rotation={[0.9, 0.32, 0.35]}><torusGeometry args={[0.85, 0.035, 12, 80]} /><meshStandardMaterial color="#71e1ed" metalness={0.5} roughness={0.2} /></mesh>
      <mesh rotation={[-0.45, 0.7, -0.45]}><torusGeometry args={[0.94, 0.023, 10, 80]} /><meshStandardMaterial color="#b9cafa" metalness={0.6} roughness={0.2} /></mesh>
      <mesh position={[-0.2, 0.17, 0.59]}><sphereGeometry args={[0.095, 16, 16]} /><meshBasicMaterial color="#e6fbff" /></mesh>
      <mesh position={[0.15, 0.17, 0.62]}><sphereGeometry args={[0.095, 16, 16]} /><meshBasicMaterial color="#e6fbff" /></mesh>
    </group>
    <group position={[-2.15, -0.65, 0.65]} rotation={[0.02, 0.16, 0.12]}>
      <Panel width={1.13} height={0.86} depth={0.08} color="#ffffff" />
      {[0, 1, 2].map(i => <Panel key={i} width={0.58 - i * 0.08} height={0.055} color={i === 0 ? '#3866f5' : '#bbcadf'} position={[-0.06, 0.2 - i * 0.17, 0.1]} radius={0.02} />)}
    </group>
    <group position={[1.9, 1.67, 0.28]} rotation={[0, -0.15, -0.12]}>
      <Panel width={0.94} height={0.79} color="#f9fcff" />
      <mesh position={[0, 0, 0.17]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.3, 0.3, 0.09]} /><meshStandardMaterial color="#3967f4" /></mesh>
      <mesh position={[0.2, -0.1, 0.24]}><sphereGeometry args={[0.15, 20, 20]} /><meshStandardMaterial color="#60d5e8" /></mesh>
    </group>
    <group position={[-1.78, 1.94, 0.1]} rotation={[0, 0.15, 0.05]}><Panel width={0.82} height={0.61} color="#315cf5" /><Panel width={0.39} height={0.04} color="#d1e4ff" position={[0, 0.08, 0.12]} /><Panel width={0.24} height={0.04} color="#8beafa" position={[-0.07, -0.08, 0.12]} /></group>
  </group>
}

export default function Scene({ step = 0, reduced, active }: { step?: number; reduced: boolean; active: boolean }) {
  const [lost, setLost] = useState(false)
  if (lost) return <SceneFallback />
  return <Canvas aria-hidden="true" camera={{ position: [0, 0.45, 8.5], fov: 40 }} dpr={[1, matchMedia('(max-width: 650px)').matches ? 1 : 1.5]} frameloop={active && !reduced ? 'always' : 'demand'} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={<SceneFallback />} onCreated={({ gl }) => {
    gl.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); setLost(true) }, { once: true })
  }}>
    <ambientLight intensity={1.6} />
    <directionalLight position={[-3, 5, 6]} intensity={3.2} color="#ffffff" />
    <directionalLight position={[4, 1, 2]} intensity={1.8} color="#a5d8ff" />
    <Model step={step} reduced={reduced} />
  </Canvas>
}
