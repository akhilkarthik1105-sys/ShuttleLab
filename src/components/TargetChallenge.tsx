
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import Court from './Court'
import Shuttlecock from './Shuttlecock'
import { DEFAULT_PARAMETERS } from '../physics/model'
import type { PhysicsState } from '../physics/model'
import { simulateTrajectory } from '../physics/simulation'

const MPH_TO_MS = 0.44704
const TOTAL_ROUNDS = 10
const NET_HEIGHT = 1.524

const SINGLES_HALF_WIDTH = 2.59
const OPPONENT_BASELINE = -6.7

interface Target {
  x: number
  z: number
}

interface LandingResult {
  x: number
  z: number
  distance: number
  points: number
  basePoints: number
  wideBonus: number
  reason: string | null
}

function createTarget(): Target {
  return {
    x: Number((Math.random() * 4 - 2).toFixed(2)),
    z: Number((-0.8 - Math.random() * 5.2).toFixed(2)),
  }
}

function calculateAccuracyScore(distance: number): number {
  if (distance <= 0.65) return 100
  if (distance <= 1.15) return 80
  if (distance <= 1.8) return 55
  if (distance <= 2.5) return 30
  return 0
}

function calculateWideBonus(targetX: number): number {
  const distanceFromCenter = Math.abs(targetX)

  if (distanceFromCenter >= 1.6) return 25
  if (distanceFromCenter >= 1.1) return 15
  if (distanceFromCenter >= 0.6) return 5

  return 0
}

interface GameSceneProps {
  speed: number
  launchAngle: number
  horizontalDirection: number
  target: Target
  attemptId: number
  onLanded: (x: number, z: number, clearedNet: boolean) => void
}

function GameScene({
  speed,
  launchAngle,
  horizontalDirection,
  target,
  attemptId,
  onLanded,
}: GameSceneProps) {
  const shuttleRef = useRef<THREE.Group>(null!)
  const elapsed = useRef(0)
  const currentIndex = useRef(0)
  const hasLanded = useRef(false)

  const initialState: PhysicsState = useMemo(() => {
    const speedMS = speed * MPH_TO_MS
    const verticalRadians = THREE.MathUtils.degToRad(launchAngle)
    const horizontalRadians = THREE.MathUtils.degToRad(horizontalDirection)

    const horizontalSpeed = speedMS * Math.cos(verticalRadians)

    return {
      position: {
        x: 0,
        y: 2,
        z: 5.5,
      },
      velocity: {
        x: horizontalSpeed * Math.sin(horizontalRadians),
        y: speedMS * Math.sin(verticalRadians),
        z: -horizontalSpeed * Math.cos(horizontalRadians),
      },
    }
  }, [speed, launchAngle, horizontalDirection])

  const trajectory = useMemo(
    () => simulateTrajectory(
      initialState,
      DEFAULT_PARAMETERS,
      1 / 240,
      5,
      0.3
    ),
    [initialState]
  )

  const pathPoints = useMemo(
    () => trajectory.map(
      point => new THREE.Vector3(
        point.position.x,
        point.position.y,
        point.position.z
      )
    ),
    [trajectory]
  )

  // Check whether the shuttle crosses the net above its height.
  const clearedNet = useMemo(() => {
    for (let i = 1; i < trajectory.length; i++) {
      const previous = trajectory[i - 1]
      const current = trajectory[i]

      if (
        previous.position.z > 0 &&
        current.position.z <= 0
      ) {
        const fraction =
          previous.position.z /
          (previous.position.z - current.position.z)

        const heightAtNet =
          previous.position.y +
          (current.position.y - previous.position.y) * fraction

        return heightAtNet >= NET_HEIGHT
      }
    }

    return false
  }, [trajectory])

  useEffect(() => {
    elapsed.current = 0
    currentIndex.current = 0
    hasLanded.current = false

    if (shuttleRef.current) {
      shuttleRef.current.position.set(0, 2, 5.5)
    }
  }, [attemptId, trajectory])

  useFrame((_, delta) => {
    if (attemptId === 0 || hasLanded.current || !shuttleRef.current) {
      return
    }

    elapsed.current += delta

    while (
      currentIndex.current < trajectory.length - 1 &&
      trajectory[currentIndex.current + 1].time <= elapsed.current
    ) {
      currentIndex.current++
    }

    const point = trajectory[currentIndex.current]

    shuttleRef.current.position.set(
      point.position.x,
      point.position.y,
      point.position.z
    )

    if (currentIndex.current >= trajectory.length - 1) {
      hasLanded.current = true

      onLanded(
        point.position.x,
        point.position.z,
        clearedNet
      )
    }
  })

  return (
    <>
      {/* Target zone */}
      <group position={[target.x, 0.045, target.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.55, 48]} />
          <meshBasicMaterial
            color="#22c55e"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.43, 0.5, 48]} />
          <meshBasicMaterial
            color="#4ade80"
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.17, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Flight path */}
      {attemptId > 0 && (
        <Line
          points={pathPoints}
          color="#ffcc33"
          lineWidth={2}
        />
      )}

      {/* Shuttlecock */}
      <group
        ref={shuttleRef}
        position={[0, 2, 5.5]}
      >
        <Shuttlecock />
      </group>
    </>
  )
}

export default function TargetChallenge() {
  const [speed, setSpeed] = useState(65)
  const [launchAngle, setLaunchAngle] = useState(12)
  const [horizontalDirection, setHorizontalDirection] = useState(0)

  const [target, setTarget] = useState<Target>(createTarget)
  const [round, setRound] = useState(1)
  const [totalScore, setTotalScore] = useState(0)
  const [attemptId, setAttemptId] = useState(0)
  const [result, setResult] = useState<LandingResult | null>(null)

  const scoredAttemptRef = useRef(-1)

  const gameOver = round > TOTAL_ROUNDS

  const handleLanding = useCallback((
    x: number,
    z: number,
    clearedNet: boolean
  ) => {
    if (scoredAttemptRef.current === attemptId) return

    scoredAttemptRef.current = attemptId

    const distance = Math.sqrt(
      Math.pow(x - target.x, 2) +
      Math.pow(z - target.z, 2)
    )

    const insideCourt =
      Math.abs(x) <= SINGLES_HALF_WIDTH &&
      z < 0 &&
      z >= OPPONENT_BASELINE

    let reason: string | null = null
    let basePoints = 0
    let wideBonus = 0

    if (!clearedNet) {
      reason = 'The shuttle did not clear the net.'
    } else if (!insideCourt) {
      reason = 'The shuttle landed outside the opponent’s court.'
    } else {
      basePoints = calculateAccuracyScore(distance)

      if (basePoints > 0) {
        wideBonus = calculateWideBonus(target.x)
      }
    }

    const points = basePoints + wideBonus

    setResult({
      x,
      z,
      distance,
      points,
      basePoints,
      wideBonus,
      reason,
    })

    setTotalScore(current => current + points)
  }, [target, attemptId])

  const launchShot = () => {
    if (result || gameOver) return

    setAttemptId(current => current + 1)
  }

  const nextRound = () => {
    if (round >= TOTAL_ROUNDS) {
      setRound(TOTAL_ROUNDS + 1)
      return
    }

    scoredAttemptRef.current = -1
    setRound(current => current + 1)
    setTarget(createTarget())
    setResult(null)
    setAttemptId(0)
  }

  const restartGame = () => {
    scoredAttemptRef.current = -1
    setRound(1)
    setTotalScore(0)
    setTarget(createTarget())
    setResult(null)
    setAttemptId(0)
    setSpeed(65)
    setLaunchAngle(12)
    setHorizontalDirection(0)
  }

  return (
    <div className="target-challenge">
      <div className="challenge-header">
        <div>
          <h1>Target Challenge</h1>
          <p>Clear the net, land in bounds, and hit your target.</p>
        </div>

        <div className="challenge-stats">
          <div className="challenge-stat">
            <span>ROUND</span>
            <strong>{Math.min(round, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}</strong>
          </div>

          <div className="challenge-stat">
            <span>TOTAL SCORE</span>
            <strong>{totalScore}</strong>
          </div>
        </div>
      </div>

      {gameOver ? (
        <div className="challenge-finish">
          <h2>Game Complete!</h2>
          <div className="final-score">{totalScore}</div>
          <p>Your final score out of 1,250 points</p>

          <button onClick={restartGame}>
            Play Again
          </button>
        </div>
      ) : (
        <>
          <div className="challenge-game-layout">
            <div className="challenge-court">
              <Canvas
                camera={{
                  position: [0, 11, 10],
                  fov: 45,
                }}
                shadows
              >
                <ambientLight intensity={0.8} />

                <directionalLight
                  position={[5, 10, 5]}
                  intensity={1.3}
                  castShadow
                />

                <Court />

                <GameScene
                  speed={speed}
                  launchAngle={launchAngle}
                  horizontalDirection={horizontalDirection}
                  target={target}
                  attemptId={attemptId}
                  onLanded={handleLanding}
                />

                <OrbitControls
                  target={[0, 0, 0]}
                  minDistance={7}
                  maxDistance={20}
                  maxPolarAngle={Math.PI / 2.05}
                />
              </Canvas>
            </div>

            <div className="challenge-controls">
              <h2>Shot Controls</h2>
              <p className="control-description">
                Adjust your shot, then launch toward the target.
              </p>

              <div className="challenge-control">
                <div className="control-heading">
                  <label>Shot Speed</label>
                  <strong>{speed} mph</strong>
                </div>

                <input
                  type="range"
                  min="45"
                  max="100"
                  step="5"
                  value={speed}
                  disabled={!!result}
                  onChange={event => setSpeed(Number(event.target.value))}
                />

                <div className="range-labels">
                  <span>45 mph</span>
                  <span>100 mph</span>
                </div>
              </div>

              <div className="challenge-control">
                <div className="control-heading">
                  <label>Vertical Angle</label>
                  <strong>{launchAngle}°</strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={launchAngle}
                  disabled={!!result}
                  onChange={event => setLaunchAngle(Number(event.target.value))}
                />

                <div className="range-labels">
                  <span>0°</span>
                  <span>30°</span>
                </div>
              </div>

              <div className="challenge-control">
                <div className="control-heading">
                  <label>Horizontal Direction</label>
                  <strong>{horizontalDirection}°</strong>
                </div>

                <input
                  type="range"
                  min="-25"
                  max="25"
                  step="1"
                  value={horizontalDirection}
                  disabled={!!result}
                  onChange={event =>
                    setHorizontalDirection(Number(event.target.value))
                  }
                />

                <div className="range-labels">
                  <span>Left -25°</span>
                  <span>Right +25°</span>
                </div>
              </div>

              <button
                className="launch-button"
                onClick={launchShot}
                disabled={!!result}
              >
                {result ? 'Shot Complete' : 'Launch Shot'}
              </button>

              {result && (
                <div className="shot-result">
                  <h3>Shot Result</h3>

                  <div className="result-points">
                    +{result.points} points
                  </div>

                  {result.reason && (
                    <p>{result.reason} 0 points awarded.</p>
                  )}

                  {!result.reason && (
                    <>
                      <p>
                        Distance from target: {result.distance.toFixed(2)} m
                      </p>
                      <p>
                        Accuracy points: {result.basePoints}
                      </p>
                      <p>
                        Wide target bonus: +{result.wideBonus}
                      </p>
                    </>
                  )}

                  <button
                    className="next-round-button"
                    onClick={nextRound}
                  >
                    {round === TOTAL_ROUNDS ? 'Finish Game' : 'Next Round'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="challenge-scoring">
            <h3>Scoring System</h3>

            <div className="scoring-grid">
              <div><strong>100 pts</strong><span>Within 0.65 m</span></div>
              <div><strong>80 pts</strong><span>Within 1.15 m</span></div>
              <div><strong>55 pts</strong><span>Within 1.8 m</span></div>
              <div><strong>30 pts</strong><span>Within 2.5 m</span></div>
              <div><strong>0 pts</strong><span>Beyond 2.5 m</span></div>
            </div>

            <p>
              Wide target bonus: up to 25 extra points for targets closer
              to the sidelines. The shuttle must clear the net and land
              inside the opponent’s singles court.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
