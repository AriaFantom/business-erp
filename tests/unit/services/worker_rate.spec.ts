import { test } from '@japa/runner'
import { effectiveHourlyRate } from '#services/worker_service'

test.group('worker rates: effectiveHourlyRate', () => {
  test('an hourly worker bills their stated rate', ({ assert }) => {
    const rate = effectiveHourlyRate({
      payType: 'hourly',
      hourlyRate: '150',
      monthlySalary: '0',
      standardMonthlyHours: 208,
    })
    assert.equal(rate, 150)
  })

  test('a monthly worker bills salary divided by standard hours', ({ assert }) => {
    const rate = effectiveHourlyRate({
      payType: 'monthly',
      hourlyRate: '0',
      monthlySalary: '20800',
      standardMonthlyHours: 208,
    })
    assert.equal(rate, 100)
  })

  test('the derived monthly rate is rounded to paise', ({ assert }) => {
    const rate = effectiveHourlyRate({
      payType: 'monthly',
      hourlyRate: '0',
      monthlySalary: '10000',
      standardMonthlyHours: 208,
    })
    // 10000 / 208 = 48.0769…
    assert.equal(rate, 48.08)
  })

  test('a monthly worker with no standard hours costs nothing rather than dividing by zero', ({
    assert,
  }) => {
    const rate = effectiveHourlyRate({
      payType: 'monthly',
      hourlyRate: '0',
      monthlySalary: '20800',
      standardMonthlyHours: 0,
    })
    assert.equal(rate, 0)
  })

  test('an hourly worker ignores any salary left on the record', ({ assert }) => {
    const rate = effectiveHourlyRate({
      payType: 'hourly',
      hourlyRate: '75',
      monthlySalary: '99999',
      standardMonthlyHours: 208,
    })
    assert.equal(rate, 75)
  })
})
