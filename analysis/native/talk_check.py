"""대화 꾸러미(talk_draft.json)가 실제로 쓰이는 말인지 wordfreq로 확인한다(분석용, 앱에는 넣지 않음).

왜: 처음 꾸러미의 빈도는 Tatoeba 문장(학습자·번역자가 올린 교과서식 문장)에서 셌다. 연인·친구와의 메시지 말은
Tatoeba에 거의 없어서(예: lol 0문장) "드문 말"처럼 보인다. wordfreq는 위키백과, 자막, 뉴스, 웹, 트위터, 레딧 등
여러 글을 섞은 빈도라 메시지 말을 더 잘 반영한다.

- 한 낱말(줄임말 등): zipf 빈도(10억 단어 중 10^(zipf-9)번). 3 이상이면 일상적으로 쓰는 말, 4 이상이면 아주 흔한 말.
- 여러 낱말 표현: wordfreq가 낱말 빈도로 추정한 값이라 참고만 한다.
- 비교: 같은 기준으로 단어 꾸러미(교육과정 기본 어휘) 600개의 중앙값.

결과: output/talk_check.csv, output/talk_check_summary.json
실행: ../.venv/Scripts/python -I -X utf8 talk_check.py
"""

import csv
import json
import statistics
import sys
from pathlib import Path

from wordfreq import zipf_frequency

sys.path.insert(0, str(Path(__file__).parent))
from analyze import DATA, TOKEN  # noqa: E402

HERE = Path(__file__).parent
ROOT = HERE.parents[1]


def tatoeba_counts(phrases):
    index = {tuple(TOKEN.findall(phrase)): phrase for phrase in phrases}
    longest = max(len(key) for key in index)
    counts = dict.fromkeys(phrases, 0)
    with open(DATA / "eng_sentences.txt", encoding="utf-8") as file:
        for line in file:
            tokens = TOKEN.findall(line.lower().replace("’", "'"))
            seen = set()
            for size in range(1, longest + 1):
                for start in range(len(tokens) - size + 1):
                    hit = index.get(tuple(tokens[start : start + size]))
                    if hit:
                        seen.add(hit)
            for phrase in seen:
                counts[phrase] += 1
    return counts


def main():
    talk = json.loads((HERE / "talk_draft.json").read_text(encoding="utf-8"))
    titles = {pack: ko for pack, ko, _ in talk["packs"]}
    items = talk["items"]
    counts = tatoeba_counts({item[2] for item in items})

    rows = []
    for pack, text, match, *_ in items:
        words = TOKEN.findall(match)
        rows.append(
            {
                "pack": titles[pack],
                "text": text,
                "words": len(words),
                "zipf": round(zipf_frequency(match, "en"), 2),
                "tatoeba_sentences": counts[match],
            }
        )

    words_pack = json.loads((ROOT / "src/data/en/words.json").read_text(encoding="utf-8"))
    curriculum = [zipf_frequency(item["word"], "en") for level in words_pack["levels"] for item in level["items"]]
    single = [row for row in rows if row["words"] == 1]
    texting = [row for row in rows if row["pack"] == titles["text"]]

    out = HERE / "output"
    with open(out / "talk_check.csv", "w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "items": len(rows),
        "texting_items": len(texting),
        "texting_zipf_median": statistics.median(row["zipf"] for row in texting),
        "texting_zipf_3_or_more": sum(row["zipf"] >= 3 for row in texting),
        "texting_tatoeba_zero": sum(row["tatoeba_sentences"] == 0 for row in texting),
        "texting_tatoeba_median": statistics.median(row["tatoeba_sentences"] for row in texting),
        "curriculum_words_zipf_median": round(statistics.median(curriculum), 2),
        "single_word_items": len(single),
        "tatoeba_under_5": sum(row["tatoeba_sentences"] < 5 for row in rows),
        "examples": {row["text"]: [row["zipf"], row["tatoeba_sentences"]] for row in texting},
    }
    (out / "talk_check_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
