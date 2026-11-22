"""표현 꾸러미 원고에 말뭉치 빈도를 붙여 앱 데이터(src/data/en/packs.json)를 만든다.

- 원고 두 개: talk_draft.json(외국인 연인·친구와의 대화, 앞에 둠)과 packs_draft.json(처음 만든 일상 표현 400개).
- 두 원고에 같은 표현이 있으면 처음 원고 쪽만 남긴다(대화 원고 쪽을 빼고 목록으로 알려 줌).
- 메시지 줄임말(text 꾸러미)은 Tatoeba에 거의 없어 빈도를 붙이지 않는다(talk_check.py가 wordfreq로 따로 확인).

- 표현마다 Tatoeba 영어 문장 중 몇 문장에 쓰였는지 센다(첫 낱말은 활용형 포함).
- 기본 어휘 3,000개로만 된 표현인지도 표시한다.
- 너무 드문 표현(MIN_COUNT 미만)은 목록으로 알려 주어 사람이 다시 판단한다.

실행: ../.venv/Scripts/python -I -X utf8 build_packs.py
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# -I(격리 모드)로 실행하면 이 폴더가 import 경로에서 빠지므로, 우리 스크립트 폴더만 직접 넣는다.
sys.path.insert(0, str(Path(__file__).parent))
from analyze import DATA, MAX_WORDS, TOKEN, inflections, is_basic, load_basic_words

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "data" / "en" / "packs.json"
MIN_COUNT = 5
PACKS = [
    ("daily", "일상 대화", "Everyday talk"),
    ("routine", "하루 일과", "Daily routine"),
    ("out", "밖에서", "Out and about"),
    ("feelings", "감정·관계", "Feelings & people"),
    ("plans", "약속·계획", "Plans & time"),
    ("connect", "말 잇기", "Linking words"),
    ("trouble", "문제 해결", "Problems & fixes"),
    ("phrasal", "자주 쓰는 구동사", "Phrasal verbs"),
    ("idioms", "재미있는 관용 표현", "Fun idioms"),
    ("idioms-more", "관용 표현 더 보기", "More idioms"),
]


NO_FREQUENCY = {"text"}


def normalize(text):
    return re.sub(r"[.!?,]", "", text.lower().replace("’", "'")).strip()


def load_drafts():
    here = Path(__file__).parent
    talk = json.loads((here / "talk_draft.json").read_text(encoding="utf-8"))
    base = json.loads((here / "packs_draft.json").read_text(encoding="utf-8"))["items"]
    known = {normalize(item[1]) for item in base}
    kept, dropped = [], []
    for item in talk["items"]:
        (dropped if normalize(item[1]) in known else kept).append(item)
        known.add(normalize(item[1]))
    packs = [tuple(pack) for pack in talk["packs"]] + PACKS
    return packs, kept + base, dropped


def main():
    packs_meta, draft, dropped = load_drafts()
    talk_ids = {pack for pack, _, _ in packs_meta} - {pack for pack, _, _ in PACKS}
    _, _, basic = load_basic_words()

    index = defaultdict(set)
    for number, item in enumerate(draft):
        words = TOKEN.findall(item[2].lower())
        for form in inflections(words[0]):
            index[(form, *words[1:])].add(number)

    counts = Counter()
    total = 0
    longest = max(MAX_WORDS, max(len(key) for key in index))
    with open(DATA / "eng_sentences.txt", encoding="utf-8") as file:
        for line in file:
            total += 1
            tokens = TOKEN.findall(line.lower().replace("’", "'"))
            seen = set()
            for size in range(1, longest + 1):
                for start in range(len(tokens) - size + 1):
                    seen |= index.get(tuple(tokens[start : start + size]), set())
            counts.update(seen)

    packs = {pack: [] for pack, _, _ in packs_meta}
    rare = []
    for number, (pack, text, match, meaning, example, example_ko, tip) in enumerate(draft):
        words = TOKEN.findall(match.lower())
        count = counts[number]
        item = {
            "id": f"{pack}-{len(packs[pack]) + 1:02d}",
            "text": text,
            "meaning": meaning,
            "example": example,
            "exampleKo": example_ko,
            "tip": tip,
            "easyWords": all(is_basic(word, basic) for word in words),
        }
        if pack in NO_FREQUENCY:
            item["texting"] = True
        elif pack in talk_ids and count < MIN_COUNT:
            # 대화 원고는 Tatoeba(교과서식 문장)에 드물게 나와도 실제 메시지에선 흔한 말이 많다.
            # "가끔 써요"로 잘못 보이지 않게 빈도를 붙이지 않고, talk_check.py가 wordfreq로 따로 확인한다.
            rare.append((text, count))
        else:
            if count < MIN_COUNT:
                rare.append((text, count))
            item["sentences"] = count
            item["perMillion"] = round(count / total * 1_000_000, 1)
        packs[pack].append(item)

    data = {
        "source": {
            "corpus": "Tatoeba (tatoeba.org) English sentences, CC BY 2.0 FR",
            "sentences": total,
            "note": "표현과 예문, 풀이는 Daily English가 직접 썼고, 빈도만 말뭉치에서 셌습니다.",
        },
        "packs": [
            {"id": pack, "title": {"ko": ko, "en": en}, "items": packs[pack]} for pack, ko, en in packs_meta
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    sizes = {pack: len(items) for pack, items in packs.items()}
    print(f"꾸러미 {sizes}, 모두 {sum(sizes.values())}개 -> {OUT.relative_to(ROOT)}")
    easy = sum(item["easyWords"] for items in packs.values() for item in items)
    print(f"기본 어휘로만 된 표현 {easy}개")
    print(f"말뭉치에서 {MIN_COUNT}문장 미만으로 쓰인 표현 {len(rare)}개: {rare}")
    print(f"처음 원고와 겹쳐 뺀 대화 표현 {len(dropped)}개: {[item[1] for item in dropped]}")


if __name__ == "__main__":
    main()
