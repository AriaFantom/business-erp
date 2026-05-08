import * as React from 'react'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './shared_styles.js'

export type InvoicePdfData = {
  invoice: {
    id: number
    number: string
    saleId: number
    status: string
    issuedAt: string | null
    dueAt: string | null
    subtotal: string
    taxTotal: string
    total: string
    paidTotal: string
    customer: { id: number; name: string } | null
    replacesInvoiceId: number | null
  }
  items: Array<{
    id: number
    description: string
    qty: number
    unitPrice: string
    taxRatePct: string
    lineSubtotal: string
    lineTax: string
    lineTotal: string
  }>
  payments: Array<{
    id: number
    amount: string
    method: string
    paidAt: string | null
    reference: string | null
  }>
  appName?: string
}

function fmt(n: string | number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  return v.toFixed(2)
}

export function InvoiceDocument({ invoice, items, payments, appName }: InvoicePdfData) {
  const due = Math.max(0, Number(invoice.total) - Number(invoice.paidTotal))
  return (
    <Document title={`Invoice ${invoice.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invoice {invoice.number}</Text>
            <Text style={styles.subtle}>
              Issued {invoice.issuedAt?.slice(0, 10) ?? '—'} · Due{' '}
              {invoice.dueAt?.slice(0, 10) ?? '—'}
              {invoice.replacesInvoiceId
                ? ` · Replaces #${invoice.replacesInvoiceId}`
                : ''}
            </Text>
          </View>
          <View>
            <Text style={styles.badge}>{invoice.status.toUpperCase()}</Text>
            {appName ? (
              <Text style={[styles.subtle, { marginTop: 8, textAlign: 'right' }]}>
                {appName}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.section, styles.twoCol]}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Bill to</Text>
            <Text>{invoice.customer?.name ?? '—'}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Reference</Text>
            <Text>Sale #{invoice.saleId}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tHead}>
            <Text style={styles.tCellDesc}>Description</Text>
            <Text style={styles.tCellQty}>Qty</Text>
            <Text style={styles.tCellMoney}>Unit price</Text>
            <Text style={styles.tCellTax}>Tax %</Text>
            <Text style={styles.tCellMoney}>Total</Text>
          </View>
          {items.map((it) => (
            <View style={styles.tRow} key={it.id}>
              <Text style={styles.tCellDesc}>{it.description}</Text>
              <Text style={styles.tCellQty}>{it.qty}</Text>
              <Text style={styles.tCellMoney}>{fmt(it.unitPrice)}</Text>
              <Text style={styles.tCellTax}>{fmt(it.taxRatePct)}</Text>
              <Text style={styles.tCellMoney}>{fmt(it.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{fmt(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text>{fmt(invoice.taxTotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsValue}>Total</Text>
            <Text style={styles.totalsValue}>{fmt(invoice.total)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Paid</Text>
            <Text>{fmt(invoice.paidTotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsValue}>Due</Text>
            <Text style={styles.totalsValue}>{due.toFixed(2)}</Text>
          </View>
        </View>

        {payments.length > 0 ? (
          <View style={[styles.section, { marginTop: 18 }]}>
            <Text style={styles.sectionTitle}>Payments</Text>
            <View style={styles.tHead}>
              <Text style={styles.tCellDesc}>Date</Text>
              <Text style={styles.tCellDesc}>Method</Text>
              <Text style={styles.tCellMoney}>Amount</Text>
              <Text style={styles.tCellDesc}>Reference</Text>
            </View>
            {payments.map((p) => (
              <View style={styles.tRow} key={p.id}>
                <Text style={styles.tCellDesc}>{p.paidAt?.slice(0, 10) ?? '—'}</Text>
                <Text style={styles.tCellDesc}>{p.method}</Text>
                <Text style={styles.tCellMoney}>{fmt(p.amount)}</Text>
                <Text style={styles.tCellDesc}>{p.reference ?? '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Generated by {appName ?? 'Panel'} · invoice {invoice.number}
        </Text>
      </Page>
    </Document>
  )
}
