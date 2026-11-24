import { useState, useMemo, useEffect } from 'react'
import FlightSimulator from './components/FlightSimulator'
import ShotPresetViewer from './components/ShotPresetViewer'
import TargetChallenge from './components/TargetChallenge'
import TwoPlayerGame from './components/TwoPlayerGame'
import './App.css'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Court from './components/Court'

import {
  DEFAULT_PARAMETERS,
  vectorMagnitude,
} from './physics/model'
import type { PhysicsState } from './physics/model'
import { simulateTrajectory } from './physics/simulation'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type Page = 'home' | 'simulation' | 'shot-presets' | 'games'
type GameSelection = 'menu' | 'one-player' | 'two-player'
type ShotCategory = 'overhead' | 'net' | 'flat'
type ShotDirection = 'straight' | 'crosscourt'
type CameraView = 'side' | 'overhead' | 'player'

interface ShotPresetData {
  id: string
  name: string
  category: ShotCategory
  description: string
  note?: string
}

const shotPresets: ShotPresetData[] = [
  {
    id: 'clear',
    name: 'Clear',
    category: 'overhead',
    description: 'A high, deep shot intended to push your opponent toward the backcourt.',
  },
  {
    id: 'smash',
    name: 'Smash',
    category: 'overhead',
    description: 'A steep attacking shot aimed down into the opponent’s court.',
  },
  {
    id: 'drop',
    name: 'Drop',
    category: 'overhead',
    description: 'A controlled overhead shot that travels into the frontcourt.',
  },
  {
    id: 'slice-drop',
    name: 'Slice Drop',
    category: 'overhead',
    description: 'A disguised drop shot intended to change the shuttle’s direction and pace.',
    note: 'The slicing action and shuttle spin are not represented in this visual.',
  },
  {
    id: 'net-drop',
    name: 'Net Drop',
    category: 'net',
    description: 'A soft shot played close to the net, designed to make the opponent move forward.',
  },
  {
    id: 'net-kill',
    name: 'Net Kill',
    category: 'net',
    description: 'A quick downward attacking shot used when the shuttle is high enough near the net.',
  },
  {
    id: 'net-lift',
    name: 'Net Lift',
    category: 'net',
    description: 'A defensive shot that sends the shuttle high and deep toward the opponent’s backcourt.',
  },
  {
    id: 'spinning-net',
    name: 'Spinning Net',
    category: 'net',
    description: 'A delicate net shot intended to tumble close to the net on the opponent’s side.',
    note: 'The tumbling motion and spin are not represented in this visual.',
  },
  {
    id: 'drive',
    name: 'Drive',
    category: 'flat',
    description: 'A fast, relatively flat shot that travels through the middle or side of the court.',
  },
  {
    id: 'defensive-block',
    name: 'Defensive Block',
    category: 'flat',
    description: 'A controlled response that redirects an attacking shot into the opponent’s court.',
  },
]

const categoryLabels: Record<ShotCategory, string> = {
  overhead: 'Overhead',
  net: 'Net',
  flat: 'Flat / Defensive',
}

function SimulationCamera({ view }: { view: CameraView }) {
  const { camera } = useThree()

  useEffect(() => {
    const cameraPositions: Record<CameraView, [number, number, number]> = {
      side: [13, 5, 0],
      overhead: [0, 18, 0.001],
      player: [0, 5, 13],
    }

    const position = cameraPositions[view]

    camera.position.set(position[0], position[1], position[2])
    camera.up.set(0, 1, view === 'overhead' ? -1 : 0)
    camera.lookAt(0, 1, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }, [view, camera])

  return null
}

function App() {
  const [activePage, setActivePage] = useState<Page>('home')
  const [gameSelection, setGameSelection] = useState<GameSelection>('menu')

  // Simulation controls
  const [speed, setSpeed] = useState(20)
  const [launchAngle, setLaunchAngle] = useState(25)
  const [horizontalDirection, setHorizontalDirection] = useState(0)

  const [positionX, setPositionX] = useState(0)
  const [positionZ, setPositionZ] = useState(5.5)
  const [launchHeight, setLaunchHeight] = useState(2)

  const [driftAmount, setDriftAmount] = useState(0)
  const [driftDirection, setDriftDirection] = useState(0)

  const [cameraView, setCameraView] = useState<CameraView>('player')

  // Shot preset controls
  const [selectedCategory, setSelectedCategory] = useState<ShotCategory>('overhead')
  const [selectedShotId, setSelectedShotId] = useState('clear')
  const [selectedDirection, setSelectedDirection] = useState<ShotDirection>('straight')

  const initialState: PhysicsState = useMemo(() => {
    const verticalRadians = (launchAngle * Math.PI) / 180
    const horizontalRadians = (horizontalDirection * Math.PI) / 180
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
        z: -horizontalSpeed * Math.cos(verticalRadians),
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

  const windVelocity = useMemo(() => {
    const radians = (driftDirection * Math.PI) / 180

    return {
      x: -driftAmount * Math.sin(radians),
      y: 0,
      z: driftAmount * Math.cos(radians),
    }
  }, [driftAmount, driftDirection])

  const driftParameters = useMemo(
    () => ({
      ...DEFAULT_PARAMETERS,
      windVelocity,
    }),
    [windVelocity]
  )

  const flightResults = useMemo(() => {
    const trajectory = simulateTrajectory(
      initialState,
      driftParameters,
      1 / 240,
      5,
      0.3
    )

    if (trajectory.length === 0) return null

    const finalPoint = trajectory[trajectory.length - 1]

    const maximumHeight = Math.max(
      ...trajectory.map(point => point.position.y)
    )

    const initialSpeed = vectorMagnitude(initialState.velocity)
    const finalSpeed = vectorMagnitude(finalPoint.velocity)

    const horizontalDistance = Math.hypot(
      finalPoint.position.x - initialState.position.x,
      finalPoint.position.z - initialState.position.z
    )

    const speedData = trajectory.map(point => ({
      time: Number(point.time.toFixed(3)),
      speed: Number(vectorMagnitude(point.velocity).toFixed(2)),
    }))

    return {
      flightTime: finalPoint.time,
      maximumHeight,
      horizontalDistance,
      landingX: finalPoint.position.x,
      landingZ: finalPoint.position.z,
      initialSpeed,
      finalSpeed,
      speedData,
    }
  }, [initialState, driftParameters])

  const driftDirectionDescription =
    driftDirection === 0 || driftDirection === 360
      ? 'From the net side'
      : driftDirection === 90
        ? 'From the right sideline'
        : driftDirection === 180
          ? 'From behind the player'
          : driftDirection === 270
            ? 'From the left sideline'
            : `From ${driftDirection}°`

  const horizontalDescription =
    horizontalDirection === 0
      ? 'Straight ahead'
      : horizontalDirection > 0
        ? 'Angled toward the right'
        : 'Angled toward the left'

  const shotDescription =
    launchAngle < 0
      ? 'Downward launch'
      : launchAngle < 15
        ? 'Low launch angle'
        : launchAngle > 45
          ? 'High launch angle'
          : 'Moderate launch angle'

  const visibleShots = shotPresets.filter(
    shot => shot.category === selectedCategory
  )

  const selectedShot =
    shotPresets.find(shot => shot.id === selectedShotId) ??
    shotPresets[0]

  const openGames = () => {
    setGameSelection('menu')
    setActivePage('games')
  }

  const backToGames = () => {
    setGameSelection('menu')
  }

  return (
    <div className="app">
      <header className="top-navigation">
        <h1 className="brand">🏸 ShuttleLab</h1>

        <nav className="page-tabs">
          <button
            className={activePage === 'home' ? 'active' : ''}
            onClick={() => setActivePage('home')}
          >
            Home
          </button>

          <button
            className={activePage === 'simulation' ? 'active' : ''}
            onClick={() => setActivePage('simulation')}
          >
            Simulation
          </button>

          <button
            className={activePage === 'shot-presets' ? 'active' : ''}
            onClick={() => setActivePage('shot-presets')}
          >
            Shot Presets
          </button>

          <button
            className={activePage === 'games' ? 'active' : ''}
            onClick={openGames}
          >
            Games
          </button>
        </nav>

        <span className="nav-status">● SYSTEM READY</span>
      </header>

      <main className="main-content">
        {/* HOME PAGE */}
        {activePage === 'home' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">BADMINTON ENGINEERING LAB</p>
                <h2>Home</h2>
              </div>
            </header>

            <section className="home-page">
              <section className="welcome">
                <div>
                  <p className="eyebrow">WELCOME TO SHUTTLELAB</p>
                  <h1>Understand every shot.</h1>
                  <p>
                    Explore badminton through physics, simulation,
                    and practical shot references.
                  </p>

                  <button
                    className="active"
                    onClick={() => setActivePage('simulation')}
                  >
                    Open Simulator →
                  </button>

                  <button
                    className="secondary-welcome-button"
                    onClick={() => setActivePage('shot-presets')}
                  >
                    Explore Shot Presets →
                  </button>

                  <button
                    className="secondary-welcome-button"
                    onClick={openGames}
                  >
                    Play Games →
                  </button>
                </div>
              </section>

              <section className="stats">
                <div className="stat-card">
                  <span>SIMULATION ENGINE</span>
                  <h2>Active</h2>
                  <p>Physics-based shuttlecock flight calculations</p>
                </div>

                <div className="stat-card">
                  <span>3D COURT</span>
                  <h2>Interactive</h2>
                  <p>Explore shuttlecock flight in 3D</p>
                </div>

                <div className="stat-card">
                  <span>SHOT LIBRARY</span>
                  <h2>Available</h2>
                  <p>Explore straight and crosscourt shot directions</p>
                </div>
              </section>
            </section>
          </>
        )}

        {/* SIMULATION PAGE */}
        {activePage === 'simulation' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">BADMINTON ENGINEERING LAB</p>
                <h2>Shot Simulator</h2>
              </div>
            </header>

            <section className="workspace">
              <h2>Simulation Workspace</h2>
              <p>
                Adjust your shot conditions and observe the shuttlecock's flight.
              </p>

              <div className="simulator-layout">
                <div className="controls-panel">
                  <div className="stat-card">
                    <h3>Launch Position</h3>

                    <label>Left / Right: {positionX.toFixed(1)} m</label>
                    <input
                      type="range"
                      min="-2.5"
                      max="2.5"
                      step="0.1"
                      value={positionX}
                      onChange={event => setPositionX(Number(event.target.value))}
                    />

                    <label>Distance from Net: {positionZ.toFixed(1)} m</label>
                    <input
                      type="range"
                      min="0.5"
                      max="6.0"
                      step="0.1"
                      value={positionZ}
                      onChange={event => setPositionZ(Number(event.target.value))}
                    />

                    <label>Launch Height: {launchHeight.toFixed(1)} m</label>
                    <input
                      type="range"
                      min="0.5"
                      max="3.5"
                      step="0.1"
                      value={launchHeight}
                      onChange={event => setLaunchHeight(Number(event.target.value))}
                    />
                  </div>

                  <div className="stat-card">
                    <h3>Shot Conditions</h3>

                    <label>Launch Speed: {speed} m/s</label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="1"
                      value={speed}
                      onChange={event => setSpeed(Number(event.target.value))}
                    />

                    <label>Vertical Launch Angle: {launchAngle}°</label>
                    <input
                      type="range"
                      min="-30"
                      max="80"
                      step="1"
                      value={launchAngle}
                      onChange={event => setLaunchAngle(Number(event.target.value))}
                    />

                    <p className="shot-description">{shotDescription}</p>

                    <label>Horizontal Launch Direction: {horizontalDirection}°</label>
                    <input
                      type="range"
                      min="-45"
                      max="45"
                      step="1"
                      value={horizontalDirection}
                      onChange={event => setHorizontalDirection(Number(event.target.value))}
                    />

                    <p className="shot-description">{horizontalDescription}</p>
                  </div>

                  <div className="stat-card">
                    <h3>Indoor Drift</h3>
                    <p>Simulate air currents inside the badminton hall.</p>

                    <label>Drift Amount: {driftAmount.toFixed(2)} m/s</label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      value={driftAmount}
                      onChange={event => setDriftAmount(Number(event.target.value))}
                    />

                    <label>Drift Direction: {driftDirection}°</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={driftDirection}
                      onChange={event => setDriftDirection(Number(event.target.value))}
                    />

                    <p className="shot-description">{driftDirectionDescription}</p>
                    <p className="shot-description">
                      {driftAmount === 0
                        ? 'Drift is currently disabled'
                        : 'Drift is affecting the trajectory'}
                    </p>
                  </div>
                </div>

                <div className="simulation-visuals">
                  <div className="camera-view-controls">
                    <button
                      className={cameraView === 'side' ? 'selected' : ''}
                      onClick={() => setCameraView('side')}
                    >
                      Side View
                    </button>

                    <button
                      className={cameraView === 'overhead' ? 'selected' : ''}
                      onClick={() => setCameraView('overhead')}
                    >
                      Overhead View
                    </button>

                    <button
                      className={cameraView === 'player' ? 'selected' : ''}
                      onClick={() => setCameraView('player')}
                    >
                      Player View
                    </button>
                  </div>

                  <div className="court-placeholder">
                    <Canvas
                      shadows
                      camera={{
                        position: [0, 5, 13],
                        fov: 45,
                      }}
                    >
                      <ambientLight intensity={1.5} />

                      <directionalLight
                        position={[5, 10, 5]}
                        intensity={2}
                        castShadow
                      />

                      <Court />

                      <FlightSimulator
                        speed={speed}
                        launchAngle={launchAngle}
                        horizontalDirection={horizontalDirection}
                        positionX={positionX}
                        positionZ={positionZ}
                        launchHeight={launchHeight}
                        driftAmount={driftAmount}
                        driftDirection={driftDirection}
                      />

                      <SimulationCamera view={cameraView} />

                      <OrbitControls
                        makeDefault
                        target={[0, 1, 0]}
                        minDistance={5}
                        maxDistance={30}
                      />
                    </Canvas>
                  </div>
                </div>

                <section className="flight-results">
                  <div className="flight-results-heading">
                    <div>
                      <p className="eyebrow">SIMULATION ANALYTICS</p>
                      <h2>Flight Results</h2>
                    </div>

                    <span className="results-live">● LIVE RESULTS</span>
                  </div>

                  {flightResults ? (
                    <>
                      <div className="flight-results-grid">
                        <div className="result-card">
                          <span>FLIGHT TIME</span>
                          <strong>{flightResults.flightTime.toFixed(2)} s</strong>
                        </div>

                        <div className="result-card">
                          <span>MAXIMUM HEIGHT</span>
                          <strong>{flightResults.maximumHeight.toFixed(2)} m</strong>
                        </div>

                        <div className="result-card">
                          <span>HORIZONTAL DISTANCE</span>
                          <strong>{flightResults.horizontalDistance.toFixed(2)} m</strong>
                        </div>

                        <div className="result-card">
                          <span>LANDING POSITION (X, Z)</span>
                          <strong>
                            ({flightResults.landingX.toFixed(2)},{' '}
                            {flightResults.landingZ.toFixed(2)}) m
                          </strong>
                        </div>

                        <div className="result-card">
                          <span>INITIAL SPEED</span>
                          <strong>{flightResults.initialSpeed.toFixed(2)} m/s</strong>
                        </div>

                        <div className="result-card">
                          <span>SPEED AT LANDING</span>
                          <strong>{flightResults.finalSpeed.toFixed(2)} m/s</strong>
                        </div>
                      </div>

                      <section className="speed-chart-section">
                        <div className="speed-chart-heading">
                          <div>
                            <p className="eyebrow">VELOCITY ANALYSIS</p>
                            <h3>Speed vs. Time</h3>
                            <p>
                              Track how quickly the shuttlecock decelerates
                              throughout its flight.
                            </p>
                          </div>
                        </div>

                        <div className="speed-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={flightResults.speedData}
                              margin={{
                                top: 15,
                                right: 20,
                                left: 5,
                                bottom: 10,
                              }}
                            >
                              <CartesianGrid
                                stroke="#263449"
                                strokeDasharray="4 4"
                              />

                              <XAxis
                                dataKey="time"
                                type="number"
                                domain={[0, 'dataMax']}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                tickLine={false}
                                axisLine={{ stroke: '#475569' }}
                                label={{
                                  value: 'Time (seconds)',
                                  position: 'insideBottom',
                                  offset: -5,
                                  fill: '#94a3b8',
                                  fontSize: 12,
                                }}
                              />

                              <YAxis
                                domain={[0, 'auto']}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                label={{
                                  value: 'Speed (m/s)',
                                  angle: -90,
                                  position: 'insideLeft',
                                  fill: '#94a3b8',
                                  fontSize: 12,
                                }}
                              />

                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#111827',
                                  border: '1px solid #334155',
                                  borderRadius: '8px',
                                  color: '#fff',
                                }}
                                labelStyle={{ color: '#94a3b8' }}
                                formatter={value => [
                                  `${Number(value).toFixed(2)} m/s`,
                                  'Speed',
                                ]}
                                labelFormatter={value =>
                                  `Time: ${Number(value).toFixed(3)} s`
                                }
                              />

                              <Line
                                type="monotone"
                                dataKey="speed"
                                stroke="#38bdf8"
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <p className="results-note">
                          Each point represents the calculated speed at a
                          point in the simulated trajectory. The graph
                          updates automatically when the shot conditions change.
                        </p>
                      </section>
                    </>
                  ) : (
                    <p>Unable to calculate flight results.</p>
                  )}

                  <p className="results-note">
                    Results update automatically when you change the
                    launch conditions or indoor drift. Landing coordinates
                    are measured from the court's coordinate origin.
                  </p>
                </section>
              </div>
            </section>
          </>
        )}

        {/* GAMES PAGE */}
        {activePage === 'games' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">SHUTTLELAB ARCADE</p>
                <h2>
                  {gameSelection === 'menu'
                    ? 'Games'
                    : gameSelection === 'one-player'
                      ? 'Target Challenge'
                      : '2 Player Badminton'}
                </h2>
              </div>
            </header>

            {gameSelection === 'menu' && (
              <section className="games-menu">
                <div className="games-menu-intro">
                  <p className="eyebrow">CHOOSE YOUR GAME MODE</p>
                  <h2>Ready to play?</h2>
                  <p>
                    Practice your accuracy on your own or challenge a friend
                    on the same badminton court.
                  </p>
                </div>

                <div className="game-selection-grid">
                  <button
                    className="game-selection-card"
                    onClick={() => setGameSelection('one-player')}
                  >
                    <div className="game-card-icon">🎯</div>
                    <span className="game-card-label">SINGLE PLAYER</span>
                    <h3>Target Challenge</h3>
                    <p>
                      Test your shot accuracy. Aim for the target, complete
                      ten rounds, and build your score.
                    </p>
                    <span className="game-card-action">Play 1 Player →</span>
                  </button>

                  <button
                    className="game-selection-card"
                    onClick={() => setGameSelection('two-player')}
                  >
                    <div className="game-card-icon">🏸</div>
                    <span className="game-card-label">LOCAL MULTIPLAYER</span>
                    <h3>2 Player Badminton</h3>
                    <p>
                      Play against a friend on the same court. Move, aim,
                      and hit using keyboard or mobile controls.
                    </p>
                    <span className="game-card-action">Play 2 Player →</span>
                  </button>
                </div>
              </section>
            )}

            {gameSelection === 'one-player' && (
              <section className="selected-game">
                <button className="back-to-games" onClick={backToGames}>
                  ← Back to Games
                </button>
                <TargetChallenge />
              </section>
            )}

            {gameSelection === 'two-player' && (
              <section className="selected-game">
                <button className="back-to-games" onClick={backToGames}>
                  ← Back to Games
                </button>

                <section className="two-player-intro">
                  <h2>Play against a friend.</h2>
                  <p>
                    Player 1 uses WASD. Player 2 uses the arrow keys.
                    Move around your half of the court.
                  </p>
                </section>

                <TwoPlayerGame />
              </section>
            )}
          </>
        )}

        {/* SHOT PRESETS PAGE */}
        {activePage === 'shot-presets' && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">BADMINTON SHOT REFERENCE</p>
                <h2>Shot Presets</h2>
              </div>
            </header>

            <section className="shot-library">
              <div className="shot-library-intro">
                <div>
                  <h2>Explore the shot library.</h2>
                  <p>
                    Select a badminton shot and view its predefined
                    trajectory in 3D.
                  </p>
                </div>
              </div>

              <div className="preset-workspace">
                <aside className="preset-controls-panel">
                  <h3>Shot Categories</h3>

                  <div className="shot-library-categories">
                    {(Object.keys(categoryLabels) as ShotCategory[]).map(
                      category => (
                        <button
                          key={category}
                          className={selectedCategory === category ? 'selected' : ''}
                          onClick={() => {
                            setSelectedCategory(category)

                            const firstShot = shotPresets.find(
                              shot => shot.category === category
                            )

                            if (firstShot) setSelectedShotId(firstShot.id)
                          }}
                        >
                          {categoryLabels[category]}
                        </button>
                      )
                    )}
                  </div>

                  <h3 className="preset-list-heading">Select a Shot</h3>

                  <div className="preset-shot-list">
                    {visibleShots.map(shot => (
                      <button
                        key={shot.id}
                        className={`preset-shot-button ${
                          selectedShotId === shot.id ? 'selected' : ''
                        }`}
                        onClick={() => setSelectedShotId(shot.id)}
                      >
                        <strong>{shot.name}</strong>
                        <span>{shot.description}</span>
                      </button>
                    ))}
                  </div>

                  <div className="preset-direction-toggle">
                    <h3>Shot Direction</h3>

                    <div>
                      <button
                        className={selectedDirection === 'straight' ? 'selected' : ''}
                        onClick={() => setSelectedDirection('straight')}
                      >
                        Straight
                      </button>

                      <button
                        className={selectedDirection === 'crosscourt' ? 'selected' : ''}
                        onClick={() => setSelectedDirection('crosscourt')}
                      >
                        Crosscourt
                      </button>
                    </div>
                  </div>
                </aside>

                <section className="preset-viewer-panel">
                  <div className="preset-viewer-heading">
                    <div>
                      <p className="eyebrow">3D SHOT PREVIEW</p>
                      <h3>{selectedShot.name}</h3>
                      <p>{selectedShot.description}</p>
                    </div>

                    <span className="results-live">● PRESET VIEW</span>
                  </div>

                  <div className="preset-canvas">
                    <ShotPresetViewer
                      shotId={selectedShot.id}
                      direction={selectedDirection}
                    />
                  </div>

                  <p className="preset-viewer-caption">
                    Blue marker: starting area. Yellow marker: intended
                    landing area. Yellow curve: predefined shot path.
                  </p>

                  {selectedShot.note && (
                    <p className="shot-library-note">{selectedShot.note}</p>
                  )}
                </section>
              </div>

              <p className="shot-library-footnote">
                These are predefined visual shot references. They do not
                use the physics simulation or calculate real flight data.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App