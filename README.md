# Daily English

단어, 표현, 대화, 일기를 모으는 언어 학습 기록 앱입니다. Vite, React, Supabase로 만들었고 웹(PWA)과 안드로이드 앱(Capacitor)을 같은 코드로 만듭니다.

## 안드로이드 앱

웹 코드를 Capacitor 8로 감싸 안드로이드 앱을 만듭니다. Android Studio(2025.2.1 이상)와 Android SDK가 필요합니다.

```bash
npm run android:sync
npm run android:open
```

`android:sync`는 앱용으로 빌드(`vite build --mode app`, 서비스 워커 없음)한 뒤 `android/`에 복사합니다. `android:open`은 Android Studio를 엽니다. Android Studio 없이 APK만 만들려면 `android` 폴더에서 `gradlew assembleDebug`를 실행합니다. JAVA_HOME은 Android Studio에 들어 있는 JDK(`Android Studio/jbr`)로 맞춥니다.

앱에서 달라지는 점
- 소셜 로그인은 구글이 앱 안 웹뷰 로그인을 막기 때문에 시스템 브라우저로 열고, `com.dailyenglish.app://auth-callback` 딥링크로 돌아옵니다. Supabase Redirect URLs에 이 주소를 추가해야 합니다.
- 비밀번호 재설정은 웹(`VITE_SITE_URL`)에서 끝냅니다.
- 기록 내려받기는 공유 창으로 저장할 곳을 고릅니다.
- 상태바와 내비게이션 바 여백은 Capacitor가 주는 `--safe-area-inset-*` 값으로 맞춥니다.

앱 ID `com.dailyenglish.app`은 Play 스토어에 한 번 올리면 바꿀 수 없습니다. 출시 전에 확정하세요. 바꾸려면 `capacitor.config.json`, `src/lib/platform.js`, `AndroidManifest.xml`을 함께 고칩니다.

아이콘과 시작 화면은 `npm run dev`를 켠 상태에서 `node scripts/make-app-icons.mjs http://localhost:5173/`로 다시 만듭니다.

### 보안 설정

- `res/xml/network_security_config.xml`이 암호화하지 않은 http 통신을 막습니다. 인증서 피닝은 하지 않습니다. 웹뷰에는 적용되지 않고, Supabase·구글·카카오가 인증서를 바꾸면 앱이 멈출 수 있기 때문입니다.
- `allowBackup="false"`라서 로그인 토큰이 든 앱 저장소가 구글 클라우드 백업에 올라가지 않습니다. Android 12 이상에서 기기끼리 직접 옮기는 이전은 됩니다.
- 공유 창(`FileProvider`)에는 캐시 폴더만 엽니다. 기록 내보내기 파일만 그곳에 만듭니다.
- 앱에 들어가는 Supabase anon key는 공개용 키이고, 데이터는 행 단위 권한(RLS)으로 지킵니다. service_role 키는 앱이나 저장소에 넣지 않습니다.
- `res/xml/config.xml`의 `<access origin="*">`는 `cap sync`가 다시 만드는 Cordova 플러그인용 파일이라 고치지 않습니다. Cordova 플러그인을 쓰지 않아 영향이 없습니다.

### 릴리즈 빌드와 서명

릴리즈 빌드는 R8로 코드와 리소스를 줄입니다(`minifyEnabled`, `shrinkResources`). Capacitor 플러그인을 지키는 규칙은 `@capacitor/android`에 들어 있습니다.

1. 업로드 키를 직접 만듭니다. 비밀번호는 직접 정하고, 키 파일과 비밀번호를 잃어버리지 않게 따로 보관합니다(비밀번호 관리자, 개인 클라우드 등). Play App Signing을 쓰면 업로드 키를 잃어도 Play Console에서 재설정을 요청할 수 있습니다.
   ```bash
   "C:/Program Files/Android/Android Studio/jbr/bin/keytool" -genkeypair -v -keystore android/upload-key.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. `android/keystore.properties.example`을 `android/keystore.properties`로 복사하고 값을 채웁니다. `*.jks`와 `keystore.properties`는 `.gitignore`에 들어 있어 git에 올라가지 않습니다.
3. `npm run android:sync` 뒤 `android` 폴더에서 `gradlew bundleRelease`를 실행하면 `app/build/outputs/bundle/release/app-release.aab`가 만들어집니다. Play Console에 이 파일을 올립니다.

### Play 스토어 출시 전 확인

- 타깃 API는 36입니다(`android/variables.gradle`). Play가 요구하는 최신 기준을 출시 시점에 다시 확인합니다.
- 권한은 인터넷 하나입니다. 실행 중 허락받는 권한(위치, 카메라, 알림 등)은 쓰지 않습니다. 알림 리마인더를 넣으면 알림 권한 요청과 거부했을 때의 안내 화면을 함께 만듭니다.
- 개인정보 처리방침은 공개 웹 주소가 필요합니다. 웹을 배포한 뒤 `https://<배포 주소>/#privacy`를 Play Console에 넣습니다.
- 계정 삭제는 앱 안(프로필)과 웹 모두에서 할 수 있어야 합니다. 배포한 웹에서 로그인한 뒤 프로필에서 계정을 삭제할 수 있으므로, 이 방법을 처리방침에 적고 그 주소를 Play Console의 계정 삭제 항목에 넣습니다.
- 데이터 보안 섹션: 수집하는 데이터는 이메일 주소(계정)와 사용자가 쓴 학습 기록·일기(앱 기능)입니다. 다른 곳에 공유하지 않고, 전송 중 암호화(HTTPS)되며, 사용자가 삭제할 수 있습니다. 광고와 분석 도구는 쓰지 않습니다.

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

요청문은 `src/lib/correction.js`가 만듭니다. 따로 넣을 칸이 없는 무료 채팅이라 시스템 프롬프트 역할을 요청문 맨 위에 둡니다.

- 맨 위에 역할과 지킬 점(시스템 프롬프트 역할)을 둡니다.
- 지난 교정의 "연습할 점"과 최근 저장한 단어를 그때그때 넣습니다(동적 컨텍스트).
- 모범 답 하나를 보여 줍니다(Few-Shot).
- "고친 문장 / 고칠 점 / 잘한 점 / 연습할 점" 네 제목으로만 답하게 합니다(출력 고정).

앱은 붙여 넣은 답을 이 제목으로 나눠 보여 주고, 형식이 다르면 글 그대로 보여 줍니다.

## 표현·단어 꾸러미

처음 쓰는 사람도 바로 담을 거리가 있게 꾸러미를 넣었습니다(`#packs`, `#packs-words`, 홈의 "오늘의 표현"). 꾸러미는 학습 언어가 영어일 때만 보입니다.

- **표현 400개**(10개 주제 × 40): 공개 영어 문장 204만 개(Tatoeba, CC BY 2.0 FR)에서 쓰인 횟수를 세고 교육과정 기본 어휘와 비교해 골랐습니다. 뜻과 예문은 직접 썼습니다. `analysis/native/build_packs.py` → `src/data/packs.json`
- **단어 600개**(초급 300, 중급 300): 교육과정 기본 어휘에서 전체 문장 빈도와 "나를 말하는 문장"(1인칭 문장) 빈도로 골랐습니다. 예문 457개는 Tatoeba 한영 문장이고 카드에 문장 번호 링크로 출처를 밝힙니다. 나머지 143개는 직접 썼습니다. `analysis/native/select_words.py`, `build_words.py` → `src/data/words.json`
- 콘텐츠는 앱 성격(내 하루와 기분을 기록하는 따뜻한 앱)에 맞게 점검했습니다. 어두운 낱말 제외, 기분 낱말 포함, 내 말투 예문 우선. 근거와 수치는 `analysis/REPORT.md`에 있고, `src/lib/packs.test.js`가 이 기준을 검사합니다.
- 꾸러미 데이터는 처음 필요할 때 따로 불러옵니다(`loadPackData`, `usePackData`). 첫 화면 코드에 묶이지 않아 앱 시작이 느려지지 않습니다.

발음 듣기는 기기에 내장된 음성 읽기(Web Speech API)를 씁니다. 지원하지 않는 환경에서는 듣기 버튼이 보이지 않습니다.

## 백업과 오프라인

- **백업 가져오기**: 프로필의 "파일에서 가져오기"로 내려받은 백업(.json)이나 원본 앱 저장 형식을 다시 불러옵니다(`src/lib/backup.js`). 파일 내용은 믿지 않고 아는 칸만, 정해진 길이로만 받습니다. 이미 있는 기록(같은 id나 같은 내용)은 건너뛰고, 가져오기 전에 몇 개를 더할지 보여 줍니다.
- **오프라인 저장**: 로그인 모드에서 연결이 끊긴 채 저장·수정·삭제하면 이 기기에 줄 세워 두었다가(`pendingOps:<user id>`), 연결되면 차례로 서버에 올립니다. 마지막으로 불러온 기록은 이 기기에 남겨(`recordsCache:<user id>`) 연결 없이 열어도 먼저 보여 주고, 서버에서 받아 오면 바꿉니다. 로그아웃하면 이 사본을 지우고, 계정을 삭제하면 줄 선 변경까지 지웁니다.

## 화면 테마

프로필의 "화면 테마"에서 기기 설정 따르기·밝게·어둡게를 고릅니다. 어두운 테마는 같은 따뜻한 색을 짙은 갈색으로 옮겼고, 모든 화면에서 글자 대비 검사를 통과합니다(`e2e/app.spec.js`).

## Pro 시연판 (발표용)

`#pro` 화면은 결제 기능 없이 유료 요금제를 보여 주는 시연판입니다. "Pro 미리 보기"를 켜면 내 기록으로 만든 학습 통계(최근 4주 기록, 기억 단계, 앞으로 7일 복습)를 볼 수 있고, 통계는 기기 안에서만 계산합니다. 가격은 월 4,900원(한 달 결제만, 연간 요금제 없음, 무료 체험 뒤 자동 결제 없음)이며 근거는 `analysis/pricing/README.md`에 있습니다. `src/lib/i18n.js`의 `planProPrice`에서 바꿉니다. 앱 안 AI 교정은 출시 때 연결할 기능으로만 표시합니다.

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
