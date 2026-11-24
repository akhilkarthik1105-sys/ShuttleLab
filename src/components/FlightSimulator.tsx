

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'

import Shuttlecock from './Shuttlecock'
import { DEFAULT_PARAMETERS } from '../physics/model'
import type { PhysicsState } from '../physics/model'
import { simulateTrajectory } from '../physics/simulation'

interface FlightSimulatorProps {
  speed: number
  launchAngle: number
  horizontalDirection: number
  positionX: number
  positionZ: number
  launchHeight: number
  driftAmount: number
  driftDirection: number
}

export default function FlightSimulator({
  speed,
  launchAngle,
  horizontalDirection,
  positionX,
  positionZ,
  launchHeight,
  driftAmount,
  driftDirection,
}: FlightSimulatorProps) {
  const shuttleRef = useRef<THREE.Group>(null!)
  const elapsed = useRef(0)
  const currentIndex = useRef(0)

  const initialState: PhysicsState = useMemo(() => {
    const verticalRadians = THREE.MathUtils.degToRad(launchAngle)
    const horizontalRadians =
      THREE.MathUtils.degToRad(horizontalDirection)

    const horizontalSpeed = speed * Math.cos(verticalRadians)

    return {
      position: {
        x: positionX,
        y: launchHeight,
        z: positionZ,
      },
      velocity: {
        x: horizontalSpeed * Math.sin(horizontalRadians),
        y: speed * Math.sin(verticalRadians),
        z: -horizontalSpeed * Math.cos(horizontalRadians),
      },
    }
  }, [
    speed,
    launchAngle,
    horizontalDirection,
    positionX,
    positionZ,
    launchHeight,
  ])

  // Direction describes WHERE the drift comes FROM.
  // Actual air movement travels in the opposite direction.
  const windVelocity = useMemo(() => {
    const radians = THREE.MathUtils.degToRad(driftDirection)

    return {
      x: -driftAmount * Math.sin(radians),
      y: 0,
      z: driftAmount * Math.cos(radians),
    }
  }, [driftAmount, driftDirection])

  const normalParameters = DEFAULT_PARAMETERS

  const driftParameters = useMemo(
    () => ({
      ...DEFAULT_PARAMETERS,
      windVelocity,
    }),
    [windVelocity]
  )

  const normalTrajectory = useMemo(
    () =>
      simulateTrajectory(
        initialState,
        normalParameters,
        1 / 240,
        5,
        0.3
      ),
    [initialState]
  )

  const driftTrajectory = useMemo(
    () =>
      simulateTrajectory(
        initialState,
        driftParameters,
        1 / 240,
        5,
        0.3
      ),
    [initialState, driftParameters]
  )

  const normalPathPoints = useMemo(
    () =>
      normalTrajectory.map(
        point =>
          new THREE.Vector3(
            point.position.x,
            point.position.y,
            point.position.z
          )
      ),
    [normalTrajectory]
  )

  const driftPathPoints = useMemo(
    () =>
      driftTrajectory.map(
        point =>
          new THREE.Vector3(
            point.position.x,
            point.position.y,
            point.position.z
          )
      ),
    [driftTrajectory]
  )

  // Find the final landing position.
  const landingPoint =
    driftTrajectory.length > 0
      ? driftTrajectory[driftTrajectory.length - 1]
      : null

  useEffect(() => {
    elapsed.current = 0
    currentIndex.current = 0

    if (shuttleRef.current) {
      shuttleRef.current.position.set(
        positionX,
        launchHeight,
        positionZ
      )
    }
  }, [
    initialState,
    driftAmount,
    driftDirection,
  ])

  useFrame((_, delta) => {
    if (driftTrajectory.length === 0 || !shuttleRef.current) return

    elapsed.current += delta

    while (
      currentIndex.current < driftTrajectory.length - 1 &&
      driftTrajectory[currentIndex.current + 1].time <= elapsed.current
    ) {
      currentIndex.current++
    }

    if (
      elapsed.current >=
      driftTrajectory[driftTrajectory.length - 1].time
    ) {
      elapsed.current = 0
      currentIndex.current = 0
    }

    const point = driftTrajectory[currentIndex.current]

    shuttleRef.current.position.set(
      point.position.x,
      point.position.y,
      point.position.z
    )
  })

  return (
    <>
      {/* Trajectory without drift */}
      {driftAmount > 0 && (
        <Line
          points={normalPathPoints}
          color="#64748b"
          lineWidth={1.5}
        />
      )}

      {/* Actual trajectory with drift */}
      <Line
        points={driftPathPoints}
        color="#ffcc33"
        lineWidth={2}
      />

      {/* Landing position marker */}
      {landingPoint && (
        <group
          position={[
            landingPoint.position.x,
            0.025,
            landingPoint.position.z,
          ]}
        >
          {/* Outer landing ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.16, 0.24, 48]} />
            <meshBasicMaterial
              color="#22d3ee"
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Center of landing marker */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 48]} />
            <meshBasicMaterial
              color="#22d3ee"
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* Animated shuttlecock */}
      <group
        ref={shuttleRef}
        position={[
          initialState.position.x,
          initialState.position.y,
          initialState.position.z,
        ]}
      >
        <Shuttlecock />
      </group>
    </>
  )
}
