
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import Court from './Court'
import Shuttlecock from './Shuttlecock'

type ShotDirection = 'straight' | 'crosscourt'

interface ShotPresetViewerProps {
  shotId: string
  direction: ShotDirection
}

interface ShotPath {
  startY: number
  startZ: number
  controlY: number
  endY: number
  endZ: number
  duration: number
}

const shotPaths: Record<string, ShotPath> = {
  clear: {
    startY: 2.5,
    startZ: 5.5,
    controlY: 4.8,
    endY: 0.16,
    endZ: -6.0,
    duration: 2.5,
  },
  smash: {
    startY: 3.1,
    startZ: 5.2,
    controlY: 3.6,
    endY: 0.16,
    endZ: -2.6,
    duration: 1.1,
  },
  drop: {
    startY: 2.8,
    startZ: 5.2,
    controlY: 3.6,
    endY: 0.16,
    endZ: -2.0,
    duration: 1.7,
  },
  'slice-drop': {
    startY: 2.8,
    startZ: 5.2,
    controlY: 3.6,
    endY: 0.16,
    endZ: -2.0,
    duration: 1.7,
  },
  'net-drop': {
    startY: 1.65,
    startZ: 1.2,
    controlY: 2.15,
    endY: 0.16,
    endZ: -1.25,
    duration: 1.4,
  },
  'net-kill': {
    startY: 2.4,
    startZ: 1.2,
    controlY: 2.8,
    endY: 0.16,
    endZ: -1.8,
    duration: 0.8,
  },
  'net-lift': {
    startY: 1.65,
    startZ: 1.2,
    controlY: 4.8,
    endY: 0.16,
    endZ: -6.0,
    duration: 2.4,
  },
  'spinning-net': {
    startY: 1.65,
    startZ: 1.2,
    controlY: 2.05,
    endY: 0.16,
    endZ: -0.9,
    duration: 1.4,
  },
  drive: {
    startY: 1.8,
    startZ: 5.5,
    controlY: 2.6,
    endY: 0.16,
    endZ: -4.5,
    duration: 0.9,
  },
  'defensive-block': {
    startY: 2.5,
    startZ: 5.2,
    controlY: 3.1,
    endY: 0.16,
    endZ: -2.8,
    duration: 1.5,
  },
}

function PresetFlight({
  shotId,
  direction,
}: ShotPresetViewerProps) {
  const shuttleRef = useRef<THREE.Group>(null)
  const elapsed = useRef(0)

  const path = shotPaths[shotId] ?? shotPaths.clear

  const startX = -1.0
  const endX = direction === 'crosscourt' ? 1.8 : startX
  const controlX = (startX + endX) / 2

  const curve = useMemo(() => {
    const start = new THREE.Vector3(
      startX,
      path.startY,
      path.startZ
    )

    const control = new THREE.Vector3(
      controlX,
      path.controlY,
      (path.startZ + path.endZ) / 2
    )

    const end = new THREE.Vector3(
      endX,
      path.endY,
      path.endZ
    )

    return new THREE.QuadraticBezierCurve3(
      start,
      control,
      end
    )
  }, [startX, endX, controlX, path])

  const curvePoints = useMemo(
    () => curve.getPoints(100),
    [curve]
  )

  useEffect(() => {
    elapsed.current = 0
  }, [shotId, direction])

  useFrame((_, delta) => {
    if (!shuttleRef.current) return

    elapsed.current =
      (elapsed.current + delta) % path.duration

    const progress = elapsed.current / path.duration
    const position = curve.getPointAt(progress)

    shuttleRef.current.position.copy(position)
  })

  return (
    <group>
      {/* Predefined shot trajectory */}
      <Line
        points={curvePoints}
        color="#facc15"
        lineWidth={3}
      />

      {/* Starting position */}
      <mesh
        position={[startX, 0.04, path.startZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.16, 32]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* Landing target */}
      <mesh
        position={[endX, 0.045, path.endZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.16, 0.23, 40]} />
        <meshBasicMaterial
          color="#facc15"
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Moving shuttlecock */}
      <group
        ref={shuttleRef}
        position={[startX, path.startY, path.startZ]}
        scale={0.65}
      >
        <Shuttlecock />
      </group>
    </group>
  )
}

export default function ShotPresetViewer({
  shotId,
  direction,
}: ShotPresetViewerProps) {
  return (
    <Canvas
      shadows
      camera={{
        position: [10, 10, 15],
        fov: 45,
      }}
    >
      <color attach="background" args={['#0b1120']} />

      <ambientLight intensity={1.5} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={2}
        castShadow
      />

      <Court />

      <PresetFlight
        shotId={shotId}
        direction={direction}
      />

      <OrbitControls
        makeDefault
        minDistance={7}
        maxDistance={25}
      />
    </Canvas>
  )
}
