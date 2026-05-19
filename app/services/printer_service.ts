import db from '@adonisjs/lucid/services/db'
import Printer from '#models/printer'
import type User from '#models/user'
import { audit } from '#services/audit'
import { DomainError, InvalidStateError } from '#services/domain_errors'
import { DateTime } from 'luxon'

export async function createPrinter(input: {
  name: string
  model?: string | null
  serialNumber?: string | null
  notes?: string | null
  actor: User
}): Promise<Printer> {
  return db.transaction(async (trx) => {
    const exists = await Printer.query({ client: trx }).where('name', input.name).first()
    if (exists)
      throw new DomainError({
        code: 'DUPLICATE_NAME',
        message: `Printer "${input.name}" already exists.`,
      })
    const printer = new Printer()
    printer.name = input.name
    printer.model = input.model ?? null
    printer.serialNumber = input.serialNumber ?? null
    printer.notes = input.notes ?? null
    printer.status = 'idle'
    printer.acquiredAt = DateTime.now()
    printer.useTransaction(trx)
    await printer.save()
    await audit({
      actor: input.actor,
      action: 'printer.create',
      targetType: 'printer',
      targetId: printer.id,
      trx,
    })
    return printer
  })
}

export async function updatePrinter(
  id: number,
  patch: {
    name?: string
    model?: string | null
    serialNumber?: string | null
    notes?: string | null
  },
  actor: User
): Promise<Printer> {
  return db.transaction(async (trx) => {
    const printer = await Printer.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (patch.name !== undefined) printer.name = patch.name
    if (patch.model !== undefined) printer.model = patch.model
    if (patch.serialNumber !== undefined) printer.serialNumber = patch.serialNumber
    if (patch.notes !== undefined) printer.notes = patch.notes
    await printer.save()
    await audit({
      actor,
      action: 'printer.update',
      targetType: 'printer',
      targetId: id,
      payload: patch,
      trx,
    })
    return printer
  })
}

export async function retirePrinter(id: number, actor: User): Promise<Printer> {
  return db.transaction(async (trx) => {
    const printer = await Printer.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (printer.status === 'printing') {
      throw new InvalidStateError({ entity: 'printer', from: printer.status, to: 'retired' })
    }
    printer.status = 'retired'
    await printer.save()
    await audit({ actor, action: 'printer.retire', targetType: 'printer', targetId: id, trx })
    return printer
  })
}

export async function toggleMaintenance(id: number, actor: User): Promise<Printer> {
  return db.transaction(async (trx) => {
    const printer = await Printer.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
    if (printer.status === 'printing' || printer.status === 'retired') {
      throw new InvalidStateError({ entity: 'printer', from: printer.status, to: 'maintenance' })
    }
    printer.status = printer.status === 'maintenance' ? 'idle' : 'maintenance'
    await printer.save()
    await audit({
      actor,
      action: 'printer.toggle_maintenance',
      targetType: 'printer',
      targetId: id,
      payload: { newStatus: printer.status },
      trx,
    })
    return printer
  })
}
