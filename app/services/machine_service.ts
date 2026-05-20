import db from '@adonisjs/lucid/services/db'
import Machine from '#models/machine'
import type User from '#models/user'
import { audit } from '#services/audit'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { DateTime } from 'luxon'

export async function createMachine(input: {
  name: string
  model?: string | null
  serialNumber?: string | null
  notes?: string | null
  actor: User
}): Promise<Machine> {
  return db.transaction(async (trx) => {
    const exists = await Machine.query({ client: trx }).where('name', input.name).first()
    if (exists)
      throw new DomainError({
        code: 'DUPLICATE_NAME',
        message: `Machine "${input.name}" already exists.`,
      })
    const machine = new Machine()
    machine.name = input.name
    machine.model = input.model ?? null
    machine.serialNumber = input.serialNumber ?? null
    machine.notes = input.notes ?? null
    machine.status = 'idle'
    machine.acquiredAt = DateTime.now()
    machine.useTransaction(trx)
    await machine.save()
    await audit({
      actor: input.actor,
      action: 'machine.create',
      targetType: 'machine',
      targetId: machine.id,
      trx,
    })
    return machine
  })
}

export async function updateMachine(
  id: number,
  patch: {
    name?: string
    model?: string | null
    serialNumber?: string | null
    notes?: string | null
  },
  actor: User
): Promise<Machine> {
  return db.transaction(async (trx) => {
    const machine = await Machine.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (patch.name !== undefined) machine.name = patch.name
    if (patch.model !== undefined) machine.model = patch.model
    if (patch.serialNumber !== undefined) machine.serialNumber = patch.serialNumber
    if (patch.notes !== undefined) machine.notes = patch.notes
    await machine.save()
    await audit({
      actor,
      action: 'machine.update',
      targetType: 'machine',
      targetId: id,
      payload: patch,
      trx,
    })
    return machine
  })
}

export async function retireMachine(id: number, actor: User): Promise<Machine> {
  return db.transaction(async (trx) => {
    const machine = await Machine.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (machine.status === 'running') {
      throw new InvalidStateError({ entity: 'machine', from: machine.status, to: 'retired' })
    }
    machine.status = 'retired'
    await machine.save()
    await audit({ actor, action: 'machine.retire', targetType: 'machine', targetId: id, trx })
    return machine
  })
}

export async function toggleMaintenance(id: number, actor: User): Promise<Machine> {
  return db.transaction(async (trx) => {
    const machine = await Machine.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (machine.status === 'running' || machine.status === 'retired') {
      throw new InvalidStateError({ entity: 'machine', from: machine.status, to: 'maintenance' })
    }
    machine.status = machine.status === 'maintenance' ? 'idle' : 'maintenance'
    await machine.save()
    await audit({
      actor,
      action: 'machine.toggle_maintenance',
      targetType: 'machine',
      targetId: id,
      payload: { newStatus: machine.status },
      trx,
    })
    return machine
  })
}
