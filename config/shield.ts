import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  /**
   * Configure CSP policies for your app. Refer documentation
   * to learn more.
   *
   * CSP is enabled in production only — the Vite dev server
   * ships an inline-script snippet for HMR that would otherwise
   * be blocked. In prod, Vite emits hashed bundles served from
   * the same origin, so 'self' covers it.
   */
  csp: {
    enabled: app.inProduction,

    directives: {
      'default-src': [`'self'`],
      'base-uri': [`'self'`],
      'font-src': [`'self'`, 'https:', 'data:'],
      'form-action': [`'self'`],
      'frame-ancestors': [`'none'`],
      // S3/MinIO-signed URLs for catalog images live on a different host.
      // Allow data: (small inline icons) and https: (signed S3 URLs).
      'img-src': [`'self'`, 'data:', 'blob:', 'https:'],
      'object-src': [`'none'`],
      'script-src': [`'self'`],
      'script-src-attr': [`'none'`],
      // Tailwind utilities + shadcn rely on inline style attributes
      // (e.g. for animations and CSS variable bindings).
      'style-src': [`'self'`, `'unsafe-inline'`],
      'connect-src': [`'self'`, 'https:'],
      'upgrade-insecure-requests': [],
    },

    reportOnly: false,
  },

  /**
   * Configure CSRF protection options. Refer documentation
   * to learn more.
   */
  csrf: {
    /**
     * Enable CSRF token verification for state-changing requests.
     */
    enabled: true,

    /**
     * Route patterns to exclude from CSRF checks.
     * Useful for external webhooks or API endpoints.
     */
    exceptRoutes: [],

    /**
     * Expose an encrypted XSRF-TOKEN cookie for frontend HTTP clients.
     */
    enableXsrfCookie: true,

    /**
     * HTTP methods protected by CSRF validation.
     */
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  /**
   * Control how your website should be embedded inside
   * iframes.
   */
  xFrame: {
    /**
     * Enable the X-Frame-Options header.
     */
    enabled: true,

    /**
     * Block all framing attempts. Default value is DENY.
     */
    action: 'DENY',
  },

  /**
   * Force browser to always use HTTPS.
   *
   * Disabled outside production so local plain-HTTP dev isn't pinned
   * to HTTPS by a stale browser cache.
   */
  hsts: {
    enabled: app.inProduction,
    maxAge: '180 days',
    includeSubDomains: true,
  },

  /**
   * Disable browsers from sniffing content types and rely only
   * on the response content-type header.
   */
  contentTypeSniffing: {
    /**
     * Enable X-Content-Type-Options: nosniff.
     */
    enabled: true,
  },
})

export default shieldConfig
