import { NpcSkillRegistry } from '../runtime/engine/npc-skill-registry'
import { MoveToSkill } from './movement/move-to.skill'
import { GoToEntitySkill } from './movement/go-to-entity.skill'
import { WanderAreaSkill } from './movement/wander-area.skill'
import { EnterVehicleSkill } from './vehicle/enter-vehicle.skill'
import { LeaveVehicleSkill } from './vehicle/leave-vehicle.skill'
import { DriveToSkill } from './vehicle/drive-to.skill'
import { ParkVehicleSkill } from './vehicle/park-vehicle.skill'
import { GoToCarDriveParkSkill } from './composed/go-to-car-drive-park.skill'

/** Registers all built-in NPC skills for the MVP runtime. */
export function registerBuiltInNpcSkills(registry: NpcSkillRegistry): void {
  registry.register(new MoveToSkill())
  registry.register(new GoToEntitySkill())
  registry.register(new WanderAreaSkill())
  registry.register(new EnterVehicleSkill())
  registry.register(new LeaveVehicleSkill())
  registry.register(new DriveToSkill())
  registry.register(new ParkVehicleSkill())
  registry.register(new GoToCarDriveParkSkill())
}
