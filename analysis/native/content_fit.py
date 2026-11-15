"""앱에 넣은 단어·예문·표현이 Daily English의 성격에 맞는지 숫자로 점검한다.

Daily English는 "작은 기록이 모여 나만의 언어가 돼요"라는 앱이다. 사용자 리뷰 분석(../README.md)에서
만족 요인은 나만의 기록·일기·감정, 귀여움·따뜻한 디자인, 벌칙 없는 꾸준함이었다.
그래서 꾸러미 콘텐츠도 "내 하루와 기분을 말하는 데 바로 쓰는 말"이어야 한다고 보고, 아래 기준을 센다.

| 기준 | 세는 방법 | 바라는 방향 |
| 내 말투 | 예문에 I/my/we 같은 1인칭이나 you(대화 상대)가 있는가 | 높게 |
| 남의 이야기 | Tom, Mary 같은 서양 인물 이름이 주어인가(Tatoeba 특유의 문장) | 낮게 |
| 어두운 내용 | 죽음·폭력·범죄·전쟁·질병 낱말 | 0에 가깝게 |
| 딱딱한 내용 | 정치·경제·군사 같은 뉴스 낱말 | 낮게 |
| 우리말 말투 | 해석이 반말(해체·해라체)인가, 존댓말(해요체·합쇼체)인가 | 한 꾸러미 안에서 고르게 |
| 기분 낱말 | 일기에 자주 쓰는 기분 낱말이 단어 꾸러미에 있는가 | 많이 |

실행: ../.venv/Scripts/python -I -X utf8 content_fit.py [이름] [단어 JSON] [표현 JSON]  -> output/content_fit_이름.json
(단어·표현 JSON을 주지 않으면 앱 데이터 src/data/words.json, packs.json을 본다. 고치기 전 상태는 make_before.py가 만든다.)
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent / "output"

FIRST_PERSON = re.compile(r"\b(I|I'm|I've|I'll|I'd|me|my|mine|myself|we|we're|we've|we'll|our|us)\b", re.IGNORECASE)
SECOND_PERSON = re.compile(r"\b(you|you're|you've|you'll|your)\b", re.IGNORECASE)
NAMES = re.compile(
    r"\b(Tom|Mary|John|Jack|Ken|Bill|Jim|Kate|Mike|Bob|Ann|Lucy|Emily|Alice|Sami|Layla|Dan|Linda|Tony|Betty|Jane|"
    r"Fred|Meg|Nancy|Sam|Paul|Taro|Hanako|Mr|Mrs|Ms)\b"
)
DARK = re.compile(
    r"\b(kill\w*|murder\w*|dead|death|die|died|dies|gun\w*|shoot\w*|shot|war|wars|prison\w*|jail|crime\w*|criminal\w*|"
    r"drug\w*|attack\w*|enem\w+|arrest\w*|steal\w*|stole\w*|blood\w*|bomb\w*|suicide|zombie\w*|plague|thie\w+|"
    r"wound\w*|fortress|addict\w*|haunted|punish\w*|violen\w*|weapon\w*)\b",
    re.IGNORECASE,
)
# 관용구 속에서는 어두운 뜻이 아닌 경우(dying to = 몹시 ~하고 싶다, killing me = 아파 죽겠다)
DARK_IDIOM = re.compile(r"\b(dying to|killing me|scared to death|kill two birds)\b", re.IGNORECASE)
FORMAL = re.compile(
    r"\b(government|economy|economic|political|politic\w*|president|nation\w*|commerce|military|army|tax\w*|"
    r"parliament|election|policy|industr\w*|fortress|plague)\b",
    re.IGNORECASE,
)
POLITE = re.compile(r"(요|니다|니까|세요|십시오|죠)[.?!…\s]*$")
FEELINGS = (
    "happy sad angry tired bored excited nervous worried scared afraid lonely upset proud glad sorry surprised "
    "disappointed embarrassed jealous comfortable relaxed sick hungry full busy free calm confused amazed annoyed "
    "satisfied thankful grateful shy brave"
).split()


# 단어 꾸러미에는 동사 원형(worry, scare)으로 들어 있는 기분 낱말
FEELING_BASES = {
    "worried": "worry", "scared": "scare", "surprised": "surprise", "relaxed": "relax", "amazed": "amazing",
    "annoyed": "annoy", "thankful": "thank",
}


def pct(part, whole):
    return round(part / whole * 100, 1) if whole else 0.0


def sentence_stats(rows):
    """rows: (영어 예문, 우리말 해석)"""
    total = len(rows)
    first = sum(bool(FIRST_PERSON.search(en)) for en, _ in rows)
    personal = sum(bool(FIRST_PERSON.search(en) or SECOND_PERSON.search(en)) for en, _ in rows)
    names = [en for en, _ in rows if NAMES.search(en)]
    dark = [en for en, _ in rows if DARK.search(DARK_IDIOM.sub("", en))]
    formal = [en for en, _ in rows if FORMAL.search(en)]
    polite = sum(bool(POLITE.search(ko.strip())) for _, ko in rows)
    return {
        "count": total,
        "first_person_pct": pct(first, total),
        "personal_voice_pct": pct(personal, total),
        "names_pct": pct(len(names), total),
        "dark_pct": pct(len(dark), total),
        "formal_pct": pct(len(formal), total),
        "polite_korean_pct": pct(polite, total),
        "examples": {"names": names[:8], "dark": dark[:12], "formal": formal[:8]},
    }


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "now"
    words_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "src/data/words.json"
    packs_path = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "src/data/packs.json"
    words = json.loads(words_path.read_text(encoding="utf-8"))
    packs = json.loads(packs_path.read_text(encoding="utf-8"))
    word_items = [item for level in words["levels"] for item in level["items"]]
    expression_items = [item for pack in packs["packs"] for item in pack["items"]]

    shown = {item["word"].lower() for item in word_items}
    dark_words = sorted(word for word in shown if DARK.search(word))
    result = {
        "words": {
            "count": len(word_items),
            "dark_words": dark_words,
            "feelings_in_pack": [word for word in FEELINGS if word in shown or FEELING_BASES.get(word) in shown],
            "feelings_missing": [word for word in FEELINGS if word not in shown and FEELING_BASES.get(word) not in shown],
            "examples_from_tatoeba_pct": pct(sum(bool(item["tatoeba"]) for item in word_items), len(word_items)),
        },
        "word_examples": sentence_stats([(item["example"], item["exampleKo"]) for item in word_items]),
        "expression_examples": sentence_stats([(item["example"], item["exampleKo"]) for item in expression_items]),
    }
    OUT.mkdir(exist_ok=True)
    path = OUT / f"content_fit_{name}.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")

    for key in ("word_examples", "expression_examples"):
        stats = result[key]
        print(
            f"{key}: {stats['count']}개 | 1인칭 {stats['first_person_pct']}% | 나·너의 말투 {stats['personal_voice_pct']}% | "
            f"인물 이름 {stats['names_pct']}% | 어두운 내용 {stats['dark_pct']}% | 딱딱한 내용 {stats['formal_pct']}% | "
            f"존댓말 해석 {stats['polite_korean_pct']}%"
        )
    print(f"어두운 단어 {len(dark_words)}개: {dark_words}")
    print(f"기분 낱말 {len(result['words']['feelings_in_pack'])}/{len(FEELINGS)}, 빠진 것: {result['words']['feelings_missing']}")
    print(f"-> {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
