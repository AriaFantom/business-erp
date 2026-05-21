import * as React from 'react'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { styles } from './shared_styles.js'

export type QuotationPdfData = {
  quotation: {
    id: number
    number: string
    status: string
    customer:
      | {
          id: number
          name: string
          email: string | null
          phone: string | null
          address: string | null
        }
      | null
    issuedAt: string | null
    validUntil: string | null
    subtotal: string
    taxTotal: string
    total: string
    note: string | null
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
  appName?: string
}

function money(n: string | number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return String(n)
  return `$${v.toFixed(2)}`
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

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  )
}

export function QuotationDocument({ quotation, items }: QuotationPdfData) {
  const c = quotation.customer
  return (
    <Document title={`Quotation ${quotation.number}`}>
      <Page size="A4" style={styles.page}>
        {/* ── Title + meta block ─────────────────────────── */}
        <View style={styles.topRow}>
          <Text style={styles.titleBig}>QUOTATION</Text>
          <View style={styles.metaBlock}>
            <MetaLine label="Quote #:" value={quotation.number} />
            <MetaLine label="Date:" value={fmtDate(quotation.issuedAt)} />
            {quotation.validUntil ? (
              <MetaLine label="Valid Until:" value={fmtDate(quotation.validUntil)} />
            ) : null}
            <MetaLine label="Status:" value={quotation.status} />
          </View>
        </View>

        {/* ── Customer details ──────────────────────────── */}
        <View style={styles.partyBlock}>
          <Text style={styles.sectionTitle}>Customer Details:</Text>
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
              {money(quotation.subtotal)}
            </Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.td, styles.colSumLabel, styles.alignLeft]}>Tax</Text>
            <Text style={[styles.td, styles.colSumValue, styles.alignRight]}>
              {money(quotation.taxTotal)}
            </Text>
          </View>
          <View style={styles.tr}>
            <Text style={[styles.td, styles.colSumLabel, styles.alignLeft, styles.bold]}>
              Total
            </Text>
            <Text style={[styles.td, styles.colSumValue, styles.alignRight, styles.bold]}>
              {money(quotation.total)}
            </Text>
          </View>
        </View>

        {/* ── Notes ─────────────────────────────────────── */}
        {quotation.note ? (
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Notes:</Text>
            <Text style={styles.partyLine}>{quotation.note}</Text>
          </View>
        ) : null}

        {/* ── Footer ────────────────────────────────────── */}
        <Text style={styles.footer}>Thank you for your business!</Text>
      </Page>
    </Document>
  )
}
