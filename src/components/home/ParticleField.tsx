import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useInView } from 'framer-motion'
import * as THREE from 'three'

const COUNT = 300

/** ~300 缓慢漂浮的微尘粒子(paper / amber),随鼠标轻微视差 */
function Dust() {
  const group = useRef<THREE.Group>(null)

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const paper = new THREE.Color('#F2EAD8')
    const amber = new THREE.Color('#FFB347')
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16
      positions[i * 3 + 1] = (Math.random() - 0.5) * 9
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6
      const c = Math.random() < 0.28 ? amber : paper
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, colors }
  }, [])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    g.rotation.y += delta * 0.018
    g.rotation.x += delta * 0.006
    g.position.x += (state.pointer.x * 0.4 - g.position.x) * 0.03
    g.position.y += (-state.pointer.y * 0.25 - g.position.y) * 0.03
  })

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          vertexColors
          transparent
          opacity={0.75}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

export default function ParticleField() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { margin: '80px' })

  return (
    <div ref={wrapRef} className="absolute inset-0" aria-hidden>
      <Canvas
        frameloop={inView ? 'always' : 'never'}
        dpr={[1, 1.8]}
        camera={{ position: [0, 0, 8], fov: 55 }}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      >
        <Dust />
      </Canvas>
    </div>
  )
}
