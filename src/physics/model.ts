
export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface PhysicsState {
  position: Vector3
  velocity: Vector3
}

export interface ShuttlecockParameters {
  mass: number
  airDensity: number
  dragCoefficient: number
  referenceArea: number
  gravity: number
  windVelocity?: Vector3
}

export const DEFAULT_PARAMETERS: ShuttlecockParameters = {
  mass: 0.0052,
  airDensity: 1.225,
  dragCoefficient: 0.58,
  referenceArea: 0.0028,
  gravity: 9.81,
  windVelocity: { x: 0, y: 0, z: 0 },
}

export function addVectors(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }
}

export function scaleVector(v: Vector3, scalar: number): Vector3 {
  return {
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  }
}

export function vectorMagnitude(v: Vector3): number {
  return Math.sqrt(
    v.x * v.x +
    v.y * v.y +
    v.z * v.z
  )
}

export function calculateGravity(
  parameters: ShuttlecockParameters
): Vector3 {
  return {
    x: 0,
    y: -parameters.mass * parameters.gravity,
    z: 0,
  }
}

export function calculateDrag(
  velocity: Vector3,
  parameters: ShuttlecockParameters
): Vector3 {
  const wind = parameters.windVelocity ?? {
    x: 0,
    y: 0,
    z: 0,
  }

  // Air resistance depends on velocity relative to the air.
  const relativeVelocity = {
    x: velocity.x - wind.x,
    y: velocity.y - wind.y,
    z: velocity.z - wind.z,
  }

  const relativeSpeed = vectorMagnitude(relativeVelocity)

  if (relativeSpeed === 0) {
    return { x: 0, y: 0, z: 0 }
  }

  const dragScale =
    -0.5 *
    parameters.airDensity *
    parameters.dragCoefficient *
    parameters.referenceArea *
    relativeSpeed

  return scaleVector(relativeVelocity, dragScale)
}

export function calculateNetForce(
  velocity: Vector3,
  parameters: ShuttlecockParameters
): Vector3 {
  const gravity = calculateGravity(parameters)
  const drag = calculateDrag(velocity, parameters)

  return addVectors(gravity, drag)
}

export function calculateAcceleration(
  velocity: Vector3,
  parameters: ShuttlecockParameters
): Vector3 {
  if (parameters.mass <= 0) {
    throw new Error('Mass must be greater than zero')
  }

  const netForce = calculateNetForce(velocity, parameters)

  return scaleVector(netForce, 1 / parameters.mass)
}

export function calculateStateDerivative(
  state: PhysicsState,
  parameters: ShuttlecockParameters
): PhysicsState {
  return {
    position: { ...state.velocity },
    velocity: calculateAcceleration(state.velocity, parameters),
  }
}

export function calculateTerminalVelocity(
  parameters: ShuttlecockParameters
): number {
  return Math.sqrt(
    (2 * parameters.mass * parameters.gravity) /
    (
      parameters.airDensity *
      parameters.dragCoefficient *
      parameters.referenceArea
    )
  )
}
