import { useMemo, useState } from 'react'
import PageHead from '../components/PageHead'
import Quiz from '../components/Quiz'
import { useApp } from '../context'
import { errorMessage } from '../lib/errors'
import { schedule, weakItems } from '../lib/review'

const KINDS = ['word', 'expression']

/** 헷갈리는 말: 퀴즈에서 틀렸고 아직 익숙해지지 않은 단어와 표현을 모아 다시 풀게 한다. */
export default function Missed() {
  const { t, notify, records, update, learningLang, go } = useApp()
  // 퀴즈를 푸는 동안 목록이 바뀌어도 문제 덱은 그대로 두려고, 열 때의 목록을 따로 잡아 둔다.
  const [quizItems, setQuizItems] = useState(null)

  const weak = useMemo(
    () =>
      KINDS.flatMap((type) => weakItems(records[type]).map((item) => ({ ...item, recordType: type }))).sort(
        (a, b) => b.misses - a.misses,
      ),
    [records],
  )

  async function saveAnswer(item, correct) {
    const { error } = await update(item.recordType, item.id, schedule(item, correct))
    if (error) notify(t('saveError', { message: errorMessage(error, t) }))
  }

  return (
    <>
      <PageHead title={t('missedTitle')} intro={t('missedIntro')} />

      {quizItems && (
        <Quiz items={quizItems} initialMode="toMeaning" onClose={() => setQuizItems(null)} onAnswer={saveAnswer} />
      )}

      {weak.length === 0 ? (
        <section className="panel stack-form">
          <p>{t('missedEmpty')}</p>
          <button className="soft-button" onClick={() => go('home')}>
            {t('missedBack')}
          </button>
        </section>
      ) : (
        <section className="panel stack-form" aria-labelledby="missed-list-title">
          <h2 id="missed-list-title">{t('missedCount', { count: weak.length })}</h2>
          {!quizItems && (
            <button className="primary-button" onClick={() => setQuizItems(weak)}>
              {t('missedQuiz')}
            </button>
          )}
          <ul className="missed-list">
            {weak.map((item) => (
              <li key={item.id}>
                <div>
                  <strong lang={learningLang}>{item.text}</strong>
                  <span className="missed-kind">{t(`missedKind.${item.recordType}`)}</span>
                </div>
                <p>{item.meaning}</p>
                <small className="muted">
                  {t('missedTimes', { misses: item.misses, reviews: item.reviews ?? item.misses })}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
