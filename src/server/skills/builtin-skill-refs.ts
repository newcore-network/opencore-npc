import { skillRef } from '../contracts/npc-skill-ref.types'

/**
 * Built-in skill references for strongly typed controller configuration.
 */
export const BuiltInNpcSkills = {
  moveTo: skillRef('moveTo'),
  goToEntity: skillRef('goToEntity'),
  wanderArea: skillRef('wanderArea'),
  enterVehicle: skillRef('enterVehicle'),
  leaveVehicle: skillRef('leaveVehicle'),
  driveTo: skillRef('driveTo'),
  parkVehicle: skillRef('parkVehicle'),
  goToCarDrivePark: skillRef('goToCarDrivePark'),
} as const
