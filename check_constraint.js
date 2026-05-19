import('./ace')
  .then(async ({ default: { ace } }) => {
    const db = await ace('lucid.db')
    const result = await db.connection().raw(
      "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'expenses' AND constraint_type = 'CHECK'"
    )
    console.log('CHECK constraints on expenses table:')
    result.rows.forEach(r => console.log('  -', r.constraint_name))
    process.exit(0)
  })
