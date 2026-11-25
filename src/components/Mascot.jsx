// 예전 캐릭터 "말새" 자리. 이제 우리 앱의 캐릭터는 다니라서, 이 자리에 다니 얼굴을 그린다.
// (첫 실행 안내와 홈의 한마디 카드가 이 컴포넌트를 쓴다. 꾸미기에서 고른 색을 그대로 따른다.)
import { cleanColors } from '../lib/growth'
import { local } from '../lib/storage'
import Dani from './Dani'

export default function Mascot({ size = 64, mood = 'happy' }) {
  return <Dani pose="face" mood={mood === 'happy' ? 'dot' : 'joy'} colors={cleanColors(local.getJson('daniColors'))} size={size} />
}
