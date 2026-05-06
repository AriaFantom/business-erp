import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Supplier from '#models/supplier'
import Customer from '#models/customer'
import ProductCategory from '#models/product_category'

export default class extends BaseSeeder {
  async run() {
    await Supplier.updateOrCreate(
      { name: 'Default Supplier' },
      {
        name: 'Default Supplier',
        gstin: null,
        email: null,
        phone: null,
        address: null,
        isActive: true,
      }
    )

    await Customer.updateOrCreate(
      { name: 'Walk-in Customer' },
      {
        name: 'Walk-in Customer',
        gstin: null,
        email: null,
        phone: null,
        billingAddress: null,
        shippingAddress: null,
        isActive: true,
      }
    )

    const categories: Array<{
      name: string
      defaultProfitPct: string | null
      taxRatePct: string | null
    }> = [
      { name: 'Miniatures', defaultProfitPct: '40.00', taxRatePct: '18.00' },
      { name: 'Functional Parts', defaultProfitPct: '35.00', taxRatePct: '18.00' },
      { name: 'Decor & Display', defaultProfitPct: '45.00', taxRatePct: '18.00' },
      { name: 'Prototypes', defaultProfitPct: '30.00', taxRatePct: '18.00' },
      { name: 'Custom Orders', defaultProfitPct: '50.00', taxRatePct: '18.00' },
    ]

    for (const c of categories) {
      await ProductCategory.updateOrCreate({ name: c.name }, c)
    }
  }
}
