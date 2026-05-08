import QRCode from 'qrcode'
import env from '#start/env'
import type Product from '#models/product'

export function qrPayload(product: Product): string {
  const base = env.get('APP_URL', '').replace(/\/$/, '')
  if (base) return `${base}/catalog/products/${product.id}`
  return `product:${product.sku}`
}

export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { type: 'svg', margin: 1, width: 320 })
}

export async function renderQrPngBuffer(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, { type: 'png', margin: 2, width: 1024 })
}
