# 실제 서버에 올리기 체크리스트

지금까지 서버 쪽(SQL, 서버 함수, 웹 푸시)은 가짜 서버로만 시험했습니다. 아래 순서대로 한 번 연결하면 실제로 되는지 확인할 수 있습니다.
각 단계 끝의 "확인"까지 통과해야 다음으로 넘어가세요. 막히면 어디서 막혔는지와 화면 문구만 알려 주면 됩니다.

비밀 값(키)은 채팅이나 코드에 붙여 넣지 마세요. 대시보드의 Secrets 칸에만 넣습니다.

## 0. 준비물

- GitHub 계정, Supabase 계정, Vercel 계정(모두 무료 요금제로 충분)
- Google AI Studio의 무료 Gemini API 키(AI 교정을 쓸 때만)

## 1. GitHub에 올리기

1. GitHub에서 빈 저장소를 만듭니다(README, .gitignore 추가 안 함).
2. 저장소 폴더에서 원격을 연결하고 올립니다.

   ```powershell
   git remote add origin https://github.com/<내 아이디>/daily-english.git
   git push -u origin main
   ```

3. 확인: GitHub 저장소 화면에 파일이 보이고, `.env`와 `supabase/vapid-keys.local.txt`는 **없어야** 합니다.

## 2. Supabase 프로젝트

1. 새 프로젝트를 만듭니다(지역은 가까운 곳, 예: Seoul).
2. SQL Editor에서 `supabase/schema.sql` 전체를 실행합니다. 여러 번 실행해도 됩니다.
3. 확인: Table Editor에 `study_records`, `couples`, `couple_members`, `couple_sentences`, `couple_reactions`, `couple_join_failures`, `push_queue`, `ai_usage` 등이 보이고, 각 표 옆에 RLS가 켜져 있다는 표시가 있어야 합니다.
4. Authentication > URL Configuration에서 Site URL을 나중에 정할 Vercel 주소로 맞춥니다(3단계 뒤에 다시 와서 채워도 됩니다).
5. 소셜 로그인을 쓰려면 Authentication > Providers에서 Google, Kakao를 켭니다(이메일 로그인만 쓸 거면 건너뜁니다).

## 3. Vercel 배포

1. Vercel에서 GitHub 저장소를 가져옵니다(Framework: Vite, 빌드 `npm run build`, 출력 `dist`).
2. Settings > Environment Variables에 `README.md`의 "배포 전 환경 변수" 표 값을 넣습니다. Supabase의 URL과 anon(public) 키는 Project Settings > API에 있습니다. **service_role 키는 넣지 않습니다.**
3. 배포 후 나온 주소를 Supabase의 Site URL과 Redirect URLs에 넣습니다.
4. 확인: 배포 주소에서 회원가입, 로그인, 단어 저장, 새로고침 후 유지가 됩니다.
5. 확인: 브라우저 개발자 도구 > Network에서 응답 헤더에 `Content-Security-Policy`가 있습니다.

## 4. 서버 함수와 알림 (선택, 쓸 기능만)

1. AI 교정: Edge Function `correct-journal`을 배포하고 Secrets에 `GEMINI_API_KEY`를 넣습니다. 확인: 일기에서 AI 교정을 한 번 눌러 결과가 나옵니다.
2. 웹 알림: `send-reminders`를 배포하고 Secrets에 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`을 넣습니다. `supabase/push-cron.sql`의 자리 표시를 바꿔 실행합니다.
3. 확인: 설정 > 알림에서 허용 후 "시험 알림 보내기"가 오고, 서버 함수를 `x-cron-secret` 없이 호출하면 403이 나와야 합니다.

## 5. 두 계정으로 연인 기능 점검

계정 두 개(예: 본인 이메일 두 개, 한쪽은 시크릿 창)로 확인합니다.

- [ ] A가 초대 번호를 만들고, B가 번호로 들어온다.
- [ ] 초대 번호를 일부러 6번 틀리면 5번째 뒤부터 "잠시 막았어요"가 나온다.
- [ ] A가 한 문장을 보내면 B 화면에 보인다. B가 새로 불러오면 홈에 "새 문장"이 뜬다.
- [ ] B가 "좋아요" 등 반응을 남기면 A 화면에 "…님이 반응했어요"가 보이고, 다시 누르면 사라진다.
- [ ] 알림을 켠 상대의 브라우저를 닫아 둬도 새 문장 알림이 10분 안에 온다(웹).
- [ ] 한쪽이 "짝 그만두기"를 하면 두 사람 모두에서 그 사람의 문장과 반응이 사라진다.

## 6. 안드로이드

- 로컬 환경에서 `npm run android:sync` 후 에뮬레이터나 폰에서 로그인, 연인 기능, 설정이 웹과 같은지 확인합니다.
- 앱을 닫은 상태의 서버 푸시(FCM)는 아직 없습니다. Firebase 프로젝트를 만든 뒤 이어서 할 수 있습니다.

## 7. 오픈 전

- [ ] `npm run build && npm run check:secrets`가 통과한다.
- [ ] 개인정보 처리방침의 문의 메일(`VITE_CONTACT_EMAIL`)이 공개해도 되는 주소다.
- [ ] 친구 몇 명에게 써 보게 하고, 막히는 곳을 적어 둔다(발표·이력서의 실제 사용 근거가 됩니다).
