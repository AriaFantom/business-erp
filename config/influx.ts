import env from '#start/env'

/**
 * InfluxDB connection config for the dashboard/analytics time-series store.
 *
 * Enabling Influx makes configuration and startup connectivity mandatory.
 * Disabled local installations still render empty charts.
 */
const url = env.get('INFLUX_URL')
const token = env.get('INFLUX_TOKEN')
const org = env.get('INFLUX_ORG')
const bucket = env.get('INFLUX_BUCKET')

const influxConfig = {
  enabled: env.get('INFLUX_ENABLED', false) === true,
  url: url ?? '',
  token: token ? token.release() : '',
  org: org ?? '',
  bucket: bucket ?? '',
}

export default influxConfig
