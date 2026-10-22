import vine from '@vinejs/vine'

export const renameDashboardValidator = vine.compile(
  vine.object({ name: vine.string().trim().minLength(1).maxLength(80) })
)

export const dashboardIconValidator = vine.compile(
  vine.object({ icon: vine.file({ size: '2mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }) })
)
