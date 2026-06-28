import env from '#start/env'

/**
 * InfluxDB connection config for the dashboard/analytics time-series store.
 *
 * `enabled` is only true when the flag is set AND the required connection
 * details are present, so a half-configured environment behaves like a
 * disabled one (the app then renders empty charts instead of crashing).
 */
const url = env.get('INFLUX_URL')
const token = env.get('INFLUX_TOKEN')
const org = env.get('INFLUX_ORG')
const bucket = env.get('INFLUX_BUCKET')

const influxConfig = {
  enabled: env.get('INFLUX_ENABLED', false) === true && Boolean(url && token && org && bucket),
  url: url ?? '',
  token: token ? token.release() : '',
  org: org ?? '',
  bucket: bucket ?? '',
}

export default influxConfig
