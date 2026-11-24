
import type { PhysicsState, ShuttlecockParameters } from './model'
import { rk4Step } from './integrator'

export interface TrajectoryPoint {
  time: number
  position: PhysicsState['position']
  velocity: PhysicsState['velocity']
}

export function simulateTrajectory(
  initialState: PhysicsState,
  parameters: ShuttlecockParameters,
  dt = 1 / 240,
  maxTime = 5,
  groundHeight = 0
): TrajectoryPoint[] {
  if (dt <= 0 || maxTime <= 0) {
    throw new Error('Time step and maximum time must be positive.')
  }

  let state = initialState
  let time = 0

  const trajectory: TrajectoryPoint[] = [{
    time,
    position: { ...state.position },
    velocity: { ...state.velocity },
  }]

  while (time < maxTime && state.position.y > groundHeight) {
    state = rk4Step(state, dt, parameters)
    time += dt

    trajectory.push({
      time,
      position: { ...state.position },
      velocity: { ...state.velocity },
    })
  }

  return trajectory
}
