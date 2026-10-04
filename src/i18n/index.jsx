import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import es from './es.js'
import quy from './quy.js'
import { readJSON, writeJSON } from '../data/storage.js'

export const LANGS = { es, quy }
const KEY = 'chakra.lang'

function lookup(dict, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict)
}

function interpolate(value, vars) {
  if (typeof value !== 'string' || !vars) return value
  return value.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`))
}

/** Translate `path` in `lang`, falling back to Spanish, then to the key itself. */
export function translate(lang, path, vars) {
  const v = lookup(LANGS[lang], path) ?? lookup(es, path)
  return v === undefined ? path : interpolate(v, vars)
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => (readJSON(KEY) === 'quy' ? 'quy' : 'es'))
  const setLang = useCallback((l) => { setLangState(l); writeJSON(KEY, l) }, [])
  useEffect(() => { document.documentElement.lang = lang === 'quy' ? 'quy' : 'es' }, [lang])
  const value = useMemo(() => ({
    lang,
    setLang,
    t: (path, vars) => translate(lang, path, vars),
    // Spanish text for speech synthesis (no Quechua voice exists yet).
    tEs: (path, vars) => translate('es', path, vars),
  }), [lang, setLang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
