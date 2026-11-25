"""단어 꾸러미 600개를 고르고, 단어마다 실제 한영 예문 후보를 붙인다.

- 기준: 2022 개정 영어과 교육과정 기본 어휘. 초등 권장(*)에서 300개를 초급, 공통 권장(**)에서 300개를 중급,
  표시가 없는 고등학교 선택과목 권장 어휘에서 300개를 고급으로. 고급은 words_draft.json의 따로 쓴 단계(대화·비즈니스·학업 단어)와
  겹치는 낱말을 뺀다(같은 단어가 두 단계에 나오지 않게).
- 목록의 괄호 속 파생어(hunger** (hungry), comfort** (comfortable))도 같은 단계의 후보로 넣는다.
- 순서: Tatoeba 전체 문장에 나온 횟수와 "나를 말하는 문장"(I, my, we 같은 1인칭이 든 문장)에 나온 횟수의
  기하평균이 높은 순. Daily English는 내 하루와 기분을 기록하는 앱이라 내 이야기에 자주 쓰는 단어를 앞에 두되,
  1인칭 문장만 보면 certain, duty처럼 딱딱한 낱말이 올라오고 flower, smile 같은 일상 낱말이 밀려나서 두 빈도를 함께 본다.
- 표제어와 괄호 속 파생어가 함께 뽑히면(tire, tired) 더 자주 쓰는 하나만 남긴다.
- 기분 낱말(FEELINGS)은 일기·감정 기록 앱의 중심이라 점수와 상관없이 넣고, 그만큼 점수가 가장 낮은 단어를 뺀다.
- 정치·경제 같은 뉴스 낱말(NEWS)은 뺀다.
- 기능어, 수, 요일·달 이름, 그리고 죽음·폭력·범죄·전쟁 낱말(DARK)은 뺀다(따뜻한 기록 앱의 첫 콘텐츠로 맞지 않음).
- 예문: Tatoeba 영어-한국어 문장 쌍(CC BY 2.0 FR) 중 그 단어(활용형 포함)가 든 짧은 문장.

실행: ../.venv/Scripts/python -I -X utf8 select_words.py  -> data/word_candidates.json
"""

import json
import re
import sys
from pathlib import Path

from wordfreq import zipf_frequency

sys.path.insert(0, str(Path(__file__).parent))
from analyze import DATA, TOKEN, inflections  # noqa: E402

PER_LEVEL = 300
SKIP = set(
    "a an the to of in on at for from by with as is are was were be been am do does did it its this that these those "
    "what how who whom whose why when where which i you he she we they me him her us them my your his our their mine yours "
    "hers ours theirs myself yourself himself herself itself ourselves themselves and or but nor not no yes yeah yep so if "
    "then than can could will would shall should may might must have has had there here oh hi hello bye ok okay mr mrs ms "
    "dr one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen "
    "nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion first second third "
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september "
    "october november december about above across after against along among around before behind below beneath beside "
    "between beyond down during except inside into near off onto out outside over past since through throughout till toward "
    "towards under until up upon within without also just very too each every some any all both either neither few many "
    "much more most less least other another such own same anyone anything anybody someone something somebody everyone "
    "everything everybody nobody nothing none because while although though however unless whether "
    # 학습 꾸러미에 어울리지 않거나 쓰임이 좁은 낱말
    "sex hell per self thus "
    # 다른 낱말의 활용형 때문에 빈도가 부풀려진 낱말(being→bee, United→unite, found는 find의 과거형)
    "bee unite found".split()
)
# 죽음·폭력·범죄·전쟁 낱말. 교과서에는 있지만 내 하루를 기록하는 앱의 첫 꾸러미로는 맞지 않아 뺀다.
DARK = set(
    "kill murder dead death die gun shoot war prison jail crime criminal drug attack enemy arrest steal blood bomb "
    "suicide weapon violent violence punish army military soldier battle victim terror terrorist murderer".split()
)
# 고급(고등학교 선택과목 어휘)에서만 더 빼는 낱말: 어둡거나 성적인 낱말, 속어로 오해받기 쉬운 낱말(suck, screw, weed, sack),
# 종교·정치 낱말, 영국식 철자가 겹치는 낱말(behaviour는 behavior와 같음).
ADVANCED_SKIP = set(
    "naked torture drown abuse addict cancer funeral curse devil sin revenge nuclear explode haunt suck screw sack weed "
    "grave starve bully seize religion worship priest holy democracy behaviour victim surgery horror monster rage "
    "republic surrender capture declare liberty impose occupy obey flesh defeat victory".split()
)
# 뉴스·행정 낱말. 내 하루를 기록하는 데는 거의 쓰지 않는다.
NEWS = set("government economy economic nation national political politics policy president tax industry election".split())
# 일기에 기분을 쓸 때 필요한 낱말(교육과정 목록의 표제어나 괄호 속 파생어 형태)
FEELINGS = set(
    "happy sad angry tire bore excite nervous worry scare afraid upset proud glad sorry surprise disappoint embarrass "
    "comfortable relax sick hungry busy calm confuse amaze annoy satisfy shy brave lonely".split()
)
FIRST_PERSON = re.compile(r"\b(I|I'm|I've|I'll|I'd|me|my|mine|myself|we|we're|we've|we'll|our|us)\b", re.IGNORECASE)


def tatoeba_frequency(first_person=False):
    """Tatoeba 영어 문장에서 낱말이 나온 문장 수. first_person이면 1인칭이 든 "나를 말하는 문장"에서만 센다."""
    from collections import Counter

    counts = Counter()
    with open(DATA / "eng_sentences.txt", encoding="utf-8") as file:
        for line in file:
            if first_person and not FIRST_PERSON.search(line):
                continue
            counts.update(set(TOKEN.findall(line.lower().replace("’", "'"))))
    return counts


def load_levels():
    text = (DATA / "curriculum_text.txt").read_text(encoding="utf-8")
    start = text.find("\n a*")
    end = text.find("II. 기본 어휘 관련 지침 개정 내용")
    levels = {}
    derived = {}
    for line in text[start:end].splitlines():
        match = re.match(r"^\s+([a-z][a-z'\-]*)(\**)\s*(?:\(([^)]*)\)?)?", line)
        if not match:
            continue
        level = len(match.group(2))
        levels.setdefault(match.group(1), level)
        for form in re.findall(r"[a-z][a-z'\-]*", match.group(3) or ""):
            derived.setdefault(form, (level, match.group(1)))
    # 목록에 표제어만 있고 형용사형이 괄호에 없는 기분 낱말(anger**만 있고 angry가 없음)은 직접 이어 준다.
    for form, head in EXTRA_FORMS.items():
        if head in levels:
            derived.setdefault(form, (levels[head], head))
    for form, (level, head) in derived.items():
        if form not in levels:
            levels[form] = level
            DERIVED[form] = head
    return levels


DERIVED = {}  # 괄호 속 파생어 -> 표제어
EXTRA_FORMS = {"angry": "anger"}


# 학습 앱 예문으로 쓰지 않을 낱말(욕설·성적 표현)과, 직접 읽고 뺀 문장
VULGAR = re.compile(r"\b(shit|cum|fuck\w*|damn|bitch|ass|sex\w*|crap|piss\w*|dick|nude|naked)\b", re.IGNORECASE)
# 사람이 읽어 보고 뺀 문장 id: 번역이 틀리거나(숫자·성별·시제 불일치, 오타), 뜻이 다른 쓰임이거나, 내용이 학습용으로 어둡거나 어색한 문장
REVIEWED_OUT = {
    41941, 1325836, 1639, 11987662, 3657862, 429922, 324425, 27534, 35538, 238433, 45738, 239172,
    13183361, 265377, 34340, 3031248, 462420, 461935, 11104544, 3168878,
    12385868, 238484, 8197128, 10090186, 10088168, 50211, 5880612, 12990769, 246326, 707395, 8533221,
    57052, 1972685, 282759, 7978196, 5752152, 3636466, 8503669, 260002, 11813691, 11813687, 13611629,
    8033384, 313421, 260996, 3226348, 308225, 5737083, 3992009, 1855197, 2314947,
    # 무작위 표본 60개 점검에서 걸린 문장(번역 빠짐·다른 쓰임·어색한 말)
    36515, 17253, 59382, 2642016, 308032, 23556,
}
# 활용형 규칙이 다른 낱말까지 잡는 경우(bite → bit, unit → United)는 쓸 형태를 직접 정한다.
WORD_FORMS = {"bite": {"bite", "bites", "biting", "bitten"}, "unit": {"unit", "units"}}
# 문장은 괜찮지만 그 단어의 예문으로는 다른 뜻인 경우(bit은 bite의 과거형이 아니라 "조금", United States의 unit)
WORD_SKIP = {"bite": {2833992}, "unit": {67497}, "deal": {1086155}}


def load_pairs():
    pairs = []
    for line in (DATA / "eng_kor_pairs.tsv").read_text(encoding="utf-8").splitlines():
        eng_id, english, kor_id, korean = line.split("\t")
        tokens = TOKEN.findall(english.lower().replace("’", "'"))
        if not 3 <= len(tokens) <= 11 or len(korean) > 40 or re.search(r"\d", english):
            continue
        if "@" in english or VULGAR.search(english) or int(eng_id) in REVIEWED_OUT:
            continue
        pairs.append({"id": int(eng_id), "en": english, "ko": korean, "tokens": set(tokens), "order": tokens, "length": len(tokens)})
    return pairs


# 예문 말투 점검(content_fit.py와 같은 기준)
SECOND_PERSON = re.compile(r"\b(you|you're|you've|you'll|your)\b", re.IGNORECASE)
NAMES = re.compile(
    r"\b(Tom|Mary|John|Jack|Ken|Bill|Jim|Kate|Mike|Bob|Ann|Lucy|Emily|Alice|Sami|Layla|Dan|Linda|Tony|Betty|Jane|"
    r"Fred|Meg|Nancy|Sam|Paul|Taro|Hanako|Mr|Mrs|Ms)\b"
)
DARK_TEXT = re.compile(
    r"\b(kill\w*|murder\w*|dead|death|die|died|dies|gun\w*|shoot\w*|shot|war|wars|prison\w*|jail|crime\w*|"
    r"criminal\w*|drug\w*|attack\w*|enem\w+|arrest\w*|steal\w*|stole\w*|blood\w*|bomb\w*|suicide|zombie\w*|"
    r"plague|thie\w+|wound\w*|fortress|addict\w*|haunted|punish\w*|violen\w*|weapon\w*)\b",
    re.IGNORECASE,
)
FORMAL = re.compile(
    r"\b(government|economy|economic|political|politic\w*|president|nation\w*|commerce|military|army|tax\w*|"
    r"parliament|election|policy|industr\w*)\b",
    re.IGNORECASE,
)
POLITE = re.compile(r"(요|니다|니까|세요|십시오|죠)[.?!…\s]*$")


# 단어 뒤에 이 낱말이 붙으면 구동사·관용구(put up with, set in)라 단어 본래 뜻과 달라지기 쉽다.
PARTICLES = {"up", "in", "out", "off", "down", "on", "over", "away", "back", "around", "into", "through", "along", "deal"}


def example_penalty(pair, forms):
    """낮을수록 좋은 예문. Daily English의 말투(내 하루를 내가 말하는 문장)에 가까운 문장을 먼저 고른다."""
    english = pair["en"]
    penalty = abs(pair["length"] - 7)  # 7낱말 안팎
    if not (FIRST_PERSON.search(english) or SECOND_PERSON.search(english)):
        penalty += 4  # 나나 너의 말이 아닌 남의 이야기는 뒤로
    if NAMES.search(english):
        penalty += 3  # Tom, Mary 같은 인물 이름이 없는 문장을 먼저
    if DARK_TEXT.search(english):
        penalty += 8  # 죽음·폭력·범죄 이야기는 거의 고르지 않음
    if FORMAL.search(english):
        penalty += 4  # 정치·경제 같은 뉴스 말투는 뒤로
    if POLITE.search(pair["ko"].strip()):
        penalty += 2  # 꾸러미의 우리말 해석은 친구에게 말하듯 반말로 맞춘다
    order = pair["order"]
    for index, token in enumerate(order):
        if token in forms and index + 1 < len(order) and order[index + 1] in PARTICLES:
            penalty += 6  # 구동사로 쓰인 문장은 뒤로
            break
    return penalty


def best_example(word, pairs):
    forms = WORD_FORMS.get(word) or inflections(word)
    skip = WORD_SKIP.get(word, set())
    found = [pair for pair in pairs if pair["tokens"] & forms and pair["id"] not in skip]
    if not found:
        return None
    found.sort(key=lambda pair: (example_penalty(pair, forms), pair["id"]))
    best = found[0]
    return {"en": best["en"], "ko": best["ko"], "id": best["id"], "matches": len(found)}


def main():
    levels = load_levels()
    pairs = load_pairs()
    frequency = tatoeba_frequency()
    first_person = tatoeba_frequency(first_person=True)
    print(f"기본 어휘 {len(levels):,}개(괄호 속 파생어 {len(DERIVED)}개 포함), 예문으로 쓸 만한 한영 문장 쌍 {len(pairs):,}개")

    def sentences(word, counts=frequency):
        return sum(counts.get(form, 0) for form in inflections(word))

    def score(word):
        return (sentences(word) * sentences(word, first_person)) ** 0.5

    def family(word):
        return DERIVED.get(word, word)

    draft = json.loads((Path(__file__).parent / "words_draft.json").read_text(encoding="utf-8"))
    extra_words = {row[0].lower() for key in ("talk_words", "business_words", "study_words") for row in draft.get(key, [])}
    result = []
    for mark, level in ((1, "beginner"), (2, "intermediate"), (0, "advanced")):
        skip = SKIP | DARK | NEWS | (extra_words | ADVANCED_SKIP if level == "advanced" else set())
        words = [word for word, value in levels.items() if value == mark and word not in skip and len(word) > 1]
        words.sort(key=score, reverse=True)
        picked, families = [], set()
        for word in words:
            if family(word) in families:
                continue  # tire와 tired 중 앞선(더 자주 쓰는) 하나만
            families.add(family(word))
            picked.append(word)
            if len(picked) == PER_LEVEL:
                break
        must = [word for word in words if word in FEELINGS and word not in picked and family(word) not in families]
        for word in must:
            drop = next(item for item in reversed(picked) if item not in FEELINGS)
            picked.remove(drop)
            picked.append(word)
            print(f"  기분 낱말 '{word}'를 넣고 '{drop}'를 뺌")
        picked.sort(key=score, reverse=True)
        for word in picked:
            result.append(
                {
                    "word": word,
                    "level": level,
                    "sentences": sentences(word),
                    "first_person": sentences(word, first_person),
                    "zipf": zipf_frequency(word, "en"),
                    "example": best_example(word, pairs),
                }
            )
        print(f"{level}: 후보 {len(words)}개 중 {len(picked)}개, 마지막 단어 '{picked[-1]}' ({sentences(picked[-1]):,}문장)")
    missing = [item["word"] for item in result if not item["example"]]
    print(f"한영 예문이 없는 단어 {len(missing)}개: {missing}")
    (DATA / "word_candidates.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    old_path = DATA / "word_candidates_v1.json"
    if old_path.exists():
        old = {item["word"] for item in json.loads(old_path.read_text(encoding="utf-8"))}
        new = {item["word"] for item in result}
        print(f"처음 목록(전체 문장 빈도)과 비교: 그대로 {len(old & new)}개, 새로 들어옴 {len(new - old)}개, 빠짐 {len(old - new)}개")
        print("들어옴:", " ".join(item["word"] for item in result if item["word"] not in old))
        print("빠짐:", " ".join(sorted(old - new)))


if __name__ == "__main__":
    main()
