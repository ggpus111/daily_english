import { useState } from 'react'
import { useApp } from '../../context'
import { useReminderSettings } from '../../hooks/useReminderSettings'
import { LANGUAGES, languageName } from '../../lib/i18n'
import { GOALS } from '../../lib/reminders'
import { THEMES, getTheme, saveTheme } from '../../lib/theme'
import ChoiceRow from './ChoiceRow'

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
    <section className="s-section" aria-labelledby="settings-study">
      <h2 id="settings-study">{t('settingsStudy')}</h2>
      <div className="s-list">
      <ChoiceRow
        label={t('learningLanguage')}
        name="learning-language"
        value={learningLang}
        options={languages}
        onChange={setLearningLang}
      />
      <ChoiceRow
        label={t('nativeLanguage')}
        name="native-language"
        value={nativeLang}
        options={languages}
        onChange={setNativeLang}
        hint={t('languageNote')}
      />
      <ChoiceRow
        label={t('reminderGoal')}
        name="daily-goal"
        value={settings.goal}
        options={GOALS.map((goal) => ({
          value: goal,
          label: goal === 0 ? t('reminderGoalOff') : t('reminderGoalCount', { count: goal }),
        }))}
        onChange={(goal) => update({ goal: Number(goal) })}
      />
      <ChoiceRow
        label={t('themeLabel')}
        name="theme"
        value={theme}
        options={THEMES.map((option) => ({ value: option, label: t(`theme.${option}`) }))}
        onChange={(value) => {
          setTheme(value)
          saveTheme(value)
        }}
      />
      </div>
    </section>
  )
}
