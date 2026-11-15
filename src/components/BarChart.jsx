// 한 가지 값만 그리는 막대 차트. 범례 없이 제목이 무엇을 그렸는지 말한다.
// - 막대는 24px 이하, 끝만 4px 둥글게, 바탕선은 가는 실선
// - 값 글자는 가장 큰 막대와 마지막 막대에만 붙이고, 나머지는 마우스를 올리면 보인다
// - 눈으로 보는 그림은 보조 기술에서 숨기고, 같은 내용을 "표로 보기"로 준다

const STEPS = [1, 2, 5, 10]

// 눈금 최대값을 1·2·5 단위의 깔끔한 수로 올린다.
function niceMax(value) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = STEPS.find((candidate) => candidate * power >= value)
  return step * power
}

/**
 * @param {object} props
 * @param {string} props.title 차트 제목(무엇을 그렸는지)
 * @param {Array<{ label: string, short?: string, value: number, tip: string }>} props.data
 * @param {'column' | 'bar'} [props.orientation] 세로 막대 또는 가로 막대
 * @param {(index: number) => boolean} [props.showTick] 아래쪽에 이름을 보여 줄 막대
 * @param {string} props.tableLabel "표로 보기" 문구
 * @param {[string, string]} props.columns 표의 열 이름
 * @param {string} [props.empty] 값이 모두 0일 때 문구
 */
export default function BarChart({ title, data, orientation = 'column', showTick, tableLabel, columns, empty }) {
  const largest = Math.max(0, ...data.map((item) => item.value))
  const max = niceMax(largest)
  const peak = data.findIndex((item) => item.value === largest)
  const labelled = (index) => largest > 0 && (index === peak || index === data.length - 1)
  const share = (value) => `${(value / max) * 100}%`

  return (
    <figure className="chart">
      <figcaption className="chart-title">{title}</figcaption>
      {largest === 0 && empty ? (
        <p className="chart-empty">{empty}</p>
      ) : orientation === 'column' ? (
        <div className="chart-plot" aria-hidden="true">
          <div className="chart-grid">
            <span data-tick={max} />
            {Number.isInteger(max / 2) && <span data-tick={max / 2} />}
            <span data-tick={0} />
          </div>
          <div className="chart-columns">
            {data.map((item, index) => (
              <div className="chart-col" key={item.label} data-tip={item.tip}>
                <div className="chart-col-area">
                  <div className="chart-col-bar" style={{ height: share(item.value) }}>
                    {labelled(index) && item.value > 0 && <span className="chart-value">{item.value}</span>}
                  </div>
                </div>
                <span className="chart-tick">{!showTick || showTick(index) ? (item.short ?? item.label) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="chart-rows" aria-hidden="true">
          {data.map((item) => (
            <div className="chart-row" key={item.label} data-tip={item.tip}>
              <span className="chart-row-label">{item.label}</span>
              <div className="chart-row-track">
                <div className="chart-row-bar" style={{ width: share(item.value) }} />
                <span className="chart-row-value">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <details className="chart-table">
        <summary>{tableLabel}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col">{columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>{item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
