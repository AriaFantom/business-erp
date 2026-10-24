import './css/app.css'
import { ReactElement } from 'react'
import { client } from './client'
import Layout from '~/layouts/default'
import { Data } from '@generated/data'
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'
import { TuyauProvider } from '@adonisjs/inertia/react'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import {
  formatDocumentTitle,
  initializeDocumentBranding,
  setInitialDashboardName,
} from '@/lib/document-branding'

const appName = import.meta.env.VITE_APP_NAME || 'LayerDreams Panel'
setInitialDashboardName(appName)

createInertiaApp({
  title: formatDocumentTitle,
  resolve: (name) => {
    return resolvePageComponent(
      `./pages/${name}.tsx`,
      import.meta.glob('./pages/**/*.tsx'),
      (page: ReactElement<Data.SharedProps>) => <Layout children={page} />
    )
  },
  setup({ el, App, props }) {
    const { branding, user } = props.initialPage.props as unknown as Data.SharedProps
    initializeDocumentBranding(branding, Boolean(user))

    createRoot(el).render(
      <TuyauProvider client={client}>
        <App {...props} />
      </TuyauProvider>
    )
  },
  progress: {
    color: '#4B5563',
  },
})
