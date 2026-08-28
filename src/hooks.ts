import { useCallback, useEffect, useState } from 'react'

export function useHashRoute() {
  const readHash = () => window.location.hash.replace(/^#\/?/, '') || 'overview'
  const [route, setRoute] = useState(readHash)

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readHash())
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: string) => {
    window.location.hash = `/${next}`
  }, [])

  return { route, navigate }
}

export function useLocalStorageSet(key: string) {
  const [items, setItems] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'))
    } catch {
      return new Set()
    }
  })

  const toggle = useCallback((id: string) => {
    setItems((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(key, JSON.stringify([...next]))
      return next
    })
  }, [key])

  return { items, toggle }
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('atl-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('atl-theme', theme)
  }, [theme])

  return { theme, toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }
}
