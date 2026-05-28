'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'

type Locale = 'id' | 'en'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'id',
  setLocale: () => {},
  toggleLocale: () => {},
})

export function useLocale() {
  return useContext(LocaleContext)
}

// Dynamically import messages
async function loadMessages(locale: Locale) {
  if (locale === 'en') {
    return (await import('../../messages/en.json')).default
  }
  return (await import('../../messages/id.json')).default
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('id')
  const [messages, setMessages] = useState<Record<string, any> | null>(null)
  const [mounted, setMounted] = useState(false)

  // Read locale from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('shrimpie-locale') as Locale | null
    if (saved === 'en' || saved === 'id') {
      setLocaleState(saved)
    }
    setMounted(true)
  }, [])

  // Load messages whenever locale changes
  useEffect(() => {
    loadMessages(locale).then(setMessages)
  }, [locale])

  // Update html lang attribute when locale changes
  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = locale
    }
  }, [locale, mounted])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('shrimpie-locale', newLocale)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'id' ? 'en' : 'id')
  }, [locale, setLocale])

  // Don't render until messages are loaded
  if (!messages) {
    return null
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, toggleLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}
