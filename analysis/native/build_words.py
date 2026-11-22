"""단어 원고(words_draft.json)와 고른 단어·예문(data/word_candidates.json)을 합쳐 앱 데이터(src/data/en/words.json)를 만든다.

- 순서: select_words.py가 정한 순서(Tatoeba 영어 문장에 나온 횟수가 많은 순).
- 예문: 직접 쓴 예문(own_examples)이 있으면 그것, 없으면 Tatoeba 한영 문장 쌍. Tatoeba 예문은 문장 번호를 남겨 출처를 밝힌다.

실행: ../.venv/Scripts/python -I -X utf8 build_words.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from analyze import DATA  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "data" / "en" / "words.json"
LEVELS = [("beginner", "초급", "Beginner"), ("intermediate", "중급", "Intermediate")]


def main():
    draft = json.loads((Path(__file__).parent / "words_draft.json").read_text(encoding="utf-8"))
    candidates = json.loads((DATA / "word_candidates.json").read_text(encoding="utf-8"))
    sentences_total = sum(1 for _ in open(DATA / "eng_sentences.txt", encoding="utf-8"))

    levels = {level: [] for level, _, _ in LEVELS}
    own = tatoeba = 0
    for item in candidates:
        word = item["word"]
        display, meaning = draft["words"][word]
        if word in draft["own_examples"]:
            english, korean = draft["own_examples"][word]
            example = {"en": english, "ko": korean, "tatoeba": None}
            own += 1
        else:
            example = {"en": item["example"]["en"], "ko": item["example"]["ko"], "tatoeba": item["example"]["id"]}
            tatoeba += 1
        items = levels[item["level"]]
        items.append(
            {
                "id": f"{item['level'][0]}{len(items) + 1:03d}",
                "word": display,
                "meaning": meaning,
                "example": example["en"],
                "exampleKo": example["ko"],
                "tatoeba": example["tatoeba"],
                "sentences": item["sentences"],
            }
        )

    data = {
        "source": {
            "words": "2022 개정 영어과 교육과정 기본 어휘(초등 권장 300, 공통 권장 300)",
            "order": "Tatoeba 영어 문장에 나온 횟수가 많은 순",
            "examples": "Tatoeba (tatoeba.org) 영어-한국어 문장, CC BY 2.0 FR",
            "sentences": sentences_total,
            "note": "뜻은 Daily English가 직접 썼고, 예문은 Tatoeba 문장(번호 표시)이거나 직접 쓴 문장입니다.",
        },
        "levels": [{"id": level, "title": {"ko": ko, "en": en}, "items": levels[level]} for level, ko, en in LEVELS],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    sizes = {level: len(items) for level, items in levels.items()}
    print(f"단어 {sizes}, 예문: Tatoeba {tatoeba}개 + 직접 쓴 것 {own}개 -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
