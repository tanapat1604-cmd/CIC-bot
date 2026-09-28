import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/noto-sans-thai/thai-400.css'
import '@fontsource/noto-sans-thai/thai-500.css'
import '@fontsource/noto-sans-thai/thai-600.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import Router from './Router'
import './base.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Router /></React.StrictMode>)
