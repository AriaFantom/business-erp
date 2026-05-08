import { StyleSheet } from '@react-pdf/renderer'

export const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtle: {
    color: '#64748b',
    fontSize: 9,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#334155',
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  col: {
    flexBasis: '48%',
  },
  table: {
    marginTop: 8,
  },
  tHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 9,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  tRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tCellDesc: { flex: 4 },
  tCellQty: { flex: 1, textAlign: 'right' },
  tCellMoney: { flex: 1.4, textAlign: 'right' },
  tCellTax: { flex: 1, textAlign: 'right' },
  totalsBox: {
    marginTop: 12,
    alignSelf: 'flex-end',
    width: 220,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalsLabel: { color: '#64748b' },
  totalsValue: { fontWeight: 'bold' },
  badge: {
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    color: '#334155',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
})
