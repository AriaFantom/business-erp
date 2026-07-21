import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'
import proxyAddr from 'proxy-addr'

/**
 * The app URL can be used in various places where you want to create absolute
 * URLs to your application. For example, when sending emails, images should
 * use absolute URLs.
 */
export const appUrl = env.get('APP_URL')

/**
 * Whether the app is reached over HTTPS, derived from APP_URL. Gates every
 * https-only protection (Secure cookies, HSTS, upgrade-insecure-requests):
 * a production deploy on a plain-http LAN IP must not send them, or browsers
 * drop the session cookie and upgrade asset requests to a TLS port nothing
 * listens on (blank page).
 */
export const appServedOverHttps = appUrl.startsWith('https://')

/**
 * The configuration settings used by the HTTP server
 */
export const http = defineConfig({
  /**
   * Generate a unique request id for each incoming request.
   * Useful to correlate logs and debug a request flow.
   */
  generateRequestId: true,

  /**
   * Trust X-Forwarded-* headers from the reverse proxy in front of the app
   * (Nginx Proxy Manager / Caddy / Cloudflare). Without this, request.protocol()
   * stays "http" behind TLS termination, which breaks `secure` cookies and any
   * URL generation that relies on the original scheme. `loopback` + `uniquelocal`
   * covers 127.0.0.0/8, ::1, and all RFC1918 ranges (10/8, 172.16/12, 192.168/16)
   * — i.e. NPM on the same host or anywhere on the docker network.
   */
  trustProxy: proxyAddr.compile(['loopback', 'uniquelocal']),

  /**
   * Allow HTTP method spoofing via the "_method" form/query parameter.
   * This lets HTML forms target PUT/PATCH/DELETE routes while still
   * submitting with POST.
   */
  allowMethodSpoofing: false,

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: false,

  /**
   * Redirect configuration controls the behavior of
   * response.redirect().back() and query string forwarding.
   */
  redirect: {
    /**
     * When enabled, all redirects automatically carry over the current
     * request's query string parameters to the redirect destination.
     * Use withQs(false) to opt out for a specific redirect.
     */
    forwardQueryString: true,
  },

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ts" file.
   */
  cookie: {
    /**
     * Restrict the cookie to a specific domain.
     * Keep empty to use the current host.
     */
    domain: '',

    /**
     * Restrict the cookie to a URL path. '/' means all routes.
     */
    path: '/',

    /**
     * Default lifetime for cookies managed by the HTTP layer.
     */
    maxAge: '2h',

    /**
     * Prevent JavaScript access to the cookie in the browser.
     */
    httpOnly: true,

    /**
     * Send cookies only over HTTPS — but only when the app is actually
     * served over HTTPS (see appServedOverHttps above).
     */
    secure: app.inProduction && appServedOverHttps,

    /**
     * Cross-site policy for cookie sending.
     */
    sameSite: 'lax',
  },
})
