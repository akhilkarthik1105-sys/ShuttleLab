import type {} from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'

export default function Court() {
  const courtLines = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: '#ffffff',
    })

    const lines = [
      // Outer court boundary
      [[-3.05, 0.025, -6.7], [3.05, 0.025, -6.7]],
      [[3.05, 0.025, -6.7], [3.05, 0.025, 6.7]],
      [[3.05, 0.025, 6.7], [-3.05, 0.025, 6.7]],
      [[-3.05, 0.025, 6.7], [-3.05, 0.025, -6.7]],

      // Center line
      [[0, 0.025, -6.7], [0, 0.025, 6.7]],

      // Short service lines
      [[-3.05, 0.025, -1.98], [3.05, 0.025, -1.98]],
      [[-3.05, 0.025, 1.98], [3.05, 0.025, 1.98]],

      // Doubles long service lines
      [[-3.05, 0.025, -5.94], [3.05, 0.025, -5.94]],
      [[-3.05, 0.025, 5.94], [3.05, 0.025, 5.94]],

      // Singles sidelines
      [[-2.59, 0.025, -6.7], [-2.59, 0.025, 6.7]],
      [[2.59, 0.025, -6.7], [2.59, 0.025, 6.7]],
    ]

    return lines.map(([start, end]) => {
      const points = [
        new THREE.Vector3(...start as [number, number, number]),
        new THREE.Vector3(...end as [number, number, number]),
      ]

      const geometry = new THREE.BufferGeometry().setFromPoints(points)

      return new THREE.Line(geometry, material)
    })
  }, [])

  return (
    <group>
      {/* Near half of court */}
<mesh
receiveShadow
  rotation={[-Math.PI / 2, 0, 0]}
  position={[0, 0, 3.35]}
>
  <planeGeometry args={[6.1, 6.7]} />
  <meshStandardMaterial color="#087f5b" roughness={0.85} />
</mesh>

{/* Far half of court */}
<mesh
receiveShadow
  rotation={[-Math.PI / 2, 0, 0]}
  position={[0, 0, -3.35]}
>
  <planeGeometry args={[6.1, 6.7]} />
  <meshStandardMaterial color="#087f5b" roughness={0.85} />
      </mesh>

      {/* Court markings */}
      {courtLines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}

      {/* Net mesh */}
<group position={[0, 1.14, 0]}>
  {/* Horizontal net threads */}
  {Array.from({ length: 39 }, (_, i) => (
    <mesh key={`h-${i}`} position={[0, -0.38 + i * 0.02, 0]}>
      <boxGeometry args={[6.1, 0.008, 0.008]} />
      <meshStandardMaterial color="#64748b" />
    </mesh>
  ))}

  {/* Vertical net threads */}
  {Array.from({ length: 306 }, (_, i) => (
    <mesh key={`v-${i}`} position={[-3.05 + i * 0.02, 0, 0]}>
      <boxGeometry args={[0.008, 0.76, 0.008]} />
      <meshStandardMaterial color="#64748b" />
    </mesh>
  ))}

  {/* White top tape */}
  <mesh position={[0, 0.38, 0]}>
    <boxGeometry args={[6.1, 0.07, 0.045]} />
    <meshStandardMaterial color="#ffffff" />
  </mesh>
</group>

      {/* Net posts */}
      {[-3.05, 3.05].map((x) => (
        <mesh key={x} position={[x, 0.76, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 1.52, 12]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      ))}
    </group>
  )
}
