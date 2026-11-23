// 배포한 서버(Supabase 서울 프로젝트)의 공개 값. 둘 다 원래 브라우저에 그대로 들어가는 값이라(publishable 키)
// 코드에 두어도 괜찮다. 남의 기록을 막는 건 데이터베이스의 행 단위 보안(RLS)이다.
// 배포 화면(Vercel 등)이나 .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY가 있으면 그 값을 먼저 쓴다.
// 빈 값('')을 주면 서버 없이 로컬 모드로 돈다(테스트가 이렇게 쓴다).
// 비밀 키(service_role, sb_secret_)와 AI(Claude, Gemini) 키는 절대 여기에 넣지 않는다(서버의 Supabase Secrets에만).
export const DEFAULT_SUPABASE_URL = 'https://qrehxzbmjtiqybnzsrqp.supabase.co'
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ugE-67sk00ecXFxmcabKSQ_DYrN2WNP'
