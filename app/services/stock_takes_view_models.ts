import StockTake from '#models/stock_take'
import StockTakeItem from '#models/stock_take_item'
import Material from '#models/material'
import Component from '#models/component'
import Product from '#models/product'

/**
 * Lean read-only projections for the stock-takes Inertia pages. Gating is
 * enforced at the route/controller layer via Bouncer.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type StockTakeIndexRow = {
  id: number
  number: string
  status: string
  createdAt: string | null
  completedAt: string | null
  countedLines: number
  totalLines: number
}

export async function getStockTakesIndexViewModel(): Promise<{
  stockTakes: StockTakeIndexRow[]
}> {
  const stockTakes = await StockTake.query().orderBy('created_at', 'desc')

  const ids = stockTakes.map((s) => s.id)
  const items = ids.length ? await StockTakeItem.query().whereIn('stockTakeId', ids) : []

  const counts = new Map<number, { total: number; counted: number }>()
  for (const item of items) {
    const g = counts.get(item.stockTakeId) ?? { total: 0, counted: 0 }
    g.total += 1
    if (item.countedQty !== null) g.counted += 1
    counts.set(item.stockTakeId, g)
  }

  return {
    stockTakes: stockTakes.map((s) => {
      const g = counts.get(s.id) ?? { total: 0, counted: 0 }
      return {
        id: s.id,
        number: s.number,
        status: s.status,
        createdAt: s.createdAt ? s.createdAt.toISO() : null,
        completedAt: s.completedAt ? s.completedAt.toISO() : null,
        countedLines: g.counted,
        totalLines: g.total,
      }
    }),
  }
}

export type StockTakeLineRow = {
  id: number
  itemKind: string
  itemId: number
  itemSku: string
  itemName: string
  unit: string
  expectedQty: string
  countedQty: string | null
  unitCost: string
  varianceQty: number | null
  varianceValue: number | null
}

export type StockTakeShowData = {
  stockTake: {
    id: number
    number: string
    status: string
    note: string | null
    createdAt: string | null
    completedAt: string | null
  }
  lines: StockTakeLineRow[]
  totals: {
    countedLines: number
    totalLines: number
    netVarianceValue: number
  }
}

export async function getStockTakeShowViewModel(id: number): Promise<StockTakeShowData> {
  const st = await StockTake.query().where('id', id).firstOrFail()
  const items = await StockTakeItem.query()
    .where('stockTakeId', id)
    .orderBy('itemKind')
    .orderBy('itemId')

  const matIds = items.filter((i) => i.itemKind === 'material').map((i) => i.itemId)
  const compIds = items.filter((i) => i.itemKind === 'component').map((i) => i.itemId)
  const prodIds = items.filter((i) => i.itemKind === 'product').map((i) => i.itemId)

  const [materials, components, products] = await Promise.all([
    matIds.length ? Material.query().whereIn('id', matIds) : Promise.resolve([]),
    compIds.length ? Component.query().whereIn('id', compIds) : Promise.resolve([]),
    prodIds.length ? Product.query().whereIn('id', prodIds) : Promise.resolve([]),
  ])

  const matById = new Map(materials.map((m) => [m.id, m]))
  const compById = new Map(components.map((c) => [c.id, c]))
  const prodById = new Map(products.map((p) => [p.id, p]))

  let countedLines = 0
  let netVarianceValue = 0

  const lines: StockTakeLineRow[] = items.map((item) => {
    let sku = '—'
    let name = `#${item.itemId}`
    let unit = ''

    if (item.itemKind === 'material') {
      const m = matById.get(item.itemId)
      if (m) {
        sku = m.sku
        name = m.name
        unit = m.unit
      }
    } else if (item.itemKind === 'component') {
      const c = compById.get(item.itemId)
      if (c) {
        sku = c.sku
        name = c.name
        unit = c.unit
      }
    } else if (item.itemKind === 'product') {
      const p = prodById.get(item.itemId)
      if (p) {
        sku = p.sku
        name = p.name
        unit = 'unit'
      }
    }

    let varianceQty: number | null = null
    let varianceValue: number | null = null
    if (item.countedQty !== null) {
      varianceQty = round2(Number(item.countedQty) - Number(item.expectedQty))
      varianceValue = round2(varianceQty * Number(item.unitCost))
      countedLines += 1
      netVarianceValue += varianceValue
    }

    return {
      id: item.id,
      itemKind: item.itemKind,
      itemId: item.itemId,
      itemSku: sku,
      itemName: name,
      unit,
      expectedQty: item.expectedQty,
      countedQty: item.countedQty,
      unitCost: item.unitCost,
      varianceQty,
      varianceValue,
    }
  })

  return {
    stockTake: {
      id: st.id,
      number: st.number,
      status: st.status,
      note: st.note,
      createdAt: st.createdAt ? st.createdAt.toISO() : null,
      completedAt: st.completedAt ? st.completedAt.toISO() : null,
    },
    lines,
    totals: {
      countedLines,
      totalLines: items.length,
      netVarianceValue: round2(netVarianceValue),
    },
  }
}
