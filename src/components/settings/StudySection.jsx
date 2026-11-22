import { useState } from 'react'
import { useApp } from '../../context'
import { useReminderSettings } from '../../hooks/useReminderSettings'
import { LANGUAGES, languageName } from '../../lib/i18n'
import { GOALS } from '../../lib/reminders'
import { THEMES, getTheme, saveTheme } from '../../lib/theme'
import ChoiceChips from '../ChoiceChips'

/** 설정의 "학습과 화면": 배우는 언어, 내 언어, 하루 목표, 화면 테마. */
export default function StudySection() {
  const { t, nativeLang, setNativeLang, learningLang, setLearningLang } = useApp()
  const [settings, update] = useReminderSettings()
  const [theme, setTheme] = useState(getTheme)
  const languages = LANGUAGES.map((language) => ({
    value: language.code,
    label: languageName(language.code, nativeLang),
  }))

  return (
    <section className="panel settings-group" aria-labelledby="settings-study">
      <h2 id="settings-study">{t('settingsStudy')}</h2>
      <ChoiceChips
        compact
        label={t('learningLanguage')}
        name="learning-language"
        value={learningLang}
        options={languages}
        onChange={setLearningLang}
      />
      <ChoiceChips
        compact
        label={t('nativeLanguage')}
        name="native-language"
        value={nativeLang}
        options={languages}
        onChange={setNativeLang}
        hint={t('languageNote')}
      />
      <ChoiceChips
        compact
        label={t('reminderGoal')}
        name="daily-goal"
        value={settings.goal}
        options={GOALS.map((goal) => ({
          value: goal,
          label: goal === 0 ? t('reminderGoalOff') : t('reminderGoalCount', { count: goal }),
        }))}
        onChange={(goal) => update({ goal: Number(goal) })}
      />
      <ChoiceChips
        compact
        label={t('themeLabel')}
        name="theme"
        value={theme}
        options={THEMES.map((option) => ({ value: option, label: t(`theme.${option}`) }))}
        onChange={(value) => {
          setTheme(value)
          saveTheme(value)
        }}
      />
    </section>
  )
}
