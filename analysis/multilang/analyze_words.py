"""단어 꾸러미를 "대화에서 쓰는 말" 기준으로 점검한다(일본어, 중국어, 스페인어, 프랑스어, 한국어).

질문: 외국인 연인·친구와 메시지를 주고받을 때 쓰는 말이 어떤 낱말인가? 교과서 기초 어휘(나, 너, 물, 집, 먹다)는 이미 아는 말이라 뺀다.

방법
1. 그 언어 Tatoeba 문장을 "나나 너의 말(1·2인칭 대명사가 든 문장)"과 나머지로 나눈다. 앱의 대화 꾸러미와 같은 기준이다.
2. 낱말마다 두 가지를 센다.
   - 대화도: 나나 너의 문장에서의 비율 ÷ 전체 문장에서의 비율(1보다 크면 대화에서 더 자주 쓰임)
   - 기초도: wordfreq 빈도(zipf). 5.3 이상이면 누구나 아는 기초 낱말로 보고 뺀다(예: 我, 你, 是, de, que).
3. 단어 원고(drafts/{언어}_words.tsv)의 낱말을 점검하고, 원고에 없는데 대화도가 높은 낱말을 후보로 내보낸다(사람이 골라 넣는다).

결과: output/words_analysis.json(요약), output/{언어}_word_stats.csv(원고 낱말), output/{언어}_word_candidates.csv(후보)
실행: ../.venv/Scripts/python -I -X utf8 analyze_words.py [ja zh es fr ko]
"""

import csv
import json
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

from wordfreq import tokenize, zipf_frequency

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from build import DATA, DRAFTS, LANGS, NO_SPACE, OUTPUT, PERSONAL, read_tsv  # noqa: E402

BASIC_ZIPF = 5.3
MIN_ZIPF = 3.0
MIN_COUNT = 30
STOP = {  # 기능어(조사, 관사, 대명사, 접속사)는 후보에서 뺀다
    "ja": set("はがをにでとのもへやかよねなだですますたてい"),
    "zh": set("的了是在我你他她们这那有不和就也都很"),
    "es": set("de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus".split()),
    "fr": set("de la le et les des en un du une que est pour qui dans a par plus pas au sur ne se ce il sont les ou avec son mais on y sa cette ses comme je nous vous elle tu me te lui leur si tout fait être avoir été c d l j m n s t qu".split()),
    "ko": set("이 그 저 는 은 가 를 을 에 의 도 로 와 과 이다 하다 있다 없다 나 너 내 네 걔 우리".split()),
}


def tokens_of(lang, sentence):
    if lang in NO_SPACE:
        return tokenize(sentence, {"ja": "ja", "zh": "zh", "ko": "ko"}[lang])
    return re.findall(r"[^\W\d_]+(?:'[^\W\d_]+)?", sentence.lower())


def analyze(lang):
    sentences = (DATA / f"{LANGS[lang]}_sentences.txt").read_text(encoding="utf-8").splitlines()
    personal_re = re.compile(PERSONAL[lang], re.I)
    overall, personal = Counter(), Counter()
    personal_total = 0
    for sentence in sentences:
        found = set(tokens_of(lang, sentence))
        overall.update(found)
        if personal_re.search(sentence):
            personal.update(found)
            personal_total += 1
    total = len(sentences)

    def chat_ratio(word):
        if overall[word] < MIN_COUNT:
            return None
        return (personal[word] / personal_total) / (overall[word] / total)

    words = [row[1].split(" (")[0].lower() for row in read_tsv(DRAFTS / f"{lang}_words.tsv", 5)]
    rows = []
    for word in words:
        zipf = zipf_frequency(word, lang)
        ratio = chat_ratio(word)
        rows.append({"word": word, "zipf": round(zipf, 2), "chat": None if ratio is None else round(ratio, 2),
                     "basic": zipf >= BASIC_ZIPF})
    mine = set(words)
    candidates = []
    for word, count in overall.items():
        if word in mine or word in STOP[lang] or len(word) < (1 if lang in NO_SPACE else 3):
            continue
        if lang in NO_SPACE and not re.search(r"[぀-ヿ㐀-鿿가-힯]", word):
            continue
        ratio = chat_ratio(word)
        zipf = zipf_frequency(word, lang)
        if ratio and ratio >= 1.4 and MIN_ZIPF <= zipf < BASIC_ZIPF:
            candidates.append({"word": word, "zipf": round(zipf, 2), "chat": round(ratio, 2), "sentences": count})
    candidates.sort(key=lambda row: (-row["chat"] * row["zipf"]))

    OUTPUT.mkdir(exist_ok=True)
    for name, data in (("word_stats", rows), ("word_candidates", candidates[:400])):
        if data:
            with open(OUTPUT / f"{lang}_{name}.csv", "w", encoding="utf-8-sig", newline="") as file:
                writer = csv.DictWriter(file, fieldnames=list(data[0]))
                writer.writeheader()
                writer.writerows(data)
    known = [row for row in rows if row["chat"] is not None]
    return {
        "sentences": total,
        "personal_sentences": personal_total,
        "personal_share": round(personal_total / total, 3),
        "words_in_draft": len(rows),
        "basic_words": sum(row["basic"] for row in rows),
        "chat_median": round(statistics.median(row["chat"] for row in known), 2) if known else None,
        "chat_above_1": sum(row["chat"] > 1 for row in known),
        "candidates": len(candidates),
    }


def main():
    langs = sys.argv[1:] or list(LANGS)
    path = OUTPUT / "words_analysis.json"
    summary = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for lang in langs:
        summary[lang] = analyze(lang)
        print(lang, json.dumps(summary[lang], ensure_ascii=False))
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
