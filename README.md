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
- 권한은 인터넷과 알림입니다. 알림 플러그인이 POST_NOTIFICATIONS(Android 13 이상 알림), RECEIVE_BOOT_COMPLETED(휴대폰을 껐다 켜도 예약 유지), WAKE_LOCK을 넣고, 정확한 알람 권한은 뺐습니다. 알림 권한은 프로필에서 알림을 켤 때만 묻고, 거부하면 설정에서 켜는 방법을 알려 줍니다. 위치, 카메라 등은 쓰지 않습니다.
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

## 일기에서 단어장으로

"오늘 내가 쓴 말이 내 단어장이 되는" 흐름을 이렇게 잇습니다.

- **교정에서 바로 담기**: 저장한 일기의 "고칠 점"마다 표현 모음에 담는 버튼이 있습니다. 고친 말이 표현, "원래 쓴 말 · 이유"가 뜻, 고친 문장이 예문이 됩니다(`fixToExpression`). 이렇게 담은 표현은 복습 때 원래 쓴 말과 이유를 보고 고친 말을 떠올리게 합니다(`source: 'journal'`).
- **오늘의 기분**: 일기를 쓸 때 기분을 영어 낱말 12개 중에서 고릅니다(`src/lib/moods.js`, 모두 단어 꾸러미의 기분 낱말). 고르면 그 낱말을 쓴 예문을 보여 주고 단어장에 담을 수 있습니다. 학습 언어가 영어일 때만 보입니다.
- **빈칸 채우기 퀴즈**: 예문 속 단어를 빈칸으로 만들어 문장 안에서 떠올리게 합니다(`src/lib/blank.js`). 규칙 활용형, 자음 겹침, 자주 쓰는 불규칙 동사까지 찾아 꾸러미 단어 600개 중 599개, 표현 400개 중 391개에서 빈칸을 만듭니다. 예문에 단어가 없는 기록은 빠집니다.
- **일기에 쓴 내 표현**: 일기 번역을 쓰는 동안 내가 모은 단어·표현(활용형 포함)을 찾아 보여 주고, 지난 일기마다 쓴 내 표현을 표시합니다(`src/lib/usage.js`). "담은 말을 실제로 썼는가"는 베타 테스트의 핵심 지표로 쓸 수 있습니다.
- **오늘의 표현 미션**: 일기 화면과 홈에서 오늘의 표현을 일기에 써 보게 하고, 쓰면 도장이 찍힙니다.
- **요일 도장의 기분**: 홈의 이번 주 도장이 그날 고른 기분에 따라 색이 바뀌고(좋은 날·힘든 날·그 밖), 아래에 기분 낱말을 모아 보여 줍니다.
- **이번 주 돌아보기**: 오늘 포함 7일의 새 단어·표현, 일기, 복습한 말, 일기에 쓴 내 표현, 기분을 홈에 모으고, 세로형 이미지(1080×1350)로 저장합니다. 안드로이드 앱에서는 공유 창으로 보냅니다(`src/lib/recapImage.js`).

## 첫 실행 안내

기록이 하나도 없는 첫 실행에는 홈 대신 세 단계 안내를 보여 줍니다(`src/components/Onboarding.jsx`). 학습 언어가 영어일 때만 보입니다.

1. 단어 꾸러미를 시작할 단계(초급·중급)를 고릅니다. 단어 꾸러미가 이 단계부터 열립니다.
2. 자주 쓰는 표현 9개 중 마음에 드는 것을 담습니다. 첫날부터 복습할 거리가 생깁니다.
3. 오늘 기분을 고르고 한 줄 일기를 씁니다. 방금 담은 표현을 영어 문장에 쓰면 찾아서 보여 줍니다.

어느 단계에서든 "나중에 할게요"로 건너뛸 수 있고, 한 번 끝내거나 건너뛰면 다시 뜨지 않습니다. 브라우저 저장소가 막혀 있으면 매번 뜨지 않도록 안내를 건너뜁니다.

## 표현·단어 꾸러미

처음 쓰는 사람도 바로 담을 거리가 있게 꾸러미를 넣었습니다(`#packs`, `#packs-words`, 홈의 "오늘의 표현"). 꾸러미는 학습 언어가 영어일 때만 보입니다.

- **표현 400개**(10개 주제 × 40): 공개 영어 문장 204만 개(Tatoeba, CC BY 2.0 FR)에서 쓰인 횟수를 세고 교육과정 기본 어휘와 비교해 골랐습니다. 뜻과 예문은 직접 썼습니다. `analysis/native/build_packs.py` → `src/data/packs.json`
- **단어 600개**(초급 300, 중급 300): 교육과정 기본 어휘에서 전체 문장 빈도와 "나를 말하는 문장"(1인칭 문장) 빈도로 골랐습니다. 예문 456개는 Tatoeba 한영 문장이고 카드에 문장 번호 링크로 출처를 밝힙니다. 나머지 144개는 직접 썼습니다. `analysis/native/select_words.py`, `build_words.py` → `src/data/words.json`
- 콘텐츠는 앱 성격(내 하루와 기분을 기록하는 따뜻한 앱)에 맞게 점검했습니다. 어두운 낱말 제외, 기분 낱말 포함, 내 말투 예문 우선. 근거와 수치는 `analysis/REPORT.md`에 있고, `src/lib/packs.test.js`가 이 기준을 검사합니다.
- 꾸러미 데이터는 처음 필요할 때 따로 불러옵니다(`loadPackData`, `usePackData`). 첫 화면 코드에 묶이지 않아 앱 시작이 느려지지 않습니다.

발음 듣기는 기기에 내장된 음성 읽기(Web Speech API)를 씁니다. 지원하지 않는 환경에서는 듣기 버튼이 보이지 않습니다.

## 백업과 오프라인

- **백업 가져오기**: 프로필의 "파일에서 가져오기"로 내려받은 백업(.json)이나 원본 앱 저장 형식을 다시 불러옵니다(`src/lib/backup.js`). 파일 내용은 믿지 않고 아는 칸만, 정해진 길이로만 받습니다. 이미 있는 기록(같은 id나 같은 내용)은 건너뛰고, 가져오기 전에 몇 개를 더할지 보여 줍니다.
- **오프라인 저장**: 로그인 모드에서 연결이 끊긴 채 저장·수정·삭제하면 이 기기에 줄 세워 두었다가(`pendingOps:<user id>`), 연결되면 차례로 서버에 올립니다. 마지막으로 불러온 기록은 이 기기에 남겨(`recordsCache:<user id>`) 연결 없이 열어도 먼저 보여 주고, 서버에서 받아 오면 바꿉니다. 로그아웃하면 이 사본을 지우고, 계정을 삭제하면 줄 선 변경까지 지웁니다.
- **쓰던 일기 지키기**: 쓰던 일기는 입력할 때마다 저장소에 넣습니다. 웹뷰는 저장소를 몇 초씩 모았다가 디스크에 써서, AI 채팅 앱에 다녀오는 사이 안드로이드가 앱을 끄면 마지막 몇 초 치가 사라질 수 있습니다. 그래서 안드로이드 앱은 뒤로 갈 때마다 쓰던 일기를 앱 전용 파일(`journal-draft.json`)로도 쓰고, 다시 켤 때 그 파일로 되살립니다(`src/lib/draftBackup.js`). 로그아웃하면 파일도 지웁니다.

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

## 로그인 없이 둘러보기 (웹)

Supabase가 연결된 웹에서도 처음 온 사람은 로그인 화면에서 앱 소개를 보고 "로그인 없이 먼저 써 보기"를 누를 수 있습니다. 이때 기록은 이 기기에만 저장되고(`useRecords`는 로그인했을 때만 서버를 씀), 나중에 로그인하면 `migrateLocal`이 이 기기 기록을 계정으로 옮깁니다. 프로필과 홈의 백업 안내에 "로그인하고 기록 지키기" 버튼이 있습니다.

## 알림

프로필의 "알림"에서 하루 목표(기록하거나 복습한 개수)와 알림을 켭니다. 기본은 꺼져 있습니다.

- **목표 알림**: 목표를 못 채운 날 13시에 처음, 그 뒤에도 못 채웠으면 1.5~2.5시간마다 알립니다. 21시 이후에는 보내지 않고 하루 최대 5번이며, 목표를 채우면 그날 남은 알림은 취소합니다(`src/lib/reminders.js`).
- **복습 알림**: 정한 시간에 복습할 단어·표현이 있을 때만 개수를 알립니다.
- **안드로이드**: `@capacitor/local-notifications`로 앞으로 3일 치를 미리 예약하고, 기록이 바뀔 때마다 다시 예약합니다. 알림을 누르면 일기나 단어장으로 갑니다. 정확한 알람 권한(SCHEDULE_EXACT_ALARM)은 Play 정책 때문에 뺐습니다.
- **웹(로그인)**: 앱이 계획한 알림을 서버 대기열(`push_queue`)에 올리고, 서버 함수 `supabase/functions/send-reminders`가 10분마다 보낼 때가 된 것을 웹 푸시로 보냅니다. 브라우저를 닫아도 옵니다. 로그아웃하면 남은 알림과 푸시 주소를 지웁니다.
- **웹(로그인 안 함, 또는 푸시 설정 전)**: 탭이나 설치한 웹앱이 열려 있을 때만 옵니다.
- 웹 푸시 설정(한 번만):
  1. VAPID 키는 `supabase/vapid-keys.local.txt`에 있습니다(저장소에 올리지 않음). 새로 만들려면 `node -e "const e=require('crypto').createECDH('prime256v1');e.generateKeys();const b=x=>x.toString('base64url');console.log(b(e.getPublicKey()),b(e.getPrivateKey()))"`.
  2. 공개 키를 `.env`와 Vercel의 `VITE_VAPID_PUBLIC_KEY`에 넣습니다.
  3. Supabase 대시보드 > Edge Functions에서 `send-reminders`를 만들고 `index.ts` 내용을 붙여 넣어 배포합니다. Secrets에 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`(`mailto:문의 이메일`)를 넣습니다.
  4. `supabase/push-cron.sql`의 프로젝트 값과 anon key를 바꿔 SQL Editor에서 실행합니다(10분마다 호출, 한 달 약 4,300번으로 무료 한도 안).
- 리뷰 분석에서 압박·죄책감이 불만 요인이라, 문구는 다그치지 않게 쓰고 홈에는 진행 막대만 보여 줍니다.

## 오류 추적

`src/lib/errorLog.js`가 처리하지 못한 오류(window error, 거부된 Promise, 화면 오류)를 모읍니다. 오류 메시지, 화면, 앱 버전, 웹·앱 구분만 남기고 사용자가 쓴 내용은 넣지 않습니다. 이 기기에 최근 30개를 두어 프로필의 "앱 오류 기록"에서 보고 복사할 수 있고, 로그인했으면 Supabase `client_errors` 표(`supabase/schema.sql`, 넣기만 가능)에도 보냅니다. 개인정보 처리방침에 적어 두었습니다. 안드로이드 앱의 네이티브 크래시는 Play 스토어에 올리면 Play Console의 Android vitals에서 봅니다.

## 오류 신고와 관리자 페이지

프로필의 "문제 신고하기"에서 종류(앱 오류, 단어·표현 내용, 의견)와 내용을 보냅니다. 원하면 이 기기의 앱 오류 기록을 함께 붙입니다. 보낸 신고와 처리 상태, 답변은 같은 곳의 "내가 보낸 신고"에서 봅니다. 로그인하지 않았으면 `VITE_CONTACT_EMAIL`로 메일을 쓰게 합니다.

관리자는 웹이나 앱에서 `#admin`(프로필의 "관리자 페이지" 링크)으로 들어가 신고를 상태별로 보고, 상태(새 신고, 확인 중, 고침, 고치지 않음)와 답변을 바로 고칩니다. "앱 오류" 탭에서는 `client_errors`에 쌓인 오류를 같은 메시지끼리 묶어 횟수와 마지막 시각을 봅니다.

관리자 지정은 Supabase SQL Editor에서 한 번만 합니다. 사용자 ID는 Authentication > Users에서 복사합니다.

```sql
insert into public.admins (user_id) values ('<관리자 사용자 ID>');
```

- 권한은 서버(RLS)가 지킵니다. 사용자는 자기 신고만 넣고 읽으며, 상태와 답변은 `is_admin()`이 참인 관리자만 고칩니다. 관리자 목록 표(`admins`)는 앱에서 읽거나 고칠 수 없습니다.
- "꾸러미 고치기" 탭에서 단어·표현의 뜻, 예문, 예문 해석, 팁을 고치거나 항목을 숨깁니다. 고친 내용은 `pack_fixes` 표에 저장되고, 사용자 앱은 다음에 꾸러미를 열 때 앱에 든 꾸러미 위에 덮어씁니다(업데이트 없이 반영). 서버가 3초 안에 답하지 않거나 연결이 없으면 마지막으로 받은 고침을 씁니다. 예문을 바꾸면 Tatoeba 출처 번호는 떼어집니다. "내용" 신고에는 "꾸러미 고치기로" 버튼이 있습니다. 바뀐 내용을 다음 버전에 아예 넣으려면 `analysis/native`의 데이터를 고쳐 다시 만듭니다.

## 앱 크기

| | 전 | 후 |
| --- | --- | --- |
| 앱에 들어가는 웹 파일 | 3.69MB | 0.68MB |
| 릴리즈 APK | 4.16MB | 1.31MB |

- 안드로이드 앱(`--mode app`)은 Pretendard 글꼴 파일(약 3.3MB)을 넣지 않고 휴대폰 글꼴을 씁니다. Pretendard의 한글은 안드로이드 기본 한글 글꼴(Noto Sans CJK)을 바탕으로 해서 거의 같게 보입니다. 웹은 필요한 글자 조각만 받는 Pretendard를 그대로 씁니다.
- 관리자, Pro 시연판, 개인정보 처리방침 화면은 처음 열 때 따로 불러옵니다.
- 꾸러미 단어·표현은 화면을 열 때 따로 불러옵니다.

## 테스트 자동화

| 무엇을 | 명령 | 언제 |
| --- | --- | --- |
| lint, 단위 테스트, 브라우저 테스트(데스크톱·모바일, 접근성) | `npm run check` | 고칠 때마다 |
| 저장소에 올리면 자동으로 lint·단위·브라우저 테스트와 안드로이드 빌드 | `.github/workflows/ci.yml` | push, pull request |
| 에뮬레이터에서 실제 앱을 눌러 보는 회귀 테스트 | `npm run test:android` (`-- --no-build`) | 출시 전 |

`npm run test:android`는 앱을 빌드해 에뮬레이터에 설치하고, 앱 안 웹뷰에 디버거로 붙어 첫 실행, 단어 저장, 복습, 일기, 공유 창, 뒤로 가기, 앱이 꺼졌다 켜져도 쓰던 일기가 남는지를 확인합니다. 끝나면 크래시 로그(`logcat -b crash`)도 확인하고 `android-test-results/`에 화면과 요약을 남깁니다. Appium이나 Maestro를 따로 설치하지 않고 Playwright와 adb로 같은 일을 합니다.

메모리 8GB 컴퓨터에서도 돌도록 가볍게 돌립니다.
- 빌드가 끝나면 Gradle 데몬을 끄고(`gradlew --stop`), Kotlin 코드는 Gradle 안에서 컴파일해 JVM을 하나만 띄웁니다(`android/gradle.properties`).
- 에뮬레이터는 창과 소리 없이 메모리 2GB, 코어 2개로 켜고, 스냅샷을 디스크에 저장하지 않습니다. 화면은 720×1600(280dpi)으로 낮춥니다. 1080×2400(420dpi)과 같은 411dp 폭이라 화면 배치는 같습니다.
- 테스트용 에뮬레이터 `Light_API_35`(Android 15 `google_apis` x86_64, 플레이 스토어 없음, 720×1600, 메모리 2GB, 디스크 2GB)가 있으면 먼저 씁니다. Android 37 플레이 스토어 이미지보다 가볍습니다. 이미지는 `system-images/android-35/google_apis/x86_64`에 설치합니다(Android Studio의 SDK Manager나 `sdkmanager "system-images;android-35;google_apis;x86_64"`).
- 이 스크립트가 켠 에뮬레이터는 애니메이션을 끄고, 메모리가 빠듯할 때 뜨는 "응답 없음" 창을 숨기고(이 창이 공유 창과 뒤로 가기를 가로챘음), 켠 뒤 30초 기다렸다가 시작합니다. 연결한 휴대폰의 설정은 바꾸지 않습니다.
- Android 15 에뮬레이터에 처음 들어 있는 웹뷰(124)는 Playwright의 CDP 연결 명령 일부를 몰라서, 그때는 Playwright의 안드로이드 연결(`_android`)로 붙습니다.
- 공유 창 시나리오는 시스템 화면을 앞에 띄워 앱 상태를 흔들 수 있어서 맨 마지막에 돌립니다. 각 adb 명령은 60초, 각 시나리오는 2분이 넘으면 실패로 넘어가고, 앞 시나리오에서 앱이 닫혔으면 다시 켜서 이어 갑니다. 컴퓨터에 남은 메모리가 3GB보다 적으면 에뮬레이터 메모리를 1.5GB로 줄입니다.
- 끝나면 에뮬레이터를 끕니다. 창을 보려면 `-- --window`, 켜 두려면 `-- --keep`을 붙입니다.
- 남은 메모리가 2.5GB보다 적으면 경고합니다. 가장 가벼운 방법은 USB 디버깅을 켠 휴대폰을 연결하는 것입니다. 연결된 기기가 있으면 에뮬레이터를 켜지 않고, 휴대폰 설정도 바꾸지 않습니다.
- 테스트용 디버그 APK(7.3MB)는 코드를 줄이지 않은 빌드라 큽니다. 사용자가 받는 릴리즈 APK는 1.31MB입니다. 디버거를 붙인 동안 쓴 내용은 웹뷰가 디스크에 남기지 않아서, "앱이 꺼져도 남는지"는 디버거를 뗀 뒤 실제 터치 입력으로 확인합니다.

## 배포 전 환경 변수

| 이름 | 어디에 | 용도 |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Vercel, `.env` | 로그인과 기록 저장 |
| `VITE_AUTH_PROVIDERS` | Vercel, `.env` | 보여 줄 소셜 로그인 (예: `google,kakao`) |
| `VITE_SITE_URL` | Vercel | canonical, 공유 미리보기, sitemap |
| `VITE_CONTACT_EMAIL` | Vercel, `.env` | 개인정보 처리방침의 문의처, 로그인하지 않은 사람의 신고 메일 |
| `VITE_VAPID_PUBLIC_KEY` | Vercel, `.env` | 웹 푸시 공개 키(브라우저를 닫아도 알림) |

## 구조

- `src/pages`: 화면별 컴포넌트
- `src/components`: 퀴즈, 입력칸, 삭제 버튼 같은 공용 부품
- `src/hooks/useRecordForm.js`: 기록 입력 폼의 공통 동작
- `src/hooks/useReminders.js`, `src/hooks/useErrorReporting.js`: 알림 예약, 로그인 사용자의 오류 보내기
- `src/components/SaveEntryButton.jsx`: 꾸러미, 일기 교정, 오늘의 기분에서 함께 쓰는 "담기" 버튼
- `src/lib/reports.js`, `src/components/ReportForm.jsx`, `src/pages/Admin.jsx`: 오류 신고와 관리자 페이지
- `src/lib/reminders.js`, `src/lib/notifications.js`: 알림 시각 계산과 예약
- `src/lib/records.js`: 기록 저장과 불러오기
- `src/lib/storage.js`: 브라우저 저장소 안전 접근
- `src/lib/i18n.js`: 언어 목록과 화면 문구
- `src/lib/legacy.js`: 원본 앱 형식의 기록을 지금 형식으로 변환
- `src/components/SocialLogin.jsx`: 구글, 카카오 로그인 버튼
- `supabase/schema.sql`: 표, 권한, 회원 탈퇴 함수, 신고·관리자 표
- `supabase/migrate-from-original.sql`: 원본 앱 기록 이전
- `vercel.json`: 보안 헤더와 캐시 설정
- `scripts/make-images.mjs`: 앱 아이콘과 공유 이미지 생성
