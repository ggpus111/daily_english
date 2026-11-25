"""영어 문법 꾸러미 원고 → 앱 데이터(src/data/en/grammar.json).

외국인 친구·연인과 메시지할 때 자주 쓰고 자주 헷갈리는 문법을 주제별로 골랐다. 설명과 예문은 AI(Claude)와 함께 직접 썼고
사람이 고른다(원어민 검수 전). 예문은 교과서 문장 대신 친구·연인에게 실제로 보낼 만한 말로 썼다.
항목: (문법, 설명, 예문, 예문 해석, 팁)

실행: ../.venv/Scripts/python -I -X utf8 grammar_draft.py
"""

import json
from pathlib import Path

GROUPS = [
    ("time", "시간 표현", "Time & tense", [
        ("used to + 동사원형", "예전에는 ~하곤 했다(지금은 아님)", "I used to play soccer every weekend.", "나 예전엔 주말마다 축구 했었어.", "used to 뒤에는 꼭 동사원형. I used to playing(X)."),
        ("have been + -ing", "(예전부터 지금까지) 계속 ~하고 있다", "I've been thinking about you all day.", "하루 종일 네 생각 하고 있었어.", "지금도 이어지는 일에 써요."),
        ("Have you ever + 과거분사?", "~해 본 적 있어?", "Have you ever tried Korean barbecue?", "한국식 고기 구이 먹어 본 적 있어?", "대답은 Yes, I have. / No, never."),
        ("was going to + 동사원형", "~하려고 했는데(못 했다)", "I was going to call you, but I fell asleep.", "전화하려고 했는데 잠들어 버렸어.", "계획이 틀어졌을 때 변명처럼 자주 써요."),
        ("be about to + 동사원형", "막 ~하려던 참이다", "I was about to text you!", "막 너한테 문자하려던 참이었어!", ""),
        ("be going to + 동사원형", "~할 거야(이미 정한 계획)", "I'm going to visit Seoul next month.", "다음 달에 서울 갈 거야.", "말할 때는 gonna로 줄이기도 해요."),
        ("was/were + -ing (when ...)", "~하고 있었는데 (그때 ...)", "I was cooking when you called.", "네가 전화했을 때 나 요리하고 있었어.", "길게 이어진 일 중간에 짧은 일이 끼어들 때 써요."),
        ("since / for + 기간", "~부터 / ~동안", "We've been friends for three years.", "우리 친구 된 지 3년 됐어.", "since는 시작 시점(since 2023), for는 기간(for three years)."),
    ]),
    ("ask", "부탁·제안", "Asking & suggesting", [
        ("Can you / Could you + 동사원형?", "~해 줄래? / ~해 줄 수 있어?", "Could you send me the photo?", "그 사진 보내 줄 수 있어?", "Could가 조금 더 부드러워요."),
        ("Would you mind + -ing?", "~해도 괜찮을까? (정중한 부탁)", "Would you mind waiting a few minutes?", "몇 분만 기다려 줄 수 있을까?", "괜찮다는 대답은 No, not at all.(전혀 안 싫어)이에요."),
        ("Why don't we + 동사원형?", "우리 ~하는 게 어때?", "Why don't we watch a movie tonight?", "오늘 밤에 영화 보는 거 어때?", "제안이지 이유를 묻는 말이 아니에요."),
        ("How about + -ing / 명사?", "~하는 건 어때?", "How about getting coffee tomorrow?", "내일 커피 마시는 거 어때?", "How about 뒤에는 -ing나 명사."),
        ("Do you want to + 동사원형? (wanna)", "~할래?", "Do you want to come with me?", "나랑 같이 갈래?", "말할 때는 Wanna come with me?로 줄여요."),
        ("I'd like to + 동사원형", "~하고 싶어요 (want보다 부드럽게)", "I'd like to meet your friends someday.", "언젠가 네 친구들 만나 보고 싶어.", ""),
        ("Is it okay if I + 동사?", "내가 ~해도 괜찮아?", "Is it okay if I call you later?", "이따가 전화해도 괜찮아?", ""),
        ("Let me + 동사원형", "내가 ~할게 / ~하게 해 줘", "Let me know when you get home.", "집에 도착하면 알려 줘.", "Let me know는 메시지에서 아주 자주 써요."),
    ]),
    ("feel", "기분·생각 말하기", "Feelings & opinions", [
        ("I feel like + -ing", "~하고 싶은 기분이야", "I feel like eating something sweet.", "단 거 먹고 싶은 기분이야.", "I feel like + 문장은 '~인 것 같아'라는 뜻이 돼요."),
        ("I can't wait to + 동사원형", "빨리 ~하고 싶어, ~가 너무 기대돼", "I can't wait to see you!", "빨리 보고 싶어!", ""),
        ("look forward to + -ing", "~을 기대하고 있어", "I'm looking forward to our trip.", "우리 여행 기대하고 있어.", "to 뒤에 -ing나 명사가 와요. to see(X), to seeing(O)."),
        ("I wish + 과거형", "~라면 좋을 텐데 (지금은 아니라서 아쉬움)", "I wish you were here.", "네가 여기 있으면 좋을 텐데.", "be동사는 주어와 상관없이 were를 많이 써요."),
        ("I'm glad (that) + 문장", "~해서 다행이야, ~해서 기뻐", "I'm glad you got home safe.", "무사히 집에 들어가서 다행이야.", ""),
        ("make + 사람 + 형용사", "(누구를) ~하게 만들어", "Your message made me so happy.", "네 메시지 덕분에 너무 행복했어.", ""),
        ("I'm into + 명사 / -ing", "~에 빠져 있어, ~를 좋아해", "I'm really into K-dramas these days.", "요즘 K-드라마에 완전 빠졌어.", ""),
        ("It seems like + 문장", "~인 것 같아", "It seems like you had a long day.", "오늘 힘든 하루였던 것 같네.", ""),
        ("-ing 형용사 / -ed 형용사", "-ing: (무엇이) ~하게 만드는 / -ed: (내가) ~하게 된", "You're fascinating. I'm fascinated by you.", "넌 정말 흥미로운 사람이야. 나 너한테 빠졌어.", "I'm boring(나는 지루한 사람이야)과 I'm bored(나 심심해)처럼 뜻이 완전히 달라져요."),
    ]),
    ("compare", "비교·정도", "Comparing & degree", [
        ("비교급 + than", "~보다 더 ...", "Your English is better than my Korean.", "네 영어가 내 한국어보다 낫다.", "짧은 형용사는 -er, 긴 형용사는 more ~."),
        ("as + 형용사 + as", "~만큼 ...한", "This place is as good as the one in Seoul.", "여기 서울에 있는 데만큼 괜찮아.", "부정은 not as ~ as(~만큼은 아닌)."),
        ("too + 형용사 + to 동사", "너무 ~해서 ...할 수 없다", "I'm too tired to go out tonight.", "오늘 밤은 너무 피곤해서 못 나가겠어.", ""),
        ("so + 형용사 + that", "너무 ~해서 ...하다", "It was so funny that I cried.", "너무 웃겨서 울었어.", ""),
        ("형용사 + enough to", "~할 만큼 충분히 ...한", "Are you old enough to drink there?", "거기서는 술 마실 수 있는 나이야?", "enough는 형용사 뒤에 와요."),
        ("The 비교급, the 비교급", "~할수록 더 ...하다", "The more I talk to you, the more I like you.", "너랑 얘기할수록 네가 더 좋아져.", ""),
        ("way + 비교급", "훨씬 더 ~한 (말할 때)", "This is way better than I expected.", "생각보다 훨씬 좋다.", "much보다 편한 말투예요."),
        ("kind of / sort of", "좀, 약간, 어느 정도", "I'm kind of nervous about the interview.", "면접 때문에 좀 긴장돼.", "말할 때는 kinda, sorta로 줄여요."),
    ]),
    ("link", "이유·연결", "Reasons & linking", [
        ("because / so", "~때문에 / 그래서", "I was late because the bus didn't come.", "버스가 안 와서 늦었어.", "because 뒤에는 이유, so 뒤에는 결과."),
        ("even though + 문장", "~인데도", "Even though it was raining, we had fun.", "비가 왔는데도 재밌었어.", ""),
        ("unless + 문장", "~하지 않으면", "I'll be there at seven unless something comes up.", "별일 없으면 7시에 갈게.", "unless 안에는 not을 또 넣지 않아요."),
        ("as soon as + 문장", "~하자마자", "Text me as soon as you land.", "도착하자마자 문자해.", "미래 일이어도 as soon as 안은 현재형."),
        ("while + 문장", "~하는 동안", "I listened to music while I was cooking.", "요리하는 동안 음악 들었어.", ""),
        ("in case + 문장", "~할 경우에 대비해서", "Take an umbrella in case it rains.", "비 올지도 모르니까 우산 챙겨.", ""),
        ("If + 현재형, will + 동사원형", "~하면 ...할게", "If you come to Korea, I'll show you around.", "한국에 오면 내가 구경시켜 줄게.", "If 안은 미래라도 현재형."),
        ("If + 과거형, would + 동사원형", "(실제로는 아니지만) ~라면 ...할 텐데", "If I lived closer, I would see you every day.", "내가 더 가까이 살면 매일 볼 텐데.", ""),
        ("If + 주어 + were to + 동사원형", "가령 ~한다고 치면", "If I were to pick one movie, I'd choose Titanic.", "영화 하나만 고른다고 치면, 난 타이타닉 고를래.", "If I picked보다 '가령 ~라고 치면' 느낌이 더 강해요. 주어가 I나 he여도 were를 써요."),
        ("a place to + 동사원형", "~하기 좋은 곳", "It's a nice place to live.", "살기 좋은 곳이야.", "for living보다 to live가 자연스러워요. a nice place to be at은 '머물기 좋은 곳'이라 분위기에 더 초점이 있어요."),
        ("what + 동사 (~하는 것)", "~하는 것, ~인 일", "I think that's what's happening to me.", "나도 지금 딱 그런 것 같아.", "what's happening to me는 '나한테 일어나는 일', what's going on with me는 '요즘 내 상태'에 가까워요."),
    ]),
    ("question", "질문·되묻기", "Questions & checking", [
        ("..., right? / 부가 의문문", "~지?, ~잖아? (확인)", "You're coming tomorrow, right?", "너 내일 오는 거 맞지?", "isn't it?, don't you? 같은 꼬리 질문도 같은 역할이에요."),
        ("Do you know + 의문사 + 주어 + 동사?", "~인지 알아? (간접 의문문)", "Do you know where he lives?", "걔 어디 사는지 알아?", "where does he live(X) → where he lives(O)."),
        ("What do you mean by ...?", "~가 무슨 뜻이야?", "What do you mean by 'lowkey'?", "'lowkey'가 무슨 뜻이야?", ""),
        ("How come + 문장?", "어째서 ~해? (왜를 편하게)", "How come you didn't tell me?", "왜 나한테 말 안 했어?", "How come 뒤는 평서문 순서예요."),
        ("Did you use to + 동사원형?", "예전에 ~하곤 했어?", "Did you use to live in London?", "예전에 런던에 살았었어?", "의문문·부정문에서는 use to(d 없음)."),
        ("What if + 문장?", "~하면 어떡해? / ~하면 어때?", "What if we get lost?", "우리 길 잃으면 어떡해?", ""),
        ("How long have you + 과거분사?", "~한 지 얼마나 됐어?", "How long have you lived there?", "거기 산 지 얼마나 됐어?", ""),
        ("Have you + 과거분사 + yet?", "벌써 ~했어? / 아직 안 했어?", "Have you eaten yet?", "밥 먹었어?", "부정문은 I haven't eaten yet.(아직 안 먹었어)."),
        ("Do you see yourself + -ing?", "너 ~할 것 같아? (앞으로 그런 모습이 그려져?)", "Do you see yourself living abroad someday?", "너 언젠가 외국에서 살 것 같아?", "see를 '보다'로 옮기지 말고 '~할 것 같다고 생각하다'로 이해해요. 대답은 Yeah, I can see that.(그럴 것 같아)."),
    ]),
    ("pairs", "헷갈리는 짝", "Easily mixed up", [
        ("switch / change", "switch: A를 B로 맞바꾸다 / change: 변하다, 마음·모습이 바뀌다", "Can we switch seats? I changed my mind.", "우리 자리 바꿀래? 나 생각 바뀌었어.", "자리나 물건을 맞바꿀 때는 switch, 마음이나 사람이 달라질 때는 change."),
        ("point at / point out", "point at: 손가락으로 가리키다 / point out: 지적하다, 짚어 주다", "Thanks for pointing it out.", "그거 짚어 줘서 고마워.", "it은 point와 out 사이에 와요. point out it(X)."),
        ("reach / reach out", "reach: 닿다, 도착하다 / reach out: (먼저) 연락하다, 손을 내밀다", "Feel free to reach out if you need anything.", "필요한 거 있으면 언제든 연락해.", "reach out to + 사람. 그냥 contact보다 '먼저 다가가는' 느낌이에요."),
        ("from afar / far from", "from afar: 멀리서 / far from: ~와 거리가 멀다, 전혀 ~아니다", "It's far from perfect, but I love it.", "완벽하진 않지만 난 좋아.", "I've liked you from afar.(멀리서 좋아해 왔어)처럼 from afar는 고백할 때도 써요."),
        ("turn around / turn back / turn over", "뒤돌아보다 / 왔던 길로 돌아가다 / 뒤집다", "We should turn back. It's getting dark.", "돌아가자. 어두워지고 있어.", "turn around는 몸을 돌리는 것, turn back은 가던 길을 되돌아가는 것이에요."),
        ("taste / tastes", "맛 / 취향(취향은 보통 복수)", "I think we have similar tastes in movies.", "우리 영화 취향 비슷한 것 같아.", "a similar taste보다 similar tastes가 자연스러워요."),
        ("interesting / fascinating", "흥미로운 / 너무 흥미로워서 빠져드는", "That's fascinating. Tell me more.", "와, 진짜 신기하다. 더 얘기해 줘.", "fascinating이 훨씬 강해요. 사람에게 쓰면 '계속 알고 싶은 사람'이라는 칭찬이에요."),
        ("It works out / It worked out", "잘 될 거야 / 결국 잘 됐어", "I was worried, but it worked out.", "걱정했는데 결국 잘 됐어.", "여기서 work out은 '운동하다'가 아니라 '일이 잘 풀리다'예요."),
    ]),
]

OUT = Path(__file__).resolve().parents[2] / "src" / "data" / "en" / "grammar.json"


def main():
    packs = []
    for group, ko, en, items in GROUPS:
        packs.append({
            "id": group,
            "title": {"ko": ko, "en": en},
            "items": [
                {"id": f"grammar-{group}-{index + 1:02d}", "text": text, "meaning": meaning, "example": example,
                 "exampleNative": native, "tip": tip}
                for index, (text, meaning, example, native, tip) in enumerate(items)
            ],
        })
    data = {
        "source": {"note": "문법 설명과 예문은 Daily English가 직접 썼습니다(AI 도움, 원어민 검수 전)."},
        "packs": packs,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"문법 {sum(len(p['items']) for p in packs)}개, 주제 {len(packs)}개 -> {OUT}")


if __name__ == "__main__":
    main()
