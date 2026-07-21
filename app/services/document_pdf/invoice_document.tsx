import * as React from 'react'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './shared_styles.js'

export type InvoicePdfData = {
  invoice: {
    id: number
    number: string
    orderId: number
    status: string
    issuedAt: string | null
    dueAt: string | null
    subtotal: string
    taxTotal: string
    total: string
    paidTotal: string
    customer:
      | {
          id: number
          name: string
          email: string | null
          phone: string | null
          address: string | null
        }
      | null
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

function money(n: string | number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  return `$${v.toFixed(2)}`
}

function moneyNeg(n: string | number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  return `-$${v.toFixed(2)}`
}

function num(n: string | number, digits = 2): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  return v.toFixed(digits)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}, ${d.getUTCFullYear()}`
}

function MetaLine({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

export function InvoiceDocument({ invoice, items, payments }: InvoicePdfData) {
  const c = invoice.customer
  const balance = Math.max(0, Number(invoice.total) - Number(invoice.paidTotal))
  return (
    <Document title={`Invoice ${invoice.number}`}>
      <Page size="A4" style={styles.page}>
        {/* ── Title + meta block ─────────────────────────── */}
        <View style={styles.topRow}>
          <Text style={styles.titleBig}>INVOICE</Text>
          <View style={styles.metaBlock}>
            <MetaLine label="Invoice #:" value={invoice.number} />
            <MetaLine label="Date:" value={fmtDate(invoice.issuedAt)} />
            {invoice.dueAt ? (
              <MetaLine label="Due Date:" value={fmtDate(invoice.dueAt)} />
            ) : null}
            {invoice.replacesInvoiceId ? (
              <MetaLine label="Replaces #:" value={String(invoice.replacesInvoiceId)} />
            ) : null}
            <MetaLine label="Status:" value={invoice.status} />
          </View>
        </View>

        {/* ── Bill to ──────────────────────────────────── */}
        <View style={styles.partyBlock}>
          <Text style={styles.sectionTitle}>Bill To:</Text>
          {c ? (
            <>
              <Text style={styles.partyLine}>{c.name}</Text>
              {c.address ? <Text style={styles.partyLine}>{c.address}</Text> : null}
              {c.email ? <Text style={styles.partyLine}>Email: {c.email}</Text> : null}
              {c.phone ? <Text style={styles.partyLine}>Phone: {c.phone}</Text> : null}
            </>
          ) : (
            <Text style={styles.partyLine}>—</Text>
          )}
        </View>

        {/* ── Line items table ──────────────────────────── */}
        {items.length > 0 ? (
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={[styles.th, styles.colItem, styles.alignLeft]}>Item</Text>
              <Text style={[styles.th, styles.colQty, styles.alignCenter]}>Quantity</Text>
              <Text style={[styles.th, styles.colUnit, styles.alignRight]}>Unit Price</Text>
              <Text style={[styles.th, styles.colDisc, styles.alignRight]}>Tax %</Text>
              <Text style={[styles.th, styles.colAmount, styles.alignRight]}>Amount</Text>
            </View>
            {items.map((it) => (
              <View style={styles.tr} key={it.id}>
                <Text style={[styles.td, styles.colItem, styles.alignLeft]}>{it.description}</Text>
                <Text style={[styles.td, styles.colQty, styles.alignCenter]}>{num(it.qty)}</Text>
                <Text style={[styles.td, styles.colUnit, styles.alignRight]}>
                  {money(it.unitPrice)}
                </Text>
                <Text style={[styles.td, styles.colDisc, styles.alignRight]}>
                  {num(it.taxRatePct)}%
                </Text>
                <Text style={[styles.td, styles.colAmount, styles.alignRight]}>
                  {money(it.lineTotal)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Financial summary ─────────────────────────── */}
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colSumLabel, styles.alignLeft]}>Description</Text>
            <Text style={[styles.th, styles.colSumValue, styles.alignRight]}>Amount</Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.td, styles.colSumLabel, styles.alignLeft]}>Subtotal</Text>
            <Text style={[styles.td, styles.colSumValue, styles.alignRight]}>
              {money(invoice.subtotal)}
            </Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.td, styles.colSumLabel, styles.alignLeft]}>Tax</Text>
            <Text style={[styles.td, styles.colSumValue, styles.alignRight]}>
              {money(invoice.taxTotal)}
            </Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.td, styles.colSumLabel, styles.alignLeft, styles.bold]}>
              Total
            </Text>
            <Text style={[styles.td, styles.colSumValue, styles.alignRight, styles.bold]}>
              {money(invoice.total)}
            </Text>
          </View>
          {Number(invoice.paidTotal) > 0 ? (
            <View style={styles.tr}>
              <Text style={[styles.td, styles.colSumLabel, styles.alignLeft]}>Paid Amount</Text>
              <Text style={[styles.td, styles.colSumValue, styles.alignRight]}>
                {moneyNeg(invoice.paidTotal)}
              </Text>
            </View>
          ) : null}
          <View style={styles.tr}>
            <Text style={[styles.td, styles.colSumLabel, styles.alignLeft, styles.bold]}>
              Balance Due
            </Text>
            <Text style={[styles.td, styles.colSumValue, styles.alignRight, styles.bold]}>
              {money(balance)}
            </Text>
          </View>
        </View>

        {/* ── Payment History ────────────────────────────── */}
        {payments.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Payment History:</Text>
            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, styles.colPayNo, styles.alignLeft]}>Payment #</Text>
                <Text style={[styles.th, styles.colPayDate, styles.alignLeft]}>Date</Text>
                <Text style={[styles.th, styles.colPayMethod, styles.alignLeft]}>Method</Text>
                <Text style={[styles.th, styles.colPayAmount, styles.alignRight]}>Amount</Text>
                <Text style={[styles.th, styles.colPayRef, styles.alignLeft]}>Reference</Text>
              </View>
              {payments.map((p) => (
                <View style={styles.tr} key={p.id}>
                  <Text style={[styles.td, styles.colPayNo, styles.alignLeft]}>#{p.id}</Text>
                  <Text style={[styles.td, styles.colPayDate, styles.alignLeft]}>
                    {fmtDate(p.paidAt)}
                  </Text>
                  <Text style={[styles.td, styles.colPayMethod, styles.alignLeft]}>{p.method}</Text>
                  <Text style={[styles.td, styles.colPayAmount, styles.alignRight]}>
                    {money(p.amount)}
                  </Text>
                  <Text style={[styles.td, styles.colPayRef, styles.alignLeft]}>
                    {p.reference ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Footer ────────────────────────────────────── */}
        <Text style={styles.footer}>Thank you for your business!</Text>
      </Page>
    </Document>
  )
}
