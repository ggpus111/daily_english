"""단어 원고(words_draft.json)와 고른 단어·예문(data/word_candidates.json)을 합쳐 앱 데이터(src/data/en/words.json)를 만든다.

- 순서: select_words.py가 정한 순서(Tatoeba 영어 문장에 나온 횟수가 많은 순).
- 예문: 직접 쓴 예문(own_examples)이 있으면 그것, 없으면 Tatoeba 한영 문장 쌍. Tatoeba 예문은 문장 번호를 남겨 출처를 밝힌다.

실행: ../.venv/Scripts/python -I -X utf8 build_words.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from analyze import DATA, TOKEN, inflections  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "data" / "en" / "words.json"
LEVELS = [("beginner", "초급", "Beginner"), ("intermediate", "중급", "Intermediate"), ("advanced", "고급", "Advanced")]
# 교육과정 어휘 말고 따로 쓴 단계(words_draft.json의 키, id 앞 글자). 예문은 직접 썼다.
# talk: 실제 대화에서 받아 적은 단어, business·study: 첫 실행에서 고른 목적(비즈니스·학업)에 맞춰 추천하는 단어
EXTRA_LEVELS = [
    ("talk", "t", "talk_words", "대화에서 배운 단어", "Words from real talk"),
    ("business", "w", "business_words", "비즈니스 단어", "Work words"),
    ("study", "s", "study_words", "학업 단어", "Study words"),
]


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

    extra = [(level, prefix, ko, en, draft.get(key, [])) for level, prefix, key, ko, en in EXTRA_LEVELS]
    extra = [entry for entry in extra if entry[4]]
    if extra:
        # 말뭉치(Tatoeba 영어 문장)에 몇 문장 나오는지 센다. 하이픈 말(self-esteem)은 낱말 두 개가 이어 나오는지 본다.
        words = [word for *_, items in extra for word, *_ in items]
        targets = [[form.split("-") for form in sorted(inflections(word.lower()))] if "-" not in word else [word.lower().split("-")]
                   for word in words]
        counts = [0] * len(words)
        with open(DATA / "eng_sentences.txt", encoding="utf-8") as file:
            for line in file:
                joined = " " + " ".join(TOKEN.findall(line.lower())) + " "
                for number, forms in enumerate(targets):
                    if any(" " + " ".join(parts) + " " in joined for parts in forms):
                        counts[number] += 1
        offset = 0
        for level, prefix, _, _, items in extra:
            levels[level] = [
                {"id": f"{prefix}{index + 1:03d}", "word": word, "meaning": meaning, "example": example,
                 "exampleKo": example_ko, "tatoeba": None, "sentences": counts[offset + index]}
                for index, (word, meaning, example, example_ko) in enumerate(items)
            ]
            offset += len(items)
            own += len(items)

    data = {
        "source": {
            "words": "2022 개정 영어과 교육과정 기본 어휘(초등 권장 300, 공통 권장 300, 고등 선택 300), 실제 대화에서 받아 적은 단어, 일·공부에서 자주 쓰는 단어",
            "order": "Tatoeba 영어 문장에 나온 횟수가 많은 순",
            "examples": "Tatoeba (tatoeba.org) 영어-한국어 문장, CC BY 2.0 FR",
            "sentences": sentences_total,
            "note": "뜻은 Daily English가 직접 썼고, 예문은 Tatoeba 문장(번호 표시)이거나 직접 쓴 문장입니다.",
        },
        "levels": [{"id": level, "title": {"ko": ko, "en": en}, "items": levels[level]}
                   for level, ko, en in LEVELS + [(level, ko, en) for level, _, ko, en, _ in extra]],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    sizes = {level: len(items) for level, items in levels.items()}
    print(f"단어 {sizes}, 예문: Tatoeba {tatoeba}개 + 직접 쓴 것 {own}개 -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
