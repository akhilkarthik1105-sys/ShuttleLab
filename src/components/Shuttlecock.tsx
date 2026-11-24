
import { useMemo } from 'react'
import * as THREE from 'three'

export default function Shuttlecock() {
  const feathers = useMemo(() => {
    const result: {
      geometry: THREE.BufferGeometry
      outlineGeometry: THREE.TubeGeometry
    }[] = []

    for (let feather = 0; feather < 16; feather++) {
      const vertices: number[] = []
      const indices: number[] = []
      const perimeter: THREE.Vector3[] = []

      const segments = 32
      const acrossSegments = 8
      const rowSize = acrossSegments + 1
      const angle = (feather / 16) * Math.PI * 2

      const getPoint = (t: number, u: number) => {
        const y = -0.14 + t * 0.48

        const radius =
          0.075 + 0.235 * t + 0.018 * Math.sin(Math.PI * t)

        // 40:60 narrow-to-wide proportion
        const spread = THREE.MathUtils.smoothstep(t, 0.40, 0.60)
        const width = 0.008 + 0.057 * spread

        const featherAngle = angle + (u * width) / radius
        const r = radius + 0.008 * (1 - u * u)

        return new THREE.Vector3(
          Math.sin(featherAngle) * (r + 0.0015),
          y - 0.025 * u * u,
          Math.cos(featherAngle) * (r + 0.0015)
        )
      }

      for (let i = 0; i <= segments; i++) {
        const t = i / segments

        for (let j = 0; j <= acrossSegments; j++) {
          const u = (j / acrossSegments) * 2 - 1
          const point = getPoint(t, u)

          vertices.push(point.x, point.y, point.z)
        }
      }

      // Build feather surface
      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < acrossSegments; j++) {
          const a = i * rowSize + j
          const b = a + rowSize

          indices.push(a, a + 1, b)
          indices.push(a + 1, b + 1, b)
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3)
      )
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      // Trace the complete perimeter of each feather
      for (let j = 0; j <= acrossSegments; j++) {
        perimeter.push(getPoint(0, (j / acrossSegments) * 2 - 1))
      }

      for (let i = 1; i <= segments; i++) {
        perimeter.push(getPoint(i / segments, 1))
      }

      for (let j = acrossSegments - 1; j >= 0; j--) {
        perimeter.push(getPoint(1, (j / acrossSegments) * 2 - 1))
      }

      for (let i = segments - 1; i >= 1; i--) {
        perimeter.push(getPoint(i / segments, -1))
      }

      const curve = new THREE.CatmullRomCurve3(
        perimeter,
        true,
        'centripetal'
      )

      const outlineGeometry = new THREE.TubeGeometry(
        curve,
        128,
        0.0018,
        5,
        true
      )

      result.push({ geometry, outlineGeometry })
    }

    return result
  }, [])

  // Flat top with rounded underside
  const corkGeometry = useMemo(() => {
    const profile = [
      new THREE.Vector2(0, 0.06),
      new THREE.Vector2(0.085, 0.06),
      new THREE.Vector2(0.085, 0.025),
      new THREE.Vector2(0.08, -0.015),
      new THREE.Vector2(0.065, -0.05),
      new THREE.Vector2(0.04, -0.073),
      new THREE.Vector2(0.015, -0.085),
      new THREE.Vector2(0, -0.088),
    ]

    return new THREE.LatheGeometry(profile, 32)
  }, [])

  return (
    <group>
      {/* Sixteen white feather surfaces */}
      {feathers.map(({ geometry }, i) => (
        <mesh key={`feather-${i}`} geometry={geometry}>
          <meshStandardMaterial
            color="#f5f3ed"
            side={THREE.DoubleSide}
            roughness={0.95}
          />
        </mesh>
      ))}

      {/* One thin outline around each feather */}
      {feathers.map(({ outlineGeometry }, i) => (
        <mesh
          key={`outline-${i}`}
          geometry={outlineGeometry}
          renderOrder={1}
        >
          <meshBasicMaterial
            color="#716b60"
            depthTest={true}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Central feather shafts */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2

        return (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh
              position={[0, 0.10, 0.1925]}
              rotation={[0.384, 0, 0]}
            >
              <cylinderGeometry args={[0.0025, 0.004, 0.525, 6]} />
              <meshStandardMaterial color="#d6d1c5" />
            </mesh>
          </group>
        )
      })}

      {/* Slightly wider black cork binding ring */}
      <mesh
        position={[0, -0.14, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.092, 0.016, 8, 48]} />
        <meshStandardMaterial
          color="#151515"
          roughness={0.8}
        />
      </mesh>

      {/* Cork: flat top, rounded bottom */}
      <mesh
        geometry={corkGeometry}
        position={[0, -0.20, 0]}
      >
        <meshStandardMaterial
          color="#f5deb3"
          roughness={0.9}
        />
      </mesh>
    </group>
  )
}
