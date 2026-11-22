"""다른 학습 언어의 꾸러미 원고에 말뭉치 빈도와 예문을 붙여 앱 데이터(src/data/{ja,zh,es,fr,ko}/)를 만든다.

원고(drafts/, 사람이 고르고 AI와 함께 씀)
- {언어}_talk.tsv: 연인·친구 대화 꾸러미 11개. 영어(analysis/native/talk_draft.json)와 같은 주제·순서라
  같은 번호(예: miss-01)는 같은 뜻의 말이다. 열: 꾸러미, 표현, 셀 형태, 뜻, 예문, 예문 해석, 팁
- {언어}_daily.tsv: 일상 표현 꾸러미 10개(각 40개). 열은 위와 같다.
- {언어}_words.tsv: 단어 600개(초급 300, 중급 300). 열: 단계, 단어, 뜻, [예문], [예문 해석]
  예문을 비워 두면 Tatoeba에서 고른다: 한국어 번역이 있는 문장을 먼저, 없으면 영어 번역이 있는 문장을 골라
  output/{언어}_need_translation.tsv에 내보낸다(사람이 해석을 채워 {언어}_words.tsv에 넣고 다시 실행).
뜻과 해석은 한국어로 쓴다. 한국어(ko) 꾸러미만 외국인 연인이 배우는 용도라 영어로 쓴다.

빈도: 그 언어 Tatoeba 문장 중 몇 문장에 쓰였는지(일본어·중국어·한국어는 글자 그대로, 스페인어·프랑스어는 낱말 단위).
5문장 미만이면 앱에 빈도를 보여 주지 않는다(영어 대화 꾸러미와 같은 규칙). wordfreq 빈도는 분석 결과에만 남긴다.

실행: ../.venv/Scripts/python -I -X utf8 build.py [ja zh es fr ko]
"""

import csv
import json
import re
import sys
from pathlib import Path

from wordfreq import zipf_frequency

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
DATA = HERE / "data"
DRAFTS = HERE / "drafts"
OUTPUT = HERE / "output"

LANGS = {"ja": "jpn", "zh": "cmn", "es": "spa", "fr": "fra", "ko": "kor"}
NO_SPACE = {"ja", "zh", "ko"}  # 낱말 단위로 끊지 않고 글자 그대로 센다(한국어는 조사·어미 때문에)
MIN_COUNT = 5

TALK_PACKS = [
    ("love", "애정 표현", "Love & affection"),
    ("miss", "보고 싶을 때", "Missing you"),
    ("text", "메시지 줄임말", "Texting shortcuts"),
    ("chat", "안부·수다", "Catching up"),
    ("tease", "장난·놀리기", "Teasing & jokes"),
    ("date", "약속·데이트", "Plans & dates"),
    ("call", "영상통화·장거리", "Calls & distance"),
    ("fight", "다툼·화해", "Fights & making up"),
    ("care", "위로·응원", "Comfort & cheering"),
    ("react", "칭찬·리액션", "Compliments & reactions"),
    ("culture", "되묻기·문화 차이", "Asking & culture"),
]
DAILY_PACKS = [
    ("daily", "일상 대화", "Everyday talk"),
    ("routine", "하루 일과", "Daily routine"),
    ("out", "밖에서", "Out and about"),
    ("feelings", "감정·관계", "Feelings & people"),
    ("plans", "약속·계획", "Plans & time"),
    ("connect", "말 잇기", "Linking words"),
    ("trouble", "문제 해결", "Problems & fixes"),
    ("reply", "맞장구·대답", "Replies & reactions"),
    ("polite", "예의 있게 말하기", "Polite speech"),
    ("idioms", "자주 쓰는 관용 표현", "Common idioms"),
]
# 대화 주제별 단어 꾸러미(to_themes.py). 영어 단어 꾸러미만 초급·중급이다.
WORD_LEVELS = [
    ("love", "연애·애정", "Love & romance"),
    ("feel", "기분·마음", "Feelings"),
    ("bond", "관계·위로·부탁", "People & support"),
    ("talk", "말·연락", "Talking & messages"),
    ("trip", "여행·약속", "Trips & plans"),
    ("food", "음식·건강", "Food & health"),
    ("life", "생활·그 밖의 말", "Daily life & more"),
]

# 예문 고르기: 나나 너의 말이면 좋고, 사람 이름(Tatoeba의 Tom, Mary 등)과 어두운 말은 피한다.
PERSONAL = {
    "ja": r"私|僕|俺|あなた|君|わたし|ぼく",
    "zh": r"我|你",
    "es": r"\b(yo|me|mi|mis|tú|te|tu|tus|nos|nosotros)\b",
    "fr": r"\b(je|j'|me|m'|moi|mon|ma|mes|tu|te|t'|toi|ton|ta|tes|nous|on)\b",
    "ko": r"나는|내가|나도|너|저는|제가|우리",
}
NAMES = re.compile(r"Tom|Mary|John|Alice|Ken|トム|メアリー|ジョン|汤姆|玛丽|湯姆|瑪麗|톰|메리|Tomás|María", re.I)
DARK = re.compile(r"kill|death|dead|murder|gun|war|殺|死|杀|战争|枪|muert|mat[aó]|guerra|arma|tu[ée]|mort|guerre|죽|살인|전쟁", re.I)


def read_tsv(path, columns):
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        parts += [""] * (columns - len(parts))
        rows.append([part.strip() for part in parts[:columns]])
    return rows


KANJI = r"\u4e00-\u9fff"


def short_kanji(lang, word):
    return lang == "ja" and len(word) <= 2 and re.fullmatch(f"[{KANJI}]+", word) is not None


def kanji_pattern(word):
    return re.compile(f"(?<![{KANJI}]){re.escape(word)}(?![{KANJI}])")


def tokens(text):
    return re.findall(r"[\w']+", text.lower().replace("’", "'"))


class Corpus:
    def __init__(self, lang):
        self.lang = lang
        self.sentences = (DATA / f"{LANGS[lang]}_sentences.txt").read_text(encoding="utf-8").splitlines()

    def counts(self, phrases):
        phrases = [phrase.lower() for phrase in phrases]
        result = dict.fromkeys(phrases, 0)
        if self.lang in NO_SPACE:
            patterns = {phrase: kanji_pattern(phrase) for phrase in phrases if short_kanji(self.lang, phrase)}
            for sentence in self.sentences:
                low = sentence.lower()
                for phrase in phrases:
                    if phrase and phrase in low and (phrase not in patterns or patterns[phrase].search(sentence)):
                        result[phrase] += 1
            return result
        index = {}
        for phrase in phrases:
            index.setdefault(tuple(tokens(phrase)), []).append(phrase)
        longest = max((len(key) for key in index), default=1)
        for sentence in self.sentences:
            words = tokens(sentence)
            seen = set()
            for size in range(1, longest + 1):
                for start in range(len(words) - size + 1):
                    for phrase in index.get(tuple(words[start : start + size]), []):
                        seen.add(phrase)
            for phrase in seen:
                result[phrase] += 1
        return result


def contains(lang, word, sentence):
    if short_kanji(lang, word):
        return kanji_pattern(word).search(sentence) is not None
    if lang in NO_SPACE:
        return word.lower() in sentence.lower()
    target = tokens(word)
    words = tokens(sentence)
    return any(words[start : start + len(target)] == target for start in range(len(words) - len(target) + 1))


def size_ok(lang, sentence):
    if lang in NO_SPACE:
        return 4 <= len(sentence) <= (22 if lang != "ko" else 30)
    return 3 <= len(tokens(sentence)) <= 11


def pick_example(lang, word, pairs):
    """단어가 든 예문 하나: 점수가 낮을수록 좋다(나나 너의 말, 이름·어두운 말 없음, 적당한 길이)."""
    head = word.split(" (")[0]  # "contento (contenta)" → contento
    best = None
    for number, sentence, translation in pairs:
        if not contains(lang, head, sentence) or not size_ok(lang, sentence):
            continue
        if NAMES.search(sentence) or DARK.search(sentence) or DARK.search(translation) or re.search(r"\d", sentence):
            continue
        score = 0 if re.search(PERSONAL[lang], sentence, re.I) else 3
        score += abs(len(sentence) - (12 if lang in NO_SPACE else 40)) / 10
        if best is None or score < best[0]:
            best = (score, number, sentence, translation)
    return best


def read_pairs(lang, other):
    path = DATA / f"{LANGS[lang]}_{other}_pairs.tsv"
    if not path.exists():
        return []
    pairs = []
    for line in path.read_text(encoding="utf-8").splitlines():
        number, sentence, _, translation = line.split("\t")
        pairs.append((int(number), sentence, translation))
    return pairs


def build_packs(lang, corpus, report):
    talk = read_tsv(DRAFTS / f"{lang}_talk.tsv", 7)
    daily = read_tsv(DRAFTS / f"{lang}_daily.tsv", 7)
    rows = talk + daily
    if not rows:
        return None
    counts = corpus.counts([row[2] or row[1] for row in rows])
    packs = {pack: [] for pack, _, _ in TALK_PACKS + DAILY_PACKS}
    seen = set()
    for pack, text, match, meaning, example, example_tr, tip in rows:
        key = re.sub(r"[.!?。！？,、]", "", text.lower())
        if key in seen:
            report["duplicates"].append(text)
            continue
        seen.add(key)
        count = counts[(match or text).lower()]
        item = {
            "id": f"{lang}-{pack}-{len(packs[pack]) + 1:02d}",
            "text": text,
            "meaning": meaning,
            "example": example,
            "exampleKo": example_tr,
            "tip": tip,
        }
        if pack == "text":
            item["texting"] = True
        elif count >= MIN_COUNT:
            item["sentences"] = count
            item["perMillion"] = round(count / len(corpus.sentences) * 1_000_000, 1)
        packs[pack].append(item)
        report["rows"].append({"lang": lang, "pack": pack, "text": text, "tatoeba": count,
                               "zipf": round(zipf_frequency(match or text, lang), 2)})
    groups = [
        {"id": pack, "title": {"ko": ko, "en": en}, "items": packs[pack]}
        for pack, ko, en in TALK_PACKS + DAILY_PACKS
        if packs[pack]
    ]
    return {
        "source": {
            "corpus": f"Tatoeba (tatoeba.org) {LANGS[lang]} sentences, CC BY 2.0 FR",
            "sentences": len(corpus.sentences),
            "note": "표현과 예문, 풀이는 Daily English가 직접 썼고(AI 도움), 빈도만 말뭉치에서 셌습니다.",
        },
        "packs": groups,
    }


def build_words(lang, corpus, report):
    rows = read_tsv(DRAFTS / f"{lang}_words.tsv", 5)
    if not rows:
        return None
    translated = "eng" if lang == "ko" else "kor"
    first = read_pairs(lang, translated)
    second = [] if lang == "ko" else read_pairs(lang, "eng")
    need = []
    levels = {level: [] for level, _, _ in WORD_LEVELS}
    written = {row[0]: row for row in read_tsv(DRAFTS / f"{lang}_word_examples.tsv", 4)}
    seen = set()
    counts = corpus.counts([row[1].split(" (")[0] for row in rows])
    for level, word, meaning, example, example_tr in rows:
        if word in seen:
            report["duplicates"].append(f"{lang} 단어 {word}")
            continue
        seen.add(word)
        if not example and word in written:
            _, example, example_tr, number = written[word]
            if number.isdigit():
                example_tatoeba = int(number)
            else:
                example_tatoeba = None
        else:
            example_tatoeba = None
        item = {"id": f"{lang}-w-{level}{len(levels[level]) + 1:03d}", "word": word, "meaning": meaning,
                "sentences": counts[word.split(" (")[0].lower()]}
        if example:
            item["example"], item["exampleKo"] = example, example_tr
            if example_tatoeba:
                item["tatoeba"] = example_tatoeba
        else:
            found = pick_example(lang, word, first)
            if found:
                _, number, sentence, translation = found
                item.update(example=sentence, exampleKo=translation, tatoeba=number)
            else:
                found = pick_example(lang, word, second)
                if found:
                    _, number, sentence, translation = found
                    need.append([level, word, meaning, sentence, "", translation, str(number)])
                item.update(example="", exampleKo="")
        levels[level].append(item)
    if need:
        with open(OUTPUT / f"{lang}_need_translation.tsv", "w", encoding="utf-8", newline="") as file:
            file.write("# 단계\t단어\t뜻\t예문\t(여기에 한국어 해석)\t영어 번역(참고)\tTatoeba 번호\n")
            file.write("# 해석을 채워 drafts/{언어}_word_examples.tsv에 '단어\t예문\t해석\t번호'로 옮긴다\n")
            csv.writer(file, delimiter="\t").writerows(need)
    report["need_translation"][lang] = len(need)
    report["no_example"][lang] = sum(1 for items in levels.values() for item in items if not item["example"])
    return {
        "source": {
            "corpus": f"Tatoeba (tatoeba.org) {LANGS[lang]} sentences, CC BY 2.0 FR",
            "sentences": len(corpus.sentences),
            "note": "단어는 연인·친구와의 대화에서 쓰는 말을 사람이 골랐고(analyze_words.py로 점검), 뜻은 Daily English가 직접 썼습니다(AI 도움).",
        },
        "levels": [
            {"id": level, "title": {"ko": ko, "en": en}, "items": levels[level]}
            for level, ko, en in WORD_LEVELS
            if levels[level]
        ],
    }


def main():
    langs = sys.argv[1:] or list(LANGS)
    OUTPUT.mkdir(exist_ok=True)
    report = {"rows": [], "duplicates": [], "need_translation": {}, "no_example": {}}
    for lang in langs:
        corpus = Corpus(lang)
        out = ROOT / "src" / "data" / lang
        packs = build_packs(lang, corpus, report)
        words = build_words(lang, corpus, report)
        if packs or words:
            out.mkdir(parents=True, exist_ok=True)
        if packs:
            (out / "packs.json").write_text(json.dumps(packs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            sizes = {group["id"]: len(group["items"]) for group in packs["packs"]}
            print(f"{lang} 표현 {sum(sizes.values())}개 {sizes}")
        if words:
            (out / "words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            print(f"{lang} 단어 {sum(len(level['items']) for level in words['levels'])}개, "
                  f"해석이 필요한 예문 {report['need_translation'][lang]}개, 예문 없음 {report['no_example'][lang]}개")
    if report["rows"]:
        with open(OUTPUT / "multilang_frequency.csv", "w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(report["rows"][0]))
            writer.writeheader()
            writer.writerows(report["rows"])
    if report["duplicates"]:
        print("겹쳐서 뺀 표현:", report["duplicates"])


if __name__ == "__main__":
    main()
