import { describe, expect, it } from 'vitest'
import { NpcConstraints } from '../src/server/runtime/constraints/npc-constraints'
import { skillRef } from '../src/server/contracts/npc-skill-ref.types'

const moveTo = skillRef('moveTo')
const driveTo = skillRef('driveTo')
const enterVehicle = skillRef('enterVehicle')

describe('NpcConstraints', () => {
  it('forbidSkills blocks decision', () => {
    const c = new NpcConstraints().allow(moveTo).forbidSkills(moveTo)
    const report = c.validate({ skill: 'moveTo' }, { state: new Map(), turnCalls: 0 })
    expect(report.allowed).toBe(false)
    expect(report.reasons.some((r) => r.includes('forbidden'))).toBe(true)
  })

  it('mutexGroup blocks conflicting skill', () => {
    const c = new NpcConstraints().allow(driveTo, enterVehicle).mutexGroup('movement', [driveTo, enterVehicle])
    const state = new Map<string, any>([['mutex:movement', 'driveTo']])
    const report = c.validate({ skill: 'enterVehicle' }, { state, turnCalls: 0 })
    expect(report.allowed).toBe(false)
    expect(report.mutex?.key).toBe('movement')
  })

  it('limitCallsPerTurn and require work together', () => {
    const c = new NpcConstraints().allow(moveTo).limitCallsPerTurn(1).require(moveTo, (ctx) => !!ctx.state.get('canMove'))
    const state = new Map<string, any>()
    const report1 = c.validate({ skill: 'moveTo' }, { state, turnCalls: 0 })
    expect(report1.allowed).toBe(false)

    state.set('canMove', true)
    const report2 = c.validate({ skill: 'moveTo' }, { state, turnCalls: 1 })
    expect(report2.allowed).toBe(false)
    expect(report2.reasons.some((r) => r.includes('limitCallsPerTurn'))).toBe(true)
  })
})
