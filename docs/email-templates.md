# Supabase 메일 문구 (Daily English)

Supabase → Authentication → Emails → Templates에서 템플릿마다 **Subject**에 제목을, **Body**의 Source(원천) 탭에 본문을 통째로 붙여 넣고 저장합니다.
주소: https://supabase.com/dashboard/project/qrehxzbmjtiqybnzsrqp/auth/templates

- 새 로고·다니 테마와 같은 모양(크림 바탕, 검정 글자, 노란 버튼, 굵은 검정 외곽선과 밀린 그림자)과 다정한 말투로 맞췄습니다. 이모지는 넣지 않았습니다.
- 메일 프로그램은 SVG 그림을 지우는 곳이 많아서, 로고는 그림 대신 노란 네모의 "D"와 기울인 굵은 "Daily English" 글자로 만들었습니다. 그림자(box-shadow)를 지원하지 않는 메일 앱에서는 외곽선만 보입니다.
- 한국어 사용자와 외국인 친구가 모두 읽도록 한국어 아래에 영어를 함께 넣었습니다.
- `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`은 Supabase가 실제 값으로 바꿔 주는 자리라 그대로 둡니다.
- 메일 서버(SMTP)를 연결해야 무료 요금제에서도 문구를 바꿀 수 있습니다.

---

## 1. Confirm sign up (가입 확인)

**Subject**
```
Daily English 가입을 확인해 주세요 · Confirm your sign-up
```

**Body**
```html
<div style="background:#fbf6e9;padding:32px 16px;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b1b1b">
  <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:2.5px solid #1b1b1b;border-radius:20px;box-shadow:4px 4px 0 #1b1b1b;padding:28px 24px">
    <p style="margin:0 0 20px"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#f6c945;border:2px solid #1b1b1b;color:#1b1b1b;font-weight:900;font-style:italic;font-size:18px">D</span> <span style="font-weight:900;font-style:italic;font-size:19px;letter-spacing:-0.02em;vertical-align:middle">Daily English</span></p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800">가입해 주셔서 고마워요</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#5a5247">아래 버튼을 누르면 가입이 끝나요. 친구·연인과 나눈 말이 내 단어장이 되는 곳에 오신 걸 환영해요.</p>
    <p style="margin:0 0 24px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#f6c945;border:2.5px solid #1b1b1b;box-shadow:3px 3px 0 #1b1b1b;color:#1b1b1b;font-weight:800;text-decoration:none">가입 확인하기</a></p>
    <hr style="border:0;border-top:1.5px solid #e6dcc2;margin:0 0 16px">
    <p style="margin:0 0 6px;line-height:1.6">Thanks for signing up. Tap the button above to finish and start collecting the words you share with friends and partners.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5a5247">직접 가입하지 않았다면 이 메일은 무시해 주세요. If you didn't sign up, you can ignore this email.</p>
  </div>
</div>
```

---

## 2. Invite user (초대)

**Subject**
```
Daily English에 초대받았어요 · You're invited to Daily English
```

**Body**
```html
<div style="background:#fbf6e9;padding:32px 16px;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b1b1b">
  <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:2.5px solid #1b1b1b;border-radius:20px;box-shadow:4px 4px 0 #1b1b1b;padding:28px 24px">
    <p style="margin:0 0 20px"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#f6c945;border:2px solid #1b1b1b;color:#1b1b1b;font-weight:900;font-style:italic;font-size:18px">D</span> <span style="font-weight:900;font-style:italic;font-size:19px;letter-spacing:-0.02em;vertical-align:middle">Daily English</span></p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800">Daily English에 초대받았어요</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#5a5247">단어, 표현, 대화, 일기를 모아 두고 친구·연인과 하루 한 문장을 주고받는 앱이에요. 아래 버튼을 눌러 계정을 만들어 주세요.</p>
    <p style="margin:0 0 24px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#f6c945;border:2.5px solid #1b1b1b;box-shadow:3px 3px 0 #1b1b1b;color:#1b1b1b;font-weight:800;text-decoration:none">초대 받기</a></p>
    <hr style="border:0;border-top:1.5px solid #e6dcc2;margin:0 0 16px">
    <p style="margin:0 0 6px;line-height:1.6">You've been invited to Daily English, a place to keep your words and swap one sentence a day with friends. Tap the button above to create your account.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5a5247">초대받을 일이 없었다면 이 메일은 무시해 주세요. If you weren't expecting this, you can ignore this email.</p>
  </div>
</div>
```

---

## 3. Magic link or OTP (메일로 로그인)

**Subject**
```
Daily English 로그인 링크 · Your sign-in link
```

**Body**
```html
<div style="background:#fbf6e9;padding:32px 16px;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b1b1b">
  <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:2.5px solid #1b1b1b;border-radius:20px;box-shadow:4px 4px 0 #1b1b1b;padding:28px 24px">
    <p style="margin:0 0 20px"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#f6c945;border:2px solid #1b1b1b;color:#1b1b1b;font-weight:900;font-style:italic;font-size:18px">D</span> <span style="font-weight:900;font-style:italic;font-size:19px;letter-spacing:-0.02em;vertical-align:middle">Daily English</span></p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800">로그인 링크예요</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#5a5247">아래 버튼을 누르면 바로 로그인돼요. 링크는 한 번만 쓸 수 있어요.</p>
    <p style="margin:0 0 16px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#f6c945;border:2.5px solid #1b1b1b;box-shadow:3px 3px 0 #1b1b1b;color:#1b1b1b;font-weight:800;text-decoration:none">로그인하기</a></p>
    <p style="margin:0 0 24px;line-height:1.6;color:#5a5247">코드를 넣으라고 하면 이 번호를 써 주세요: <strong style="color:#1b1b1b;letter-spacing:0.15em">{{ .Token }}</strong></p>
    <hr style="border:0;border-top:1.5px solid #e6dcc2;margin:0 0 16px">
    <p style="margin:0 0 6px;line-height:1.6">Tap the button above to sign in. The link works only once. If you're asked for a code, use: <strong>{{ .Token }}</strong></p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5a5247">요청하지 않았다면 이 메일은 무시해 주세요. If you didn't ask for this, you can ignore this email.</p>
  </div>
</div>
```

---

## 4. Change email address (이메일 변경)

**Subject**
```
Daily English 이메일 변경 확인 · Confirm your new email
```

**Body**
```html
<div style="background:#fbf6e9;padding:32px 16px;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b1b1b">
  <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:2.5px solid #1b1b1b;border-radius:20px;box-shadow:4px 4px 0 #1b1b1b;padding:28px 24px">
    <p style="margin:0 0 20px"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#f6c945;border:2px solid #1b1b1b;color:#1b1b1b;font-weight:900;font-style:italic;font-size:18px">D</span> <span style="font-weight:900;font-style:italic;font-size:19px;letter-spacing:-0.02em;vertical-align:middle">Daily English</span></p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800">이메일을 바꾸려고 해요</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#5a5247">로그인 이메일을 <strong style="color:#1b1b1b">{{ .NewEmail }}</strong>(으)로 바꾸려면 아래 버튼을 눌러 주세요. 모아 둔 기록은 그대로예요.</p>
    <p style="margin:0 0 24px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#f6c945;border:2.5px solid #1b1b1b;box-shadow:3px 3px 0 #1b1b1b;color:#1b1b1b;font-weight:800;text-decoration:none">이메일 변경 확인</a></p>
    <hr style="border:0;border-top:1.5px solid #e6dcc2;margin:0 0 16px">
    <p style="margin:0 0 6px;line-height:1.6">Tap the button above to change your sign-in email to <strong>{{ .NewEmail }}</strong>. Your records stay the same.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5a5247">직접 바꾸지 않았다면 이 메일은 무시하고 비밀번호를 바꿔 주세요. If you didn't ask for this, ignore this email and change your password.</p>
  </div>
</div>
```

---

## 5. Reset password (비밀번호 재설정)

**Subject**
```
Daily English 비밀번호 재설정 · Reset your password
```

**Body**
```html
<div style="background:#fbf6e9;padding:32px 16px;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b1b1b">
  <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:2.5px solid #1b1b1b;border-radius:20px;box-shadow:4px 4px 0 #1b1b1b;padding:28px 24px">
    <p style="margin:0 0 20px"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#f6c945;border:2px solid #1b1b1b;color:#1b1b1b;font-weight:900;font-style:italic;font-size:18px">D</span> <span style="font-weight:900;font-style:italic;font-size:19px;letter-spacing:-0.02em;vertical-align:middle">Daily English</span></p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800">비밀번호를 새로 정해요</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#5a5247">아래 버튼을 누르고 새 비밀번호를 정해 주세요. 링크는 한 시간 동안만 쓸 수 있어요. 모아 둔 기록은 그대로예요.</p>
    <p style="margin:0 0 24px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#f6c945;border:2.5px solid #1b1b1b;box-shadow:3px 3px 0 #1b1b1b;color:#1b1b1b;font-weight:800;text-decoration:none">새 비밀번호 정하기</a></p>
    <hr style="border:0;border-top:1.5px solid #e6dcc2;margin:0 0 16px">
    <p style="margin:0 0 6px;line-height:1.6">Tap the button above to set a new password. The link works for one hour, and your records stay the same.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5a5247">요청하지 않았다면 이 메일은 무시해도 괜찮아요. 비밀번호는 바뀌지 않아요. If you didn't ask for this, you can ignore this email. Your password won't change.</p>
  </div>
</div>
```

---

## 6. Reauthentication (본인 확인 코드)

**Subject**
```
Daily English 확인 코드 · Your verification code
```

**Body**
```html
<div style="background:#fbf6e9;padding:32px 16px;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1b1b1b">
  <div style="max-width:480px;margin:0 auto;background:#fffdf8;border:2.5px solid #1b1b1b;border-radius:20px;box-shadow:4px 4px 0 #1b1b1b;padding:28px 24px">
    <p style="margin:0 0 20px"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#f6c945;border:2px solid #1b1b1b;color:#1b1b1b;font-weight:900;font-style:italic;font-size:18px">D</span> <span style="font-weight:900;font-style:italic;font-size:19px;letter-spacing:-0.02em;vertical-align:middle">Daily English</span></p>
    <p style="margin:0 0 8px;font-size:20px;font-weight:800">본인 확인 코드예요</p>
    <p style="margin:0 0 16px;line-height:1.6;color:#5a5247">중요한 설정을 바꾸기 전에 본인인지 확인할게요. 앱에 아래 코드를 넣어 주세요.</p>
    <p style="margin:0 0 24px;padding:14px 0;border-radius:12px;background:#efe2da;text-align:center;font-size:26px;font-weight:800;letter-spacing:0.3em;color:#a8492c">{{ .Token }}</p>
    <hr style="border:0;border-top:1.5px solid #e6dcc2;margin:0 0 16px">
    <p style="margin:0 0 6px;line-height:1.6">Before changing an important setting, please confirm it's you. Enter the code above in the app.</p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5a5247">요청하지 않았다면 이 메일은 무시하고 비밀번호를 바꿔 주세요. If you didn't ask for this, ignore this email and change your password.</p>
  </div>
</div>
```
