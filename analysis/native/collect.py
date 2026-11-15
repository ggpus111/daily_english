"""원어민 영어 vs 교과서 영어 분석에 쓸 공개 데이터를 모은다.

모으는 것 (모두 상업 이용이 가능한 조건만, 원본은 저장소에 올리지 않음)
1. Tatoeba 영어 문장 (CC BY 2.0 FR) - 실제로 문장에 쓰이는 표현의 빈도
2. 위키낱말사전(Wiktionary) 분류의 표제어 목록 (CC BY-SA 4.0) - 후보 표현
   English idioms / English phrasal verbs / English informal terms / English colloquialisms
3. 2022 개정 영어과 교육과정 기본 어휘(교육부 고시 별표, 저작권법 제7조로 보호 대상 아님)
   - 경기도교육청이 올린 PDF에서 단어를 뽑는다

실행: ../.venv/Scripts/python -I collect.py
"""

import bz2
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path(__file__).parent / "data"
USER_AGENT = "daily-english-research/1.0 (language learning app study)"

TATOEBA_URL = "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2"
CURRICULUM_PDF_URL = "https://www.goe.go.kr/resource/old/BBSMSTR_000000030136/BBS_202307111028067791.pdf"
WIKTIONARY_API = "https://en.wiktionary.org/w/api.php"
CATEGORIES = [
    "English idioms",
    "English phrasal verbs",
    "English informal terms",
    "English colloquialisms",
]


def fetch(url, path):
    if path.exists():
        print(f"이미 있음: {path.name}")
        return
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response, open(path, "wb") as file:
        file.write(response.read())
    print(f"받음: {path.name} ({path.stat().st_size:,} bytes)")


def tatoeba():
    archive = DATA / "eng_sentences.tsv.bz2"
    fetch(TATOEBA_URL, archive)
    out = DATA / "eng_sentences.txt"
    if out.exists():
        return
    count = 0
    with bz2.open(archive, "rt", encoding="utf-8") as source, open(out, "w", encoding="utf-8") as target:
        for line in source:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                target.write(parts[2] + "\n")
                count += 1
    print(f"영어 문장 {count:,}개")


def category_members(title):
    """분류에 속한 표제어 이름만 가져온다(뜻풀이는 가져오지 않음)."""
    members = []
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{title}",
        "cmlimit": "500",
        "cmnamespace": "0",
        "format": "json",
    }
    while True:
        url = WIKTIONARY_API + "?" + urllib.parse.urlencode(params)
        data = get_json(url)
        members += [item["title"] for item in data["query"]["categorymembers"]]
        if "continue" not in data:
            return members
        params.update(data["continue"])
        time.sleep(2)  # 위키미디어 서버에 부담을 주지 않게 천천히


def get_json(url, tries=6):
    """429(요청이 너무 많음)면 서버가 알려 준 시간만큼, 없으면 점점 길게 기다렸다 다시 묻는다."""
    for attempt in range(tries):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == tries - 1:
                raise
            wait = int(error.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            print(f"  요청이 많다고 해서 {wait}초 기다림")
            time.sleep(wait)


def wiktionary():
    out = DATA / "wiktionary_categories.json"
    if out.exists():
        print("이미 있음: wiktionary_categories.json")
        return
    result = {}
    for title in CATEGORIES:
        result[title] = category_members(title)
        print(f"{title}: {len(result[title]):,}개")
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")


def curriculum():
    from pypdf import PdfReader

    pdf = DATA / "curriculum_2022_english_words.pdf"
    fetch(CURRICULUM_PDF_URL, pdf)
    out = DATA / "basic_words.json"
    if out.exists():
        return
    text = "\n".join(page.extract_text() or "" for page in PdfReader(pdf).pages)
    (DATA / "curriculum_text.txt").write_text(text, encoding="utf-8")
    # 목록의 단어는 영문 소문자로 시작하고, 초등 권장(*)·공통 권장(**) 표시가 붙는다.
    words = set()
    for token in re.findall(r"[A-Za-z][A-Za-z'\-]*\**", text):
        word = token.rstrip("*").lower()
        if len(word) > 1 or word in ("a", "i"):
            words.add(word)
    out.write_text(json.dumps(sorted(words), ensure_ascii=False), encoding="utf-8")
    print(f"PDF에서 뽑은 영어 낱말 후보 {len(words):,}개 (목록 밖 낱말이 섞여 있어 analyze에서 거른다)")


KOREAN_URL = "https://downloads.tatoeba.org/exports/per_language/kor/kor_sentences.tsv.bz2"
LINKS_URL = "https://downloads.tatoeba.org/exports/per_language/eng/eng-kor_links.tsv.bz2"


def korean_pairs():
    """Tatoeba에서 영어 문장과 한국어 번역이 연결된 쌍을 만든다(앱 예문용, CC BY 2.0 FR)."""
    out = DATA / "eng_kor_pairs.tsv"
    if out.exists():
        print("이미 있음: eng_kor_pairs.tsv")
        return
    fetch(KOREAN_URL, DATA / "kor_sentences.tsv.bz2")
    fetch(LINKS_URL, DATA / "eng-kor_links.tsv.bz2")
    korean = {}
    with bz2.open(DATA / "kor_sentences.tsv.bz2", "rt", encoding="utf-8") as file:
        for line in file:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                korean[parts[0]] = parts[2]
    english = {}
    with bz2.open(DATA / "eng_sentences.tsv.bz2", "rt", encoding="utf-8") as file:
        for line in file:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                english[parts[0]] = parts[2]
    pairs = 0
    with bz2.open(DATA / "eng-kor_links.tsv.bz2", "rt", encoding="utf-8") as file, open(out, "w", encoding="utf-8") as target:
        for line in file:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2 or parts[0] not in english or parts[1] not in korean:
                continue
            target.write(f"{parts[0]}\t{english[parts[0]]}\t{parts[1]}\t{korean[parts[1]]}\n")
            pairs += 1
    print(f"영어-한국어 문장 쌍 {pairs:,}개")


if __name__ == "__main__":
    DATA.mkdir(exist_ok=True)
    tatoeba()
    wiktionary()
    curriculum()
    korean_pairs()
