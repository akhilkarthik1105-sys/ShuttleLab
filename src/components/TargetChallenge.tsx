
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

interface Target {
  x: number
  z: number
}

interface LandingResult {
  x: number
  z: number
  distance: number
  points: number
}

function createTarget(): Target {
  return {
    x: Number((Math.random() * 3.8 - 1.9).toFixed(2)),
    z: Number((-2.6 - Math.random() * 3.5).toFixed(2)),
  }
}

function calculateScore(distance: number): number {
  if (distance <= 0.35) return 100
  if (distance <= 0.75) return 75
  if (distance <= 1.5) return 40
  if (distance <= 2.5) return 10
  return 0
}

interface GameSceneProps {
  speed: number
  launchAngle: number
  horizontalDirection: number
  target: Target
  attemptId: number
  onLanded: (x: number, z: number) => void
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
        point.position.z
      )
    }
  })

  return (
    <>
      {/* Target zone */}
      <group position={[target.x, 0.045, target.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.65, 48]} />
          <meshBasicMaterial
            color="#22c55e"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.48, 0.56, 48]} />
          <meshBasicMaterial
            color="#4ade80"
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.13, 0.18, 32]} />
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
  const [speed, setSpeed] = useState(220)
  const [launchAngle, setLaunchAngle] = useState(10)
  const [horizontalDirection, setHorizontalDirection] = useState(0)

  const [target, setTarget] = useState<Target>(createTarget)
  const [round, setRound] = useState(1)
  const [totalScore, setTotalScore] = useState(0)
  const [attemptId, setAttemptId] = useState(0)
  const [result, setResult] = useState<LandingResult | null>(null)

  const gameOver = round > TOTAL_ROUNDS

  const handleLanding = useCallback((x: number, z: number) => {
    setResult(previous => {
      if (previous) return previous

      const distance = Math.sqrt(
        Math.pow(x - target.x, 2) +
        Math.pow(z - target.z, 2)
      )

      const points = calculateScore(distance)

      setTotalScore(current => current + points)

      return {
        x,
        z,
        distance,
        points,
      }
    })
  }, [target])

  const launchShot = () => {
    if (result || gameOver) return
    setAttemptId(current => current + 1)
  }

  const nextRound = () => {
    if (round >= TOTAL_ROUNDS) {
      setRound(TOTAL_ROUNDS + 1)
      return
    }

    setRound(current => current + 1)
    setTarget(createTarget())
    setResult(null)
    setAttemptId(0)
  }

  const restartGame = () => {
    setRound(1)
    setTotalScore(0)
    setTarget(createTarget())
    setResult(null)
    setAttemptId(0)
    setSpeed(220)
    setLaunchAngle(10)
    setHorizontalDirection(0)
  }

  return (
    <div className="target-challenge">
      <div className="challenge-header">
        <div>
          <h1>Target Challenge</h1>
          <p>Test your shot accuracy and hit the target.</p>
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
          <p>Your final score out of 1000 points</p>
          <button onClick={restartGame}>
            Play Again
          </button>
        </div>
      ) : (
        <>
          <div className="challenge-game-layout">
            <div className="challenge-court">
              <div className="court-label">
                <span>OPPONENT</span>
                <span>YOUR SIDE</span>
              </div>

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
                  min="100"
                  max="280"
                  step="5"
                  value={speed}
                  disabled={!!result}
                  onChange={event => setSpeed(Number(event.target.value))}
                />

                <div className="range-labels">
                  <span>100 mph</span>
                  <span>280 mph</span>
                </div>
              </div>

              <div className="challenge-control">
                <div className="control-heading">
                  <label>Vertical Angle</label>
                  <strong>{launchAngle}°</strong>
                </div>

                <input
                  type="range"
                  min="-5"
                  max="35"
                  step="1"
                  value={launchAngle}
                  disabled={!!result}
                  onChange={event => setLaunchAngle(Number(event.target.value))}
                />

                <div className="range-labels">
                  <span>-5°</span>
                  <span>35°</span>
                </div>
              </div>

              <div className="challenge-control">
                <div className="control-heading">
                  <label>Horizontal Direction</label>
                  <strong>{horizontalDirection}°</strong>
                </div>

                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={horizontalDirection}
                  disabled={!!result}
                  onChange={event =>
                    setHorizontalDirection(Number(event.target.value))
                  }
                />

                <div className="range-labels">
                  <span>Left -30°</span>
                  <span>Right +30°</span>
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

                  <p>
                    Distance from target: {result.distance.toFixed(2)} m
                  </p>

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
              <div><strong>100 pts</strong><span>Within 0.35 m</span></div>
              <div><strong>75 pts</strong><span>Within 0.75 m</span></div>
              <div><strong>40 pts</strong><span>Within 1.5 m</span></div>
              <div><strong>10 pts</strong><span>Within 2.5 m</span></div>
              <div><strong>0 pts</strong><span>Beyond 2.5 m</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
