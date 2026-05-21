import { StyleSheet } from '@react-pdf/renderer'

const BORDER = '#000000'

export const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#000000',
  },

  // ── Top block ──────────────────────────────────────────────
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  titleBig: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 24,
    letterSpacing: 0.5,
  },
  metaBlock: {
    width: 220,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginRight: 4,
  },
  metaValue: {
    fontSize: 10,
  },

  // ── Section heading ───────────────────────────────────────
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    marginBottom: 6,
  },
  partyBlock: {
    marginBottom: 14,
  },
  partyLine: {
    fontSize: 10,
    marginBottom: 2,
  },

  // ── Tables (bordered, Go-style) ───────────────────────────
  table: {
    marginTop: 4,
    marginBottom: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: BORDER,
  },
  tr: {
    flexDirection: 'row',
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  td: {
    fontSize: 10,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  alignLeft: { textAlign: 'left' },
  alignCenter: { textAlign: 'center' },
  alignRight: { textAlign: 'right' },

  // Items table column widths (sum = 524 ≈ A4 width minus padding)
  colItem: { width: 215 },
  colQty: { width: 70 },
  colUnit: { width: 80 },
  colDisc: { width: 70 },
  colAmount: { width: 89 },

  // Summary table column widths
  colSumLabel: { width: 350 },
  colSumValue: { width: 174 },

  // Payment history column widths
  colPayNo: { width: 110 },
  colPayDate: { width: 90 },
  colPayMethod: { width: 120 },
  colPayAmount: { width: 100 },
  colPayRef: { width: 104 },

  // ── Emphasis rows in summary ──────────────────────────────
  bold: {
    fontFamily: 'Helvetica-Bold',
  },

  // ── Notes & footer ────────────────────────────────────────
  notes: {
    marginTop: 4,
    marginBottom: 10,
  },
  footer: {
    marginTop: 14,
    fontSize: 9,
    fontFamily: 'Helvetica-Oblique',
  },
})
