import { calculateStateDerivative } from './model'
import type {
  PhysicsState,
  ShuttlecockParameters,
  Vector3,
} from './model'

function addScaledState(
  state: PhysicsState,
  derivative: PhysicsState,
  scale: number
): PhysicsState {
  return {
    position: {
      x: state.position.x + derivative.position.x * scale,
      y: state.position.y + derivative.position.y * scale,
      z: state.position.z + derivative.position.z * scale,
    },
    velocity: {
      x: state.velocity.x + derivative.velocity.x * scale,
      y: state.velocity.y + derivative.velocity.y * scale,
      z: state.velocity.z + derivative.velocity.z * scale,
    },
  }
}

function weightedAverage(
  k1: PhysicsState,
  k2: PhysicsState,
  k3: PhysicsState,
  k4: PhysicsState,
  dt: number
): PhysicsState {
  const combine = (
    a: Vector3,
    b: Vector3,
    c: Vector3,
    d: Vector3
  ): Vector3 => ({
    x: (a.x + 2 * b.x + 2 * c.x + d.x) * dt / 6,
    y: (a.y + 2 * b.y + 2 * c.y + d.y) * dt / 6,
    z: (a.z + 2 * b.z + 2 * c.z + d.z) * dt / 6,
  })

  return {
    position: combine(
      k1.position, k2.position, k3.position, k4.position
    ),
    velocity: combine(
      k1.velocity, k2.velocity, k3.velocity, k4.velocity
    ),
  }
}

export function rk4Step(
  state: PhysicsState,
  dt: number,
  parameters: ShuttlecockParameters
): PhysicsState {
  if (dt <= 0) {
    throw new Error('Time step must be greater than zero.')
  }

  const k1 = calculateStateDerivative(state, parameters)

  const k2State = addScaledState(state, k1, dt / 2)
  const k2 = calculateStateDerivative(k2State, parameters)

  const k3State = addScaledState(state, k2, dt / 2)
  const k3 = calculateStateDerivative(k3State, parameters)

  const k4State = addScaledState(state, k3, dt)
  const k4 = calculateStateDerivative(k4State, parameters)

  const change = weightedAverage(k1, k2, k3, k4, dt)

  return {
    position: {
      x: state.position.x + change.position.x,
      y: state.position.y + change.position.y,
      z: state.position.z + change.position.z,
    },
    velocity: {
      x: state.velocity.x + change.velocity.x,
      y: state.velocity.y + change.velocity.y,
      z: state.velocity.z + change.velocity.z,
    },
  }
}
