# Daily English

단어, 표현, 대화, 일기를 모으는 언어 학습 기록 앱입니다. Vite, React, Supabase로 만들었고 PWA로 설치할 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

`.env`가 없으면 로그인 없이 이 브라우저에만 저장하는 로컬 모드로 실행됩니다.

## Supabase 연결

1. 원본 앱이 쓰던 Supabase 프로젝트를 이어서 쓰거나, 새 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다. 새 표 `study_records`가 만들어집니다.
3. 원본 앱의 기록을 옮기려면 이어서 `supabase/migrate-from-original.sql`을 실행합니다. 원본 표 `learning_records`는 읽기만 하고 바꾸지 않으며, 여러 번 실행해도 중복되지 않습니다. 마지막에 종류별 개수를 비교해 보여 줍니다.
4. `.env.example`을 `.env`로 복사하고 프로젝트 URL과 anon key를 넣습니다.
5. Authentication > URL Configuration에서 Site URL을 배포 주소로 맞추고, Redirect URLs에 배포 주소와 `http://localhost:5173`을 추가합니다. 소셜 로그인과 비밀번호 재설정이 이 주소로 돌아옵니다.

연결하면 로그인 화면이 켜지고, 로컬 모드에서 쌓인 기록은 첫 로그인 때 계정으로 옮겨집니다. 원본 앱이 브라우저에 남긴 기록은 로컬 모드에서만 읽습니다. 로그인 모드에서는 클라우드에 있는 원본 기록을 위 SQL로 옮깁니다.

## 로그인 방식

이메일, 구글, 카카오를 지원합니다. 모두 무료입니다. 소셜 로그인 버튼은 `VITE_AUTH_PROVIDERS`에 적은 공급자만 보입니다. 예: `google,kakao`

공통으로 Supabase Authentication > Providers에서 공급자를 켜고, 각 서비스의 Redirect URI에 `https://<project-ref>.supabase.co/auth/v1/callback`을 넣습니다.

**구글**
1. Google Cloud Console에서 OAuth 동의 화면(Google Auth Platform)을 설정합니다.
2. 사용자 인증 정보에서 웹 애플리케이션 유형의 OAuth 클라이언트를 만듭니다. 승인된 JavaScript 원본에 배포 주소를 넣습니다.
3. 클라이언트 ID와 보안 비밀을 Supabase의 Google 공급자에 넣습니다.

**카카오**
1. Kakao Developers에서 앱을 만들고, REST API 키를 Client ID로, 카카오 로그인 Client Secret을 Client Secret으로 Supabase에 넣습니다.
2. 카카오 로그인을 켜고 State 사용을 켭니다.
3. 이메일을 받으려면 앱을 비즈 앱으로 전환해야 합니다. 사업자 없이도 본인인증을 하면 개인 개발자 비즈 앱으로 전환할 수 있습니다.
4. 이메일 없이 쓰려면 동의항목에서 이메일을 빼고, Supabase 카카오 설정에서 Allow users without an email을 켭니다.

같은 이메일로 여러 방식으로 가입하면 Supabase가 한 계정으로 연결합니다. 이메일 없이 가입한 카카오 계정은 따로 취급됩니다.

애플 로그인은 Apple Developer Program(연 $99)이 필요하고 키를 6개월마다 갱신해야 해서 넣지 않았습니다. 앱스토어에 iOS 앱을 낼 때 다시 검토합니다.

**이메일 인증**

Authentication > Providers > Email에서 Confirm email을 켭니다. 인증 메일이 실제로 가려면 아래 Custom SMTP 설정이 필요합니다.

## AI 일기 교정

유료 API를 쓰지 않습니다. 일기 화면의 복사 버튼이 일기와 번역을 교정 요청 문장으로 만들어 복사하고, 사용자가 무료 AI 채팅에 붙여 넣습니다. 받은 교정은 AI 교정 결과 칸에 붙여 넣어 일기와 함께 저장합니다.

## 무료로 운영하기

Vercel Hobby와 Supabase Free를 쓰면 월 비용은 $0입니다.

- Vercel Hobby는 개인, 비상업 용도만 가능합니다.
- Supabase 기본 메일은 Supabase 팀원 주소로만, 시간당 2통까지 보냅니다. 다른 사람에게 인증 메일과 비밀번호 재설정 메일을 보내려면 Authentication > Emails에서 Custom SMTP를 설정해야 합니다. 무료로는 Gmail을 쓸 수 있습니다. Google 계정에서 2단계 인증을 켜고 앱 비밀번호를 만든 뒤 호스트 `smtp.gmail.com`, 포트 `587`, 사용자 이름은 Gmail 주소, 비밀번호는 앱 비밀번호로 넣습니다. 보내는 사람 주소는 그 Gmail 주소가 됩니다. Resend는 자기 도메인이 있어야 해서 도메인 비용이 듭니다.
- Supabase Free는 자동 백업이 없습니다. 프로필의 내 기록 내려받기로 백업하세요.
- 1주일간 사용이 없으면 프로젝트가 일시 정지됩니다. 대시보드에서 다시 켜면 됩니다.

## 검사

```bash
npm run lint
npm test
npm run test:e2e
```

`npm run test:e2e`는 설치된 Chrome으로 접근성 검사(axe), 화면 흐름, 보안 헤더를 확인합니다. 화면 캡처는 `e2e-shots`에 저장됩니다. `npm run check`는 세 가지를 모두 실행합니다.

## 배포 전 환경 변수

| 이름 | 어디에 | 용도 |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Vercel, `.env` | 로그인과 기록 저장 |
| `VITE_AUTH_PROVIDERS` | Vercel, `.env` | 보여 줄 소셜 로그인 (예: `google,kakao`) |
| `VITE_SITE_URL` | Vercel | canonical, 공유 미리보기, sitemap |
| `VITE_CONTACT_EMAIL` | Vercel | 개인정보 처리방침의 문의처 |

## 구조

- `src/pages`: 화면별 컴포넌트
- `src/components`: 퀴즈, 입력칸, 삭제 버튼 같은 공용 부품
- `src/hooks/useRecordForm.js`: 기록 입력 폼의 공통 동작
- `src/lib/records.js`: 기록 저장과 불러오기
- `src/lib/storage.js`: 브라우저 저장소 안전 접근
- `src/lib/i18n.js`: 언어 목록과 화면 문구
- `src/lib/legacy.js`: 원본 앱 형식의 기록을 지금 형식으로 변환
- `src/components/SocialLogin.jsx`: 구글, 카카오 로그인 버튼
- `supabase/schema.sql`: 표, 권한, 회원 탈퇴 함수
- `supabase/migrate-from-original.sql`: 원본 앱 기록 이전
- `vercel.json`: 보안 헤더와 캐시 설정
- `scripts/make-images.mjs`: 앱 아이콘과 공유 이미지 생성
