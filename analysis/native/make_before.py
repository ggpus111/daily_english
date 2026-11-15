"""콘텐츠 점검(content_fit.py)의 "고치기 전" 데이터를 다시 만든다.

고치기 전 = 앱 성격 기준을 넣기 전의 첫 버전
- 단어: 전체 문장 빈도로 고른 600개(data/word_candidates_v1.json)와 그때 직접 쓴 예문 24개
- 표현: 남의 이야기(He, She, They가 주어)로 썼다가 내 이야기로 바꾼 예문 31개를 되돌린 것

실행: ../.venv/Scripts/python -I -X utf8 make_before.py  -> output/before_words.json, output/before_packs.json
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]

# 첫 버전에서 직접 쓴 예문이 있던 단어(나머지는 Tatoeba 예문)
FIRST_OWN = (
    "good plan old kill dead die drug amaze excite unit arrest require huge search instead economy develop crowd mess "
    "spot term local level event"
).split()

# 첫 버전의 표현 예문(지금은 내 이야기로 바꿈)
FIRST_EXPRESSION_EXAMPLES = {
    "break up": ["They broke up last month.", "그 둘은 지난달에 헤어졌어."],
    "fall in love": ["They fell in love in college.", "둘은 대학 때 사랑에 빠졌어."],
    "over the moon": ["She was over the moon about the news.", "그녀는 그 소식에 뛸 듯이 기뻐했어."],
    "head over heels": ["He's head over heels for her.", "그는 그녀에게 홀딱 반했어."],
    "made for each other": ["Those two are made for each other.", "저 둘은 천생연분이야."],
    "burst into tears": ["She burst into tears when she heard the news.", "그녀는 소식을 듣고 울음을 터뜨렸어."],
    "settle down": ["He wants to settle down and start a family.", "그는 자리 잡고 가정을 꾸리고 싶어 해."],
    "take pride in": ["She takes pride in her work.", "그녀는 자기 일을 자랑스러워해."],
    "at the last minute": ["He canceled at the last minute.", "그는 막판에 취소했어."],
    "show up": ["He didn't show up to the party.", "그는 파티에 안 왔어."],
    "on time": ["The train arrived on time.", "기차가 제시간에 도착했어."],
    "come up with": ["She came up with a great idea.", "그녀가 좋은 생각을 떠올렸어."],
    "bounce back": ["She bounced back quickly after the loss.", "그녀는 패배 후 금방 회복했어."],
    "pull through": ["Don't worry, he'll pull through.", "걱정 마, 그는 이겨 낼 거야."],
    "drop out": ["He dropped out of college.", "그는 대학을 중퇴했어."],
    "suffer from": ["She suffers from headaches.", "그 애는 두통에 시달려."],
    "kick out": ["He got kicked out of the club.", "그는 동아리에서 쫓겨났어."],
    "break the ice": ["He told a joke to break the ice.", "그는 어색함을 깨려고 농담을 했어."],
    "ring a bell": ["His name rings a bell.", "그 사람 이름, 어디서 들어 본 것 같아."],
    "a dream come true": ["Meeting her was a dream come true.", "그녀를 만난 건 꿈만 같았어."],
    "turn a blind eye": ["The teacher turned a blind eye to it.", "선생님은 그걸 못 본 척했어."],
    "from scratch": ["She made the cake from scratch.", "그녀는 케이크를 처음부터 직접 만들었어."],
    "have an accident": ["He had an accident on his way home.", "그 사람 집에 가는 길에 사고가 났어."],
    "world record": ["She broke the world record.", "그 선수가 세계 기록을 깼어."],
    "fast asleep": ["The baby is fast asleep.", "아기가 푹 잠들었어."],
    "from head to toe": ["She was dressed in black from head to toe.", "그 애는 머리부터 발끝까지 검은색으로 입었어."],
    "up to no good": ["Those kids are up to no good.", "저 애들 뭔가 꾸미고 있어."],
    "look the other way": ["The teacher just looked the other way.", "선생님은 그냥 못 본 척했어."],
    "a great deal": ["She has changed a great deal.", "그 애 많이 변했어."],
    "break down": ["My car broke down on the highway.", "고속도로에서 차가 고장 났어."],
    "fill out": ["Please fill out this form.", "이 양식을 작성해 주세요."],
}


def main():
    draft = json.loads((HERE / "words_draft.json").read_text(encoding="utf-8"))
    first = json.loads((HERE / "data" / "word_candidates_v1.json").read_text(encoding="utf-8"))
    items = []
    for item in first:
        display, meaning = draft["words"][item["word"]]
        if item["word"] in FIRST_OWN:
            english, korean = draft["own_examples"][item["word"]]
            tatoeba = None
        else:
            english, korean, tatoeba = item["example"]["en"], item["example"]["ko"], item["example"]["id"]
        items.append({"word": display, "meaning": meaning, "example": english, "exampleKo": korean, "tatoeba": tatoeba})
    out = HERE / "output"
    (out / "before_words.json").write_text(json.dumps({"levels": [{"items": items}]}, ensure_ascii=False), encoding="utf-8")

    packs = json.loads((ROOT / "src" / "data" / "packs.json").read_text(encoding="utf-8"))
    for pack in packs["packs"]:
        for item in pack["items"]:
            if item["text"] in FIRST_EXPRESSION_EXAMPLES:
                item["example"], item["exampleKo"] = FIRST_EXPRESSION_EXAMPLES[item["text"]]
    (out / "before_packs.json").write_text(json.dumps(packs, ensure_ascii=False), encoding="utf-8")
    print("고치기 전 데이터를 output/before_words.json, before_packs.json에 만듦")


if __name__ == "__main__":
    main()
