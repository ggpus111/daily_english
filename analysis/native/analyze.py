"""교과서 영어와 원어민 영어를 비교해, 앱에 넣을 표현 후보를 고른다.

질문
1. 원어민이 실제 문장에서 자주 쓰는 여러 단어 표현(관용구, 구동사, 구어 표현) 중
   우리가 아는 쉬운 단어로만 되어 있어 "단어는 아는데 뜻은 모르는" 표현은 무엇인가?
2. 교과서에서 배우는 표현과 원어민이 더 자주 쓰는 표현은 얼마나 차이 나는가?

데이터 (collect.py)
- Tatoeba 영어 문장 2,040,567개 (CC BY 2.0 FR)
- 위키낱말사전 분류 표제어: idioms, phrasal verbs, informal terms, colloquialisms (CC BY-SA 4.0)
- 2022 개정 영어과 교육과정 기본 어휘 3,000개 (교육부 고시 별표)
- wordfreq 3.x 단어 빈도 (자막·SNS·웹 등을 합친 빈도, CC BY-SA 4.0)

방법
- 표현의 첫 낱말(주로 동사)은 활용형(hang out / hung out / hanging out)을 함께 센다.
- someone, something 같은 자리 표시 낱말이 든 표현은 정확히 셀 수 없어 뺀다(한계).
- 빈도는 문장 100만 개당 등장 문장 수(per million)로 바꾼다.
- 키워드 방식이라 문자 그대로의 뜻(hang out the laundry)도 함께 세진다. 상위 표현은 표본을 읽어 확인한다.

실행: ../.venv/Scripts/python -I -X utf8 analyze.py [--samples]
"""

import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd
from wordfreq import zipf_frequency

DATA = Path(__file__).parent / "data"
OUTPUT = Path(__file__).parent / "output"
TOKEN = re.compile(r"[a-z]+(?:'[a-z]+)?")
PLACEHOLDERS = {"someone", "somebody", "something", "one's", "oneself", "someone's", "sb", "sth", "one"}
MAX_WORDS = 5
MIN_SENTENCES = 20  # 이보다 드문 표현은 앱에 넣을 만큼 자주 쓰이지 않는다고 본다
MIN_PMI = 3.0  # 함께 나오는 정도(PMI)가 이보다 낮으면 우연히 붙은 흔한 낱말 조합으로 본다
FUNCTION_WORDS = set(
    "a an the to of in on at for from by with as is are was were be been am do does did it its this that "
    "these those what how who why when where i you he she we they me him her us them my your his our their "
    "and or but not no so if can could will would shall should may might must have has had there here".split()
)

# 자주 쓰는 불규칙 동사만 따로 둔다(나머지는 규칙 활용으로 만든다).
IRREGULAR = {
    "be": ["am", "is", "are", "was", "were", "been", "being"],
    "go": ["went", "gone"], "get": ["got", "gotten"], "come": ["came"], "take": ["took", "taken"],
    "make": ["made"], "give": ["gave", "given"], "hang": ["hung"], "run": ["ran"], "put": [],
    "set": [], "cut": [], "let": [], "hit": [], "break": ["broke", "broken"], "bring": ["brought"],
    "catch": ["caught"], "do": ["did", "done", "does"], "have": ["had", "has"], "keep": ["kept"],
    "know": ["knew", "known"], "leave": ["left"], "lose": ["lost"], "pay": ["paid"], "say": ["said"],
    "see": ["saw", "seen"], "sell": ["sold"], "send": ["sent"], "sit": ["sat"], "speak": ["spoke", "spoken"],
    "stand": ["stood"], "tell": ["told"], "think": ["thought"], "throw": ["threw", "thrown"],
    "wake": ["woke", "woken"], "wear": ["wore", "worn"], "win": ["won"], "write": ["wrote", "written"],
    "fall": ["fell", "fallen"], "feel": ["felt"], "find": ["found"], "hold": ["held"], "lay": ["laid"],
    "lead": ["led"], "meet": ["met"], "pick": [], "show": ["shown"], "sleep": ["slept"], "spend": ["spent"],
    "stick": ["stuck"], "drive": ["drove", "driven"], "eat": ["ate", "eaten"], "drink": ["drank", "drunk"],
    "blow": ["blew", "blown"], "buy": ["bought"], "fly": ["flew", "flown"], "forget": ["forgot", "forgotten"],
    "grow": ["grew", "grown"], "hear": ["heard"], "mean": ["meant"], "ride": ["rode", "ridden"],
    "shut": [], "sink": ["sank", "sunk"], "swear": ["swore", "sworn"], "tear": ["tore", "torn"],
    "beat": ["beaten"], "bite": ["bit", "bitten"], "build": ["built"], "dig": ["dug"], "draw": ["drew", "drawn"],
    "light": ["lit"], "rise": ["rose", "risen"], "shake": ["shook", "shaken"], "shoot": ["shot"],
    "slip": [], "steal": ["stole", "stolen"], "strike": ["struck"], "swing": ["swung"], "freak": [],
}


def inflections(word):
    """규칙·불규칙 활용형을 만든다. 정확하지 않은 형태가 섞여도 문장에 없으면 세지지 않는다."""
    forms = {word, word + "s", word + "es", word + "ed", word + "d", word + "ing"}
    if word.endswith("e"):
        forms |= {word[:-1] + "ing", word + "d"}
    if word.endswith("y") and len(word) > 2 and word[-2] not in "aeiou":
        forms |= {word[:-1] + "ies", word[:-1] + "ied"}
    if re.fullmatch(r"[^aeiou]*[aeiou][^aeiouwy]", word):
        forms |= {word + word[-1] + "ed", word + word[-1] + "ing"}
    forms |= set(IRREGULAR.get(word, []))
    return forms


def load_basic_words():
    """교육과정 PDF 글자에서 기본 어휘 목록 부분만 골라 대표형과 변이형을 모은다."""
    text = (DATA / "curriculum_text.txt").read_text(encoding="utf-8")
    start = text.find("\n a*")
    end = text.find("II. 기본 어휘 관련 지침 개정 내용")
    headwords, marks, all_forms = [], Counter(), set()
    for line in text[start:end].splitlines():
        match = re.match(r"^\s+([a-z][a-z'\- ]*?)(\**)\s*(?:\(([^)]*)\))?\s*(?:/.*)?$", line)
        if not match:
            continue
        head = match.group(1).strip()
        headwords.append(head)
        marks[len(match.group(2))] += 1
        all_forms.add(head)
        for part in re.split(r"[/,]", line):
            for token in re.findall(r"[a-z][a-z'\-]*", part):
                all_forms.add(token)
    return headwords, marks, all_forms


def is_basic(token, basic):
    if token in basic:
        return True
    candidates = {token[:-1], token[:-2], token[:-3], token[:-3] + "y", token[:-2] + "e", token[:-3] + "e"}
    if token.endswith("ing") and len(token) > 5 and token[-4] == token[-5]:
        candidates.add(token[:-4])
    if token.endswith("ed") and len(token) > 4 and token[-3] == token[-4]:
        candidates.add(token[:-3])
    for base, forms in IRREGULAR.items():
        if token in forms:
            candidates.add(base)
    return any(c in basic for c in candidates if c)


def load_candidates():
    categories = json.loads((DATA / "wiktionary_categories.json").read_text(encoding="utf-8"))
    labels = defaultdict(set)
    for category, titles in categories.items():
        short = category.replace("English ", "")
        for title in titles:
            labels[title].add(short)
    candidates = {}
    for title, tags in labels.items():
        if not re.fullmatch(r"[A-Za-z' \-]+", title) or re.search(r"[A-Z]", title.replace("I ", "i ")):
            continue  # 고유명사, 기호가 든 표제어는 뺀다
        words = title.lower().replace("-", " ").split()
        if not 2 <= len(words) <= MAX_WORDS or PLACEHOLDERS & set(words):
            continue
        candidates[title] = {"words": tuple(words), "labels": sorted(tags)}
    return candidates


def build_index(candidates):
    index = defaultdict(set)
    for title, info in candidates.items():
        first, rest = info["words"][0], info["words"][1:]
        for form in inflections(first):
            index[(form, *rest)].add(title)
    return index


def count_matches(index, sample_store):
    counts = Counter()
    document_frequency = Counter()
    total = 0
    with open(DATA / "eng_sentences.txt", encoding="utf-8") as file:
        for line in file:
            total += 1
            tokens = TOKEN.findall(line.lower().replace("’", "'"))
            document_frequency.update(set(tokens))
            seen = set()
            for size in range(2, MAX_WORDS + 1):
                for start in range(len(tokens) - size + 1):
                    for title in index.get(tuple(tokens[start : start + size]), ()):
                        seen.add(title)
            for title in seen:
                counts[title] += 1
                bucket = sample_store[title]
                if len(bucket) < 40:
                    bucket.append(line.strip())
    return counts, document_frequency, total


def pmi(count, words, document_frequency, total):
    """표현이 낱말 각각의 빈도로 기대되는 것보다 몇 배(로그2) 더 함께 나오는지."""
    expected = total
    for word in words:
        expected *= max(document_frequency.get(word, 0), 1) / total
    return math.log2(count / expected) if expected > 0 else 0.0


# 교과서에서 흔히 배우는 표현과 원어민이 더 자주 쓴다고 알려진 대안. 문장 안 등장 수로 비교한다.
PAIRS = [
    ("인사 답", ["i'm fine thank you", "i am fine thank you"], ["i'm good", "not bad", "pretty good"]),
    ("안부", ["how are you"], ["how's it going", "what's up", "how have you been"]),
    ("감사", ["thank you very much"], ["thanks a lot", "thanks so much", "i appreciate it"]),
    ("작별", ["good bye", "goodbye"], ["see you", "take care", "see you later", "bye"]),
    ("모름", ["i don't know"], ["no idea", "i have no idea", "beats me", "not sure"]),
    ("사과", ["i'm sorry"], ["my bad", "sorry about that"]),
    ("동의", ["i agree with you"], ["sounds good", "makes sense", "fair enough"]),
    ("부탁", ["can you help me"], ["could you do me a favor", "can you give me a hand"]),
]


def phrase_count(phrase, sentences):
    pattern = re.compile(r"\b" + re.escape(phrase) + r"\b")
    return sum(1 for sentence in sentences if pattern.search(sentence))


def compare_pairs():
    sentences = [
        line.lower().replace("’", "'").replace(",", "")
        for line in open(DATA / "eng_sentences.txt", encoding="utf-8")
    ]
    rows = []
    for name, textbook, natural in PAIRS:
        for kind, phrases in (("교과서", textbook), ("원어민 대안", natural)):
            for phrase in phrases:
                rows.append({"situation": name, "kind": kind, "phrase": phrase, "sentences": phrase_count(phrase, sentences)})
    return pd.DataFrame(rows)


# 구어에서 많이 쓰는 짧은 낱말과 교과서식 낱말을 wordfreq(자막·SNS 포함 빈도)로 비교한다.
WORD_PAIRS = [("yes", "yeah"), ("okay", "ok"), ("going", "gonna"), ("want", "wanna"), ("very", "really"), ("friend", "buddy")]


def main():
    headwords, marks, basic = load_basic_words()
    print(f"기본 어휘 대표형 {len(headwords):,}개 (초등 * {marks[1]}, 공통 ** {marks[2]}, 나머지 {marks[0]})")

    candidates = load_candidates()
    print(f"후보 표현 {len(candidates):,}개 (2~5단어, 자리 표시 낱말·고유명사 제외)")
    samples = defaultdict(list)
    counts, document_frequency, total = count_matches(build_index(candidates), samples)
    print(f"Tatoeba 영어 문장 {total:,}개에서 셈")

    rows = []
    for title, info in candidates.items():
        count = counts.get(title, 0)
        if count == 0:
            continue
        words = info["words"]
        if "-" in title or all(word in FUNCTION_WORDS for word in words):
            continue  # 붙임표 낱말(has-been)은 다른 낱말이고, 기능어끼리만 된 조합은 표현이 아니다
        rows.append(
            {
                "expression": title,
                "labels": ",".join(info["labels"]),
                "sentences": count,
                "per_million": round(count / total * 1_000_000, 1),
                "words": len(words),
                "all_basic": all(is_basic(word, basic) for word in words),
                "min_word_zipf": round(min(zipf_frequency(word, "en") for word in words), 2),
                "pmi": round(pmi(count, words, document_frequency, total), 2),
            }
        )
    table = pd.DataFrame(rows).sort_values("sentences", ascending=False)
    OUTPUT.mkdir(exist_ok=True)
    table.to_csv(OUTPUT / "expressions_ranked.csv", index=False, encoding="utf-8-sig")

    easy = table[table["all_basic"]]
    shortlist = easy[(easy["sentences"] >= MIN_SENTENCES) & (easy["pmi"] >= MIN_PMI)]
    shortlist.to_csv(OUTPUT / "shortlist.csv", index=False, encoding="utf-8-sig")
    pairs = compare_pairs()
    pairs.to_csv(OUTPUT / "textbook_vs_natural.csv", index=False, encoding="utf-8-sig")
    word_pairs = pd.DataFrame(
        [{"textbook": a, "spoken": b, "zipf_textbook": zipf_frequency(a, "en"), "zipf_spoken": zipf_frequency(b, "en")} for a, b in WORD_PAIRS]
    )

    summary = {
        "sentences": total,
        "basic_headwords": len(headwords),
        "candidates": len(candidates),
        "found_in_corpus": int(len(table)),
        "found_all_basic": int(len(easy)),
        "shortlist": int(len(shortlist)),
        "share_all_basic_top500": round(float(table.head(500)["all_basic"].mean()) * 100, 1),
        "top_shortlist": shortlist.head(30)[["expression", "sentences", "pmi", "labels"]].to_dict("records"),
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")

    pd.set_option("display.width", 220)
    pd.set_option("display.max_rows", 200)
    print(f"\n말뭉치에 한 번 이상 나온 후보 {len(table):,}개, 그중 기본 어휘로만 된 것 {len(easy):,}개")
    print(f"자주 쓰이고(문장 {MIN_SENTENCES}개 이상) 함께 붙어 다니는(PMI {MIN_PMI} 이상) 후보 {len(shortlist):,}개")
    print("\n[후보, 많이 쓰인 순 상위 60]")
    print(shortlist.head(60).to_string(index=False))
    print("\n[교과서 vs 원어민 대안: 등장 문장 수]")
    print(pairs.to_string(index=False))
    print("\n[낱말 빈도 비교 (Zipf, 높을수록 흔함)]")
    print(word_pairs.round(2).to_string(index=False))

    if "--samples" in sys.argv:
        random.seed(7)
        lines = []
        for title in shortlist.head(600)["expression"]:
            picked = random.sample(samples[title], min(4, len(samples[title])))
            lines.append(f"## {title}\n" + "\n".join(f"- {s}" for s in picked))
        (OUTPUT / "samples.md").write_text("\n\n".join(lines), encoding="utf-8")
        print("\n표본을 output/samples.md에 썼어요.")


if __name__ == "__main__":
    main()
