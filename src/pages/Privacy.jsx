const SECTIONS = ['collect', 'storage', 'transfer', 'errors', 'reports', 'cookies', 'rights']
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL

export default function Privacy({ t }) {
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
