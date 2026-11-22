"""다른 학습 언어(일본어, 중국어, 스페인어, 프랑스어, 한국어)의 문장 자료를 모은다.

영어(analysis/native/collect.py)와 같은 Tatoeba 언어별 내보내기(CC BY 2.0 FR)를 쓴다.
- {언어}_sentences.tsv.bz2: 그 언어 문장 전체(빈도 세기)
- {언어}-kor_links, {언어}-eng_links: 그 문장의 한국어·영어 번역 연결(예문과 해석)
결과(data/, 저장소에 올리지 않음):
- {언어}_sentences.txt: 한 줄에 문장 하나
- {언어}_kor_pairs.tsv, {언어}_eng_pairs.tsv: 번호, 문장, 번역 번호, 번역

실행: ../.venv/Scripts/python -I -X utf8 collect.py
"""

import bz2
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
NATIVE_DATA = HERE.parent / "native" / "data"  # 영어 문장과 한국어 문장은 이미 받아 둠
BASE = "https://downloads.tatoeba.org/exports/per_language"
LANGS = ["jpn", "cmn", "spa", "fra", "kor"]
USER_AGENT = "daily-english-analysis/1.0 (language learning app research)"


def fetch(url, path):
    if path.exists() and path.stat().st_size > 0:
        return
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=120) as response, open(path, "wb") as file:
                file.write(response.read())
            print(f"받음 {path.name} {path.stat().st_size / 1e6:.1f}MB")
            return
        except Exception as error:  # noqa: BLE001 - 네트워크 오류는 다시 시도
            print(f"다시 시도 {url}: {error}")
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"받지 못함: {url}")


def read_sentences(archive):
    sentences = {}
    with bz2.open(archive, "rt", encoding="utf-8") as file:
        for line in file:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                sentences[parts[0]] = parts[2]
    return sentences


def pairs(lang, other, own, other_sentences):
    links = DATA / f"{lang}-{other}_links.tsv.bz2"
    fetch(f"{BASE}/{lang}/{lang}-{other}_links.tsv.bz2", links)
    count = 0
    with bz2.open(links, "rt", encoding="utf-8") as file, open(DATA / f"{lang}_{other}_pairs.tsv", "w", encoding="utf-8") as out:
        for line in file:
            source, target = line.rstrip("\n").split("\t")[:2]
            if source in own and target in other_sentences:
                out.write(f"{source}\t{own[source]}\t{target}\t{other_sentences[target]}\n")
                count += 1
    return count


def main():
    DATA.mkdir(exist_ok=True)
    english = read_sentences(NATIVE_DATA / "eng_sentences.tsv.bz2")
    korean_archive = NATIVE_DATA / "kor_sentences.tsv.bz2"
    korean = read_sentences(korean_archive)
    for lang in LANGS:
        if lang == "kor":
            own = korean
        else:
            archive = DATA / f"{lang}_sentences.tsv.bz2"
            fetch(f"{BASE}/{lang}/{lang}_sentences.tsv.bz2", archive)
            own = read_sentences(archive)
        (DATA / f"{lang}_sentences.txt").write_text("\n".join(own.values()) + "\n", encoding="utf-8")
        with_korean = 0 if lang == "kor" else pairs(lang, "kor", own, korean)
        with_english = pairs(lang, "eng", own, english)
        print(f"{lang}: 문장 {len(own):,}개, 한국어 번역 쌍 {with_korean:,}개, 영어 번역 쌍 {with_english:,}개")


if __name__ == "__main__":
    main()
