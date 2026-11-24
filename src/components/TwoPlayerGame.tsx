
import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import Court from './Court'

type PlayerNumber = 1 | 2

interface PlayerProps {
  color: string
}

interface GameControls {
  hit: (player: PlayerNumber) => void
  newRally: () => void
}

interface GameCourtProps {
  started: boolean
  matchOver: boolean
  server: PlayerNumber
  onStatusChange: (message: string) => void
  onPoint: (player: PlayerNumber) => void
  keys: React.MutableRefObject<Record<string, boolean>>
  controlRef: React.MutableRefObject<GameControls | null>
}

function Player({ color }: PlayerProps) {
  return (
    <group>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 1.1, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#f1c7a5" />
      </mesh>

      <group position={[0.38, 0.75, 0]}>
        <mesh rotation={[0, 0, -0.4]}>
          <torusGeometry args={[0.23, 0.025, 8, 24]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>

        <mesh position={[0.12, -0.22, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.35, 8]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
      </group>
    </group>
  )
}

function Shuttlecock() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.14, 0.32, 10]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color="#d6a66a" />
      </mesh>
    </group>
  )
}

function GameCourt({
  started,
  matchOver,
  server,
  onStatusChange,
  onPoint,
  keys,
  controlRef,
}: GameCourtProps) {
  const playerOne = useRef<THREE.Group>(null!)
  const playerTwo = useRef<THREE.Group>(null!)
  const shuttle = useRef<THREE.Group>(null!)

  const shuttleVelocity = useRef(new THREE.Vector3())
  const inFlight = useRef(false)
  const rallyOver = useRef(false)
  const lastHitBy = useRef<PlayerNumber | null>(null)

  const attemptHit = useCallback(
    (playerNumber: PlayerNumber) => {
      if (!started || matchOver || rallyOver.current) return

      if (
        inFlight.current &&
        lastHitBy.current === playerNumber
      ) {
        return
      }

      if (!inFlight.current && playerNumber !== server) {
        onStatusChange(`Player ${server} serves this rally!`)
        return
      }

      const player =
        playerNumber === 1
          ? playerOne.current
          : playerTwo.current

      if (!player || !shuttle.current) return

      const birdiePosition = shuttle.current.position

      const correctSide =
        playerNumber === 1
          ? birdiePosition.z >= 0
          : birdiePosition.z < 0

      if (!correctSide) {
        onStatusChange('The birdie is on the other player’s side!')
        return
      }

      const playerReachPosition = new THREE.Vector3(
        player.position.x,
        1.0,
        player.position.z
      )

      const distance = playerReachPosition.distanceTo(birdiePosition)

      if (distance > 2.6 || birdiePosition.y > 3.8) {
        onStatusChange('Move closer to the birdie to hit it!')
        return
      }

      let aimDirection = 0

      if (playerNumber === 1) {
        if (keys.current['q']) aimDirection -= 1
        if (keys.current['e']) aimDirection += 1
      } else {
        if (keys.current['u']) aimDirection -= 1
        if (keys.current['o']) aimDirection += 1
      }

      const targetX =
        aimDirection < 0
          ? -1.8
          : aimDirection > 0
            ? 1.8
            : THREE.MathUtils.clamp(
                -player.position.x * 0.3,
                -1.0,
                1.0
              )

      const targetZ = playerNumber === 1 ? -4.8 : 4.8

      // Existing automatic shot physics
      const verticalSpeed = 6.5
      const groundHeight = 0.16

      const height = Math.max(
        0,
        birdiePosition.y - groundHeight
      )

      const flightTime =
        (
          verticalSpeed +
          Math.sqrt(
            verticalSpeed * verticalSpeed +
              2 * 9.81 * height
          )
        ) / 9.81

      const correction = 0.85

      const xVelocity =
        ((targetX - birdiePosition.x) / flightTime) *
        correction

      const zVelocity =
        ((targetZ - birdiePosition.z) / flightTime) *
        correction

      shuttleVelocity.current.set(
        xVelocity,
        verticalSpeed,
        zVelocity
      )

      inFlight.current = true
      lastHitBy.current = playerNumber

      onStatusChange(
        `Player ${playerNumber} hit! Get ready for the return.`
      )
    },
    [started, matchOver, server, onStatusChange, keys]
  )

  const finishPoint = useCallback(
    (winner: PlayerNumber, message: string) => {
      if (rallyOver.current) return

      rallyOver.current = true
      inFlight.current = false
      shuttleVelocity.current.set(0, 0, 0)

      onPoint(winner)
      onStatusChange(message)
    },
    [onPoint, onStatusChange]
  )

  const startNextRally = useCallback(() => {
    if (!rallyOver.current || matchOver || !started) return

    if (shuttle.current) {
      shuttle.current.position.set(
        0,
        1.4,
        server === 1 ? 4.2 : -4.2
      )
    }

    shuttleVelocity.current.set(0, 0, 0)
    inFlight.current = false
    rallyOver.current = false
    lastHitBy.current = null

    onStatusChange(
      `New rally! Player ${server} serves.`
    )
  }, [server, matchOver, started, onStatusChange])

  useEffect(() => {
    controlRef.current = {
      hit: attemptHit,
      newRally: startNextRally,
    }

    return () => {
      controlRef.current = null
    }
  }, [attemptHit, startNextRally, controlRef])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if (key.startsWith('arrow') || key === ' ') {
        event.preventDefault()
      }

      keys.current[key] = true

      if (!started || matchOver) return

      if ((key === 'r' || key === 'm') && !event.repeat) {
        if (key === 'r') attemptHit(1)
        else attemptHit(2)
      }

      if (key === ' ' && !event.repeat) {
        startNextRally()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if (key.startsWith('arrow') || key === ' ') {
        event.preventDefault()
      }

      keys.current[key] = false
    }

    const handleBlur = () => {
      keys.current = {}
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [
    started,
    matchOver,
    keys,
    attemptHit,
    startNextRally,
  ])

  useEffect(() => {
    if (!started || matchOver) {
      keys.current = {}
    }
  }, [started, matchOver, keys])

  useFrame((_, delta) => {
    if (
      !playerOne.current ||
      !playerTwo.current ||
      !shuttle.current
    ) {
      return
    }

    const dt = Math.min(delta, 0.05)
    const speed = 5 * dt

    if (started && !matchOver && !rallyOver.current) {
      // Player 1 movement
      if (keys.current['w']) playerOne.current.position.z -= speed
      if (keys.current['s']) playerOne.current.position.z += speed
      if (keys.current['a']) playerOne.current.position.x -= speed
      if (keys.current['d']) playerOne.current.position.x += speed

      // Player 2 movement
      if (keys.current['arrowup']) playerTwo.current.position.z -= speed
      if (keys.current['arrowdown']) playerTwo.current.position.z += speed
      if (keys.current['arrowleft']) playerTwo.current.position.x -= speed
      if (keys.current['arrowright']) playerTwo.current.position.x += speed
    }

    playerOne.current.position.x = THREE.MathUtils.clamp(
      playerOne.current.position.x,
      -2.4,
      2.4
    )

    playerOne.current.position.z = THREE.MathUtils.clamp(
      playerOne.current.position.z,
      0.6,
      6.1
    )

    playerTwo.current.position.x = THREE.MathUtils.clamp(
      playerTwo.current.position.x,
      -2.4,
      2.4
    )

    playerTwo.current.position.z = THREE.MathUtils.clamp(
      playerTwo.current.position.z,
      -6.1,
      -0.6
    )

    if (started && inFlight.current && !rallyOver.current) {
      shuttleVelocity.current.y -= 9.81 * dt

      shuttle.current.position.addScaledVector(
        shuttleVelocity.current,
        dt
      )

      shuttleVelocity.current.multiplyScalar(
        Math.max(0, 1 - 0.04 * dt)
      )

      if (shuttle.current.position.y <= 0.16) {
        shuttle.current.position.y = 0.16

        const winner: PlayerNumber =
          lastHitBy.current ??
          (shuttle.current.position.z >= 0 ? 2 : 1)

        finishPoint(
          winner,
          `Point to Player ${winner}! The shuttle landed before the return.`
        )
      }
    }
  })

  return (
    <>
      <Court />

      <group ref={playerOne} position={[0, 0, 4.5]}>
        <Player color="#22c55e" />
      </group>

      <group ref={playerTwo} position={[0, 0, -4.5]}>
        <Player color="#3b82f6" />
      </group>

      <group ref={shuttle} position={[0, 1.4, 4.2]}>
        <Shuttlecock />
      </group>
    </>
  )
}

// A button that keeps a movement or aim key active while held.
function HoldButton({
  label,
  keyName,
  keys,
  className = '',
}: {
  label: string
  keyName: string
  keys: React.MutableRefObject<Record<string, boolean>>
  className?: string
}) {
  const release = () => {
    keys.current[keyName] = false
  }

  return (
    <button
      type="button"
      className={`touch-control ${className}`}
      onPointerDown={event => {
        event.preventDefault()
        keys.current[keyName] = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={event => event.preventDefault()}
    >
      {label}
    </button>
  )
}

function MobilePlayerControls({
  player,
  keys,
  controlRef,
  disabled,
}: {
  player: PlayerNumber
  keys: React.MutableRefObject<Record<string, boolean>>
  controlRef: React.MutableRefObject<GameControls | null>
  disabled: boolean
}) {
  const isOne = player === 1

  const movementKeys = isOne
    ? { up: 'w', down: 's', left: 'a', right: 'd' }
    : {
        up: 'arrowup',
        down: 'arrowdown',
        left: 'arrowleft',
        right: 'arrowright',
      }

  const aimKeys = isOne
    ? { left: 'q', right: 'e' }
    : { left: 'u', right: 'o' }

  return (
    <div className={`mobile-player-controls player-${player}`}>
      <div className="mobile-control-heading">
        <span>{`PLAYER ${player}`}</span>
        <span>{isOne ? 'GREEN' : 'BLUE'}</span>
      </div>

      <div className="mobile-control-content">
        <div className="mobile-dpad">
          <div />
          <HoldButton label="▲" keyName={movementKeys.up} keys={keys} />
          <div />

          <HoldButton label="◀" keyName={movementKeys.left} keys={keys} />
          <div className="dpad-center">MOVE</div>
          <HoldButton label="▶" keyName={movementKeys.right} keys={keys} />

          <div />
          <HoldButton label="▼" keyName={movementKeys.down} keys={keys} />
          <div />
        </div>

        <div className="mobile-action-controls">
          <div className="mobile-aim-row">
            <HoldButton
              label="AIM ◀"
              keyName={aimKeys.left}
              keys={keys}
              className="aim-button"
            />
            <HoldButton
              label="AIM ▶"
              keyName={aimKeys.right}
              keys={keys}
              className="aim-button"
            />
          </div>

          <button
            type="button"
            className="mobile-hit-button"
            disabled={disabled}
            onClick={() => controlRef.current?.hit(player)}
          >
            HIT
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TwoPlayerGame() {
  const [started, setStarted] = useState(false)
  const [matchOver, setMatchOver] = useState(false)

  const [status, setStatus] = useState(
    'Welcome! Read the rules to begin.'
  )

  const [scores, setScores] = useState({
    playerOne: 0,
    playerTwo: 0,
  })

  const [server, setServer] = useState<PlayerNumber>(1)
  const [matchWinner, setMatchWinner] = useState<PlayerNumber | null>(null)

  const keys = useRef<Record<string, boolean>>({})
  const controlRef = useRef<GameControls | null>(null)

  const handleStatusChange = useCallback((message: string) => {
    setStatus(message)
  }, [])

  const handlePoint = useCallback((winner: PlayerNumber) => {
    setServer(winner)

    setScores(previous => ({
      playerOne: previous.playerOne + (winner === 1 ? 1 : 0),
      playerTwo: previous.playerTwo + (winner === 2 ? 1 : 0),
    }))
  }, [])

  useEffect(() => {
    const highest = Math.max(scores.playerOne, scores.playerTwo)
    const difference = Math.abs(scores.playerOne - scores.playerTwo)

    if (highest >= 11 && difference >= 2 && !matchOver) {
      const winningPlayer: PlayerNumber =
        scores.playerOne > scores.playerTwo ? 1 : 2

      setMatchWinner(winningPlayer)
      setMatchOver(true)
      setStatus(`Player ${winningPlayer} wins the match!`)
    }
  }, [scores, matchOver])

  const resetMatch = () => {
    keys.current = {}
    setScores({ playerOne: 0, playerTwo: 0 })
    setServer(1)
    setMatchWinner(null)
    setMatchOver(false)
    setStarted(false)
    setStatus('Welcome! Read the rules to begin.')
  }

  const startGame = () => {
    keys.current = {}
    setScores({ playerOne: 0, playerTwo: 0 })
    setServer(1)
    setMatchWinner(null)
    setMatchOver(false)
    setStarted(true)
    setStatus('Player 1 serves! Move close and tap HIT.')
  }

  const disabledControls = !started || matchOver

  return (
    <div className="two-player-layout">
      <style>{`
        .two-player-layout {
          width: 100%;
          min-height: 650px;
          position: relative;
          display: flex;
          gap: 14px;
          align-items: stretch;
          color: white;
        }

        .game-court-panel {
          flex: 1;
          min-width: 0;
          height: 650px;
          position: relative;
          border-radius: 14px;
          overflow: hidden;
          background: #071426;
        }

        .game-scoreboard {
          width: 175px;
          flex-shrink: 0;
          border-radius: 14px;
          padding: 18px 14px;
          background: #0d1b2d;
          color: white;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .mobile-controls {
          display: none;
        }

        .touch-control {
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 9px;
          background: #263b55;
          color: white;
          font-weight: 800;
          font-size: 18px;
          min-width: 42px;
          min-height: 42px;
          padding: 8px;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .touch-control:active {
          background: #45617f;
        }

        .mobile-player-controls {
          flex: 1;
          min-width: 0;
          border-radius: 12px;
          padding: 10px;
          background: #0d1b2d;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .mobile-control-heading {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .player-1 .mobile-control-heading {
          color: #22c55e;
        }

        .player-2 .mobile-control-heading {
          color: #60a5fa;
        }

        .mobile-control-content {
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 8px;
        }

        .mobile-dpad {
          display: grid;
          grid-template-columns: repeat(3, 42px);
          grid-template-rows: repeat(3, 42px);
          gap: 3px;
          justify-content: center;
          align-items: center;
        }

        .dpad-center {
          display: flex;
          justify-content: center;
          align-items: center;
          color: #aab8ca;
          font-size: 9px;
          font-weight: 800;
        }

        .mobile-action-controls {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          gap: 9px;
        }

        .mobile-aim-row {
          display: flex;
          gap: 5px;
        }

        .aim-button {
          flex: 1;
          font-size: 11px;
          min-width: 0;
          padding: 7px 3px;
        }

        .mobile-hit-button {
          width: 100%;
          min-height: 48px;
          border: none;
          border-radius: 9px;
          color: #061426;
          font-size: 16px;
          font-weight: 900;
          background: #facc15;
          touch-action: manipulation;
        }

        .mobile-hit-button:disabled {
          opacity: 0.4;
        }

        .mobile-hit-button:active {
          filter: brightness(0.85);
        }

        .mobile-next-rally {
          display: none;
        }

        @media (max-width: 700px) {
          .two-player-layout {
            flex-direction: column;
            gap: 10px;
            min-height: 0;
          }

          .game-court-panel {
            flex: none;
            width: 100%;
            height: 58vh;
            min-height: 360px;
            max-height: 540px;
            border-radius: 12px;
          }

          .game-scoreboard {
            box-sizing: border-box;
            width: 100%;
            padding: 10px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            align-items: center;
          }

          .game-scoreboard h3 {
            grid-column: 1 / -1;
            font-size: 13px;
          }

          .game-scoreboard .score-card {
            padding: 8px 4px !important;
          }

          .game-scoreboard .score-number {
            font-size: 27px !important;
          }

          .game-scoreboard .server-card {
            padding: 8px 4px !important;
          }

          .game-scoreboard .match-info {
            grid-column: 1 / 2;
            font-size: 10px;
          }

          .game-scoreboard .reset-button {
            grid-column: 2 / 4;
          }

          .mobile-controls {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }

          .mobile-control-panels {
            display: flex;
            gap: 8px;
            width: 100%;
          }

          .mobile-next-rally {
            display: block;
            width: 100%;
            min-height: 44px;
            border: none;
            border-radius: 9px;
            background: #22c55e;
            color: #052e16;
            font-weight: 900;
            font-size: 14px;
          }

          .mobile-next-rally:disabled {
            opacity: 0.4;
          }

          .desktop-instructions {
            display: none !important;
          }
        }

        @media (max-width: 390px) {
          .mobile-player-controls {
            padding: 7px 5px;
          }

          .mobile-dpad {
            grid-template-columns: repeat(3, 35px);
            grid-template-rows: repeat(3, 38px);
          }

          .touch-control {
            min-width: 35px;
            min-height: 38px;
            font-size: 15px;
            padding: 5px;
          }

          .aim-button {
            font-size: 9px;
          }

          .mobile-hit-button {
            min-height: 43px;
            font-size: 14px;
          }
        }
      `}</style>

      <div className="game-court-panel">
        <Canvas
          camera={{
            position: [0, 15, 0],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 12, 5]} intensity={1.5} />

          <GameCourt
            started={started}
            matchOver={matchOver}
            server={server}
            onStatusChange={handleStatusChange}
            onPoint={handlePoint}
            keys={keys}
            controlRef={controlRef}
          />

          <OrbitControls
            target={[0, 0, 0]}
            enableRotate={false}
            enablePan={false}
            minDistance={15}
            maxDistance={20}
          />
        </Canvas>

        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(10, 20, 35, 0.88)',
            color: 'white',
            textAlign: 'center',
            pointerEvents: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          {status}
        </div>

        <div
          className="desktop-instructions"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            color: 'white',
            pointerEvents: 'none',
            fontWeight: 600,
            textShadow: '0 1px 4px black',
            fontSize: '12px',
          }}
        >
          <span>Player 1: WASD | R | Q/E</span>
          <span>Player 2: Arrows | M | U/O</span>
        </div>
      </div>

      <div className="game-scoreboard">
        <h3 style={{ margin: 0, textAlign: 'center' }}>
          SCOREBOARD
        </h3>

        <div
          className="score-card"
          style={{
            padding: '14px 10px',
            borderRadius: '10px',
            background: 'rgba(34, 197, 94, 0.12)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#22c55e', fontWeight: 700 }}>
            PLAYER 1
          </div>
          <div className="score-number" style={{ fontSize: '38px', fontWeight: 800 }}>
            {scores.playerOne}
          </div>
        </div>

        <div
          className="score-card"
          style={{
            padding: '14px 10px',
            borderRadius: '10px',
            background: 'rgba(59, 130, 246, 0.12)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#60a5fa', fontWeight: 700 }}>
            PLAYER 2
          </div>
          <div className="score-number" style={{ fontSize: '38px', fontWeight: 800 }}>
            {scores.playerTwo}
          </div>
        </div>

        <div
          className="server-card"
          style={{
            padding: '12px 8px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)',
            textAlign: 'center',
            fontSize: '13px',
          }}
        >
          <div style={{ color: '#aab8ca' }}>NEXT SERVER</div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: server === 1 ? '#22c55e' : '#60a5fa',
              marginTop: '4px',
            }}
          >
            PLAYER {server}
          </div>
        </div>

        <div
          className="match-info"
          style={{
            marginTop: 'auto',
            fontSize: '12px',
            color: '#aab8ca',
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          First to 11 points
          <br />
          Win by 2 points
        </div>

        <button
          className="reset-button"
          onClick={resetMatch}
          style={{
            border: 'none',
            borderRadius: '8px',
            padding: '10px',
            background: '#24364d',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Reset Match
        </button>
      </div>

      {/* TOUCHSCREEN CONTROLS */}
      <div className="mobile-controls">
        <div className="mobile-control-panels">
          <MobilePlayerControls
            player={1}
            keys={keys}
            controlRef={controlRef}
            disabled={disabledControls}
          />

          <MobilePlayerControls
            player={2}
            keys={keys}
            controlRef={controlRef}
            disabled={disabledControls}
          />
        </div>

        <button
          type="button"
          className="mobile-next-rally"
          disabled={!started || matchOver}
          onClick={() => controlRef.current?.newRally()}
        >
          START NEXT RALLY
        </button>
      </div>

      {/* RULES POPUP */}
      {!started && !matchOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(2, 8, 20, 0.88)',
            borderRadius: '14px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              maxHeight: '90%',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: '16px',
              background: '#10243b',
              color: 'white',
            }}
          >
            <h2 style={{ marginTop: 0, textAlign: 'center' }}>
              Two Player Badminton
            </h2>

            <p style={{ color: '#cbd5e1', textAlign: 'center' }}>
              First to 11 points, win by 2.
            </p>

            <h3>Player 1 — Green</h3>
            <ul>
              <li>Desktop: WASD to move, R to hit, Q/E to aim.</li>
              <li>Phone: Use the left touchscreen control panel.</li>
            </ul>

            <h3>Player 2 — Blue</h3>
            <ul>
              <li>Desktop: Arrow keys to move, M to hit, U/O to aim.</li>
              <li>Phone: Use the right touchscreen control panel.</li>
            </ul>

            <h3>Rules</h3>
            <ul>
              <li>Player 1 serves first.</li>
              <li>The winner of each point serves next.</li>
              <li>Move close enough to the shuttle before hitting.</li>
              <li>Every hit uses automatic power and height.</li>
              <li>Shots automatically target the opponent's singles court.</li>
              <li>A point is awarded when the shuttle lands before the opponent returns it.</li>
              <li>On a phone, tap START NEXT RALLY after each point.</li>
              <li>On a computer, press SPACE after each point.</li>
              <li>Win by 2 points after reaching 11.</li>
            </ul>

            <button
              onClick={startGame}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '10px',
                padding: '14px',
                marginTop: '12px',
                background: '#22c55e',
                color: '#052e16',
                fontWeight: 800,
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Start Game
            </button>
          </div>
        </div>
      )}

      {/* WINNING SCREEN */}
      {matchOver && matchWinner !== null && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(2, 8, 20, 0.9)',
            borderRadius: '14px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '32px 24px',
              borderRadius: '18px',
              background: '#10243b',
              color: 'white',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '48px' }}>🏆</div>

            <h1 style={{ marginBottom: '8px' }}>
              Player {matchWinner} Wins!
            </h1>

            <p style={{ color: '#cbd5e1' }}>Final Score</p>

            <div
              style={{
                fontSize: '34px',
                fontWeight: 800,
                margin: '12px 0 24px',
              }}
            >
              {scores.playerOne} - {scores.playerTwo}
            </div>

            <button
              onClick={resetMatch}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '10px',
                padding: '14px',
                background: '#22c55e',
                color: '#052e16',
                fontWeight: 800,
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
