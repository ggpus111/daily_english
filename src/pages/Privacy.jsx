import { useEffect } from 'react'

const SECTIONS = ['collect', 'storage', 'transfer', 'errors', 'reports', 'push', 'couple', 'stats', 'cookies', 'rights']
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL

export default function Privacy({ t }) {
  // 앱 틀 밖에서 그려지는 화면이라 탭 제목을 여기서 바꾼다.
  useEffect(() => {
    document.title = `${t('privacy')} · Daily English`
  }, [t])

  return (
    <main className="legal-page">
      <a className="inline-link" href="#home">
        {t('privacyBack')}
      </a>
      <h1>{t('privacy')}</h1>
      {SECTIONS.map((section) => (
        <section key={section}>
          <h2>{t(`privacy.${section}.title`)}</h2>
          <p>{t(`privacy.${section}.body`)}</p>
        </section>
      ))}
      <section>
        <h2>{t('privacy.contact.title')}</h2>
        {CONTACT_EMAIL ? (
          <p>
            <a className="inline-link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        ) : (
          <p>{t('privacy.contact.fallback')}</p>
        )}
      </section>
    </main>
  )
}
