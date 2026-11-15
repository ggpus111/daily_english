"""표현 꾸러미 원고(packs_draft.json)에 말뭉치 빈도를 붙여 앱 데이터(src/data/packs.json)를 만든다.

- 표현마다 Tatoeba 영어 문장 중 몇 문장에 쓰였는지 센다(첫 낱말은 활용형 포함).
- 기본 어휘 3,000개로만 된 표현인지도 표시한다.
- 너무 드문 표현(MIN_COUNT 미만)은 목록으로 알려 주어 사람이 다시 판단한다.

실행: ../.venv/Scripts/python -I -X utf8 build_packs.py
"""

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

# -I(격리 모드)로 실행하면 이 폴더가 import 경로에서 빠지므로, 우리 스크립트 폴더만 직접 넣는다.
sys.path.insert(0, str(Path(__file__).parent))
from analyze import DATA, MAX_WORDS, TOKEN, inflections, is_basic, load_basic_words

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "data" / "packs.json"
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


def main():
    draft = json.loads((Path(__file__).parent / "packs_draft.json").read_text(encoding="utf-8"))["items"]
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

    packs = {pack: [] for pack, _, _ in PACKS}
    rare = []
    for number, (pack, text, match, meaning, example, example_ko, tip) in enumerate(draft):
        words = TOKEN.findall(match.lower())
        count = counts[number]
        if count < MIN_COUNT:
            rare.append((text, count))
        packs[pack].append(
            {
                "id": f"{pack}-{len(packs[pack]) + 1:02d}",
                "text": text,
                "meaning": meaning,
                "example": example,
                "exampleKo": example_ko,
                "tip": tip,
                "sentences": count,
                "perMillion": round(count / total * 1_000_000, 1),
                "easyWords": all(is_basic(word, basic) for word in words),
            }
        )

    data = {
        "source": {
            "corpus": "Tatoeba (tatoeba.org) English sentences, CC BY 2.0 FR",
            "sentences": total,
            "note": "표현과 예문, 풀이는 Daily English가 직접 썼고, 빈도만 말뭉치에서 셌습니다.",
        },
        "packs": [
            {"id": pack, "title": {"ko": ko, "en": en}, "items": packs[pack]} for pack, ko, en in PACKS
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    sizes = {pack: len(items) for pack, items in packs.items()}
    print(f"꾸러미 {sizes}, 모두 {sum(sizes.values())}개 -> {OUT.relative_to(ROOT)}")
    easy = sum(item["easyWords"] for items in packs.values() for item in items)
    print(f"기본 어휘로만 된 표현 {easy}개")
    print(f"말뭉치에서 {MIN_COUNT}문장 미만으로 쓰인 표현 {len(rare)}개: {rare}")


if __name__ == "__main__":
    main()
