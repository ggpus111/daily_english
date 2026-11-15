# 교과서 영어 vs 원어민 영어: 표현 꾸러미를 데이터로 고르기

앱을 처음 연 사람도 바로 쓸 거리가 있도록 "표현 꾸러미" 400개와 "단어 꾸러미" 600개를 넣었습니다. 무엇을 넣을지 감으로 정하지 않고, 공개 데이터로 원어민이 실제로 자주 쓰는 표현과 우리가 학교에서 배우는 영어를 비교해 골랐습니다. 넣은 콘텐츠가 앱 성격(내 하루를 기록하는 따뜻한 앱)에 맞는지 점검하고 고친 과정은 [../REPORT.md](../REPORT.md) 4장에 있습니다.

## 질문

1. 원어민이 자주 쓰는 여러 단어 표현(관용구, 구동사, 구어 표현)은 어려운 단어로 되어 있을까, 쉬운 단어로 되어 있을까?
2. 교과서에서 배우는 표현과 원어민이 쓰는 대안 표현은 얼마나 다르게 쓰일까?
3. 그렇다면 앱에는 어떤 표현을 먼저 넣어야 할까?

## 데이터와 라이선스

상업 앱(유료 Pro 계획 포함)에 쓸 수 있는 데이터만 골랐습니다. 원본 데이터는 저장소에 올리지 않고(`data/`는 git 제외), 앱에는 직접 쓴 문장, 빈도 숫자, 문장 번호로 출처를 밝힌 Tatoeba 한영 예문만 넣었습니다.

| 데이터 | 쓰임 | 규모 | 라이선스 | 판단 |
| --- | --- | --- | --- | --- |
| [Tatoeba](https://tatoeba.org) 영어 문장 | 표현·단어가 실제 문장에 쓰인 횟수 | 2,040,567문장 | CC BY 2.0 FR (출처 표시, 상업 이용 가능) | 사용 |
| Tatoeba 영어-한국어 문장 쌍 | 단어 꾸러미 예문 | 11,572쌍 | CC BY 2.0 FR | 문장 번호와 함께 사용 |
| [위키낱말사전](https://en.wiktionary.org) 분류 표제어 | 후보 표현 목록 (idioms, phrasal verbs, informal terms, colloquialisms) | 37,422개 (중복 포함) | CC BY-SA 4.0 | 표제어 이름만 사용 |
| 2022 개정 영어과 교육과정 기본 어휘 | "우리가 배우는 영어"의 기준, 단어 꾸러미 후보 | 3,000개 + 괄호 속 파생어 218개 | 교육부 고시 별표, 저작권법 제7조 2호로 보호 대상 아님 | 사용 |
| [wordfreq](https://github.com/rspeer/wordfreq) 3.1 | 구어 낱말 빈도 비교 (yes/yeah 등) | 영어 전체 | 데이터 CC BY-SA 4.0 (SUBTLEX, OpenSubtitles 등 포함) | 분석에만 사용, 앱에 넣지 않음 |
| DailyDialog | 일상 대화 말뭉치 | | CC BY-NC-SA 4.0 (비상업) | 제외 |
| OpenSubtitles 원문 | 영화 자막 | | 자막 저작권 불명확 | 제외 |
| Santa Barbara 구어 말뭉치 | 실제 대화 녹취 | 6.1GB | CC BY-ND 3.0 (변경 금지) | 제외 |

## 방법

`collect.py` → `analyze.py` → `build_packs.py` 순서로 Python(pandas)으로 처리했습니다.

1. **후보 만들기**: 위키낱말사전 4개 분류에서 2~5단어 표현만 남겼습니다. 고유명사, 기호가 든 표제어, someone·something 같은 자리 표시 낱말이 든 표현은 뺐습니다. → **16,973개**
2. **빈도 세기**: Tatoeba 영어 문장 204만 개를 낱말 단위로 나눠, 각 표현이 쓰인 문장 수를 셌습니다. 첫 낱말은 활용형도 함께 셉니다(hang out, hung out, hanging out). → 한 번 이상 나온 표현 **8,355개**
3. **교과서 낱말 기준**: 표현의 모든 낱말이 기본 어휘 3,000개(활용형 포함)에 드는지 표시했습니다. → **6,950개**
4. **우연한 조합 거르기**: "go to", "of a"처럼 흔한 낱말이 우연히 붙은 조합을 빼려고 PMI(낱말 각각의 빈도로 기대되는 것보다 함께 나오는 정도, log2)가 3 이상이고 20문장 이상 쓰인 표현만 남겼습니다. 붙임표 낱말(has-been)과 기능어끼리만 된 조합도 뺐습니다. → 후보 **736개**
5. **표본 점검**: 표현 15개를 골라 쓰인 문장 4개씩, 60문장을 직접 읽었습니다. **55문장(92%)**이 표현의 뜻으로 쓰였고, 나머지는 문자 그대로의 뜻이었습니다(piece of cake → 케이크 한 조각, sort of → 종류).
6. **최종 선정**: 후보 736개와 교과서 비교 표현에서, 대화에서 쓸 수 있고, 단어만 보고는 뜻을 짐작하기 어렵고, 욕설·비하가 없는 표현을 사람이 골랐습니다. 처음 200개(5개 주제)를 만든 뒤, 같은 후보에서 200개를 더 골라 하루 일과·밖에서·말 잇기·구동사·관용 표현 더 보기 5개 주제를 더했습니다(piss off, son of a bitch처럼 거친 말, atomic bomb처럼 어두운 말은 뺌). 뜻, 예문, 해석, 팁은 직접 썼습니다. 고른 표현도 말뭉치에서 다시 세어, 5문장 미만으로 쓰인 표현(no pain, no gain: 4문장)은 다른 표현으로 바꿨습니다.
7. **앱 말투로 다듬기**: 예문 중 He, She, They가 주어인 남의 이야기 31개를 내 이야기로 바꿨습니다("They broke up last month." → "I broke up with my boyfriend last month.").

## 결과

### 1. 원어민이 많이 쓰는 표현은 대부분 "쉬운 단어"로 되어 있다

| 지표 | 값 |
| --- | ---: |
| 많이 쓰인 상위 500개 표현 중 기본 어휘 3,000개로만 된 비율 | **96.6%** |
| 말뭉치에 나온 표현 8,355개 중 기본 어휘로만 된 표현 | 6,950개 (83.2%) |
| 최종 400개 중 기본 어휘로만 된 표현 | 395개 |

hang out, figure out, end up, make sense, pick up처럼 **단어는 다 아는데 합쳐지면 뜻이 달라지는 표현**이 원어민 영어의 큰 부분입니다. 학습자에게 어려운 것은 낯선 단어가 아니라 쉬운 단어의 조합입니다. 그래서 꾸러미는 어려운 단어보다 이런 조합에 집중했습니다.

### 2. 교과서 표현과 원어민 대안 (Tatoeba에서 쓰인 문장 수)

| 상황 | 교과서 표현 | 문장 수 | 원어민이 자주 쓰는 대안 | 문장 수 |
| --- | --- | ---: | --- | ---: |
| 안부에 답하기 | I'm fine, thank you | 4 | pretty good / I'm good / not bad | 852 / 108 / 95 |
| 헤어질 때 | goodbye | 655 | see you / take care | 2,348 / 1,923 |
| 모를 때 | I don't know | 5,950 | not sure / no idea | 1,778 / 1,763 |
| 감사 | thank you very much | 155 | thanks a lot | 50 |
| 안부 묻기 | how are you | 453 | what's up / how's it going | 109 / 39 |

"I'm fine, thank you"는 4문장뿐이었고, goodbye보다 see you, take care가 3배 이상 많았습니다. 반면 how are you와 thank you very much는 교과서 표현이 더 많았습니다. Tatoeba는 학습자와 번역자가 올린 문장이라 교과서 쪽으로 기울어 있을 수 있어서, 구어 비중이 큰 wordfreq로도 비교했습니다.

| 교과서 낱말 | Zipf | 구어 낱말 | Zipf |
| --- | ---: | --- | ---: |
| yes | 5.50 | yeah | 5.37 |
| okay | 5.06 | ok | 5.14 |
| want | 6.04 | wanna | 5.04 |

Zipf는 10억 낱말당 빈도의 로그(높을수록 흔함)입니다. yeah는 yes와 거의 같은 수준으로 쓰였습니다. 교과서에서 잘 다루지 않는 구어 낱말도 실제로는 매우 흔합니다.

### 3. 앱에 넣은 결과

| 꾸러미 | 개수 | 예 |
| --- | ---: | --- |
| 일상 대화 | 40 | How's it going?, pretty good, hang out, Sounds good. |
| 하루 일과 | 40 | fall asleep, doze off, take out the trash, Sweet dreams. |
| 밖에서 | 40 | go straight, around the corner, pull over, rain or shine |
| 감정·관계 | 40 | get along, hit it off, cheer up, stressed out |
| 약속·계획 | 40 | look forward to, call it a day, show up, Take your time. |
| 말 잇기 | 40 | as well, sort of, the other day, when it comes to |
| 문제 해결 | 40 | figure out, end up, My bad., get the hang of |
| 자주 쓰는 구동사 | 40 | look at, run into, come across, get away with |
| 재미있는 관용 표현 | 40 | piece of cake, under the weather, ring a bell, play it by ear |
| 관용 표현 더 보기 | 40 | cross the line, take for granted, comfort zone, sweet tooth |

- 표현마다 말뭉치에서 쓰인 문장 수를 함께 보여 주고, 100만 문장당 300번 이상은 "아주 자주", 30번 이상은 "자주", 그 밖은 "가끔 써요"로 표시합니다.
- 400개가 쓰인 문장 수의 중앙값은 93문장, 가장 적은 표현은 take a rain check(9문장)입니다. 새로 더한 200개는 모두 20문장 이상입니다.
- 홈에는 날마다 바뀌는 "오늘의 표현"을 두어, 기록이 하나도 없는 첫날에도 바로 담을 거리가 있게 했습니다.

## 단어 꾸러미 600개

`select_words.py` → `build_words.py`로 만들었습니다.

1. **후보**: 교육과정 기본 어휘에서 초등 권장(*)은 초급, 공통 권장(**)은 중급 후보로 나눴습니다. 목록의 괄호 속 파생어(`hunger** (hungry)`, `comfort** (comfortable)`, `nerve** (nervous)`처럼 표제어 옆 괄호에 적힌 낱말)도 같은 단계 후보로 넣었습니다. 처음 코드는 이 괄호를 읽지 않아 hungry, nervous, comfortable이 후보에도 없었습니다. 표제어 anger만 있고 형용사가 없는 angry는 직접 이어 줬습니다.
2. **뺀 것**: 기능어, 숫자, 요일·달, 다른 낱말의 활용형 때문에 빈도가 부풀려진 낱말(being → bee, United → unite, find의 과거형 found), 죽음·폭력·범죄·전쟁 낱말 32개, 정치·경제 뉴스 낱말 12개. → 초급 후보 725개, 중급 후보 1,220개
3. **순서**: Tatoeba 전체 문장에 나온 횟수와 "나를 말하는 문장"(I, my, we 같은 1인칭이 든 문장)에 나온 횟수의 기하평균이 높은 순으로 단계마다 300개. 1인칭 빈도만 쓰면 certain, duty 같은 딱딱한 낱말이 올라오고, 전체 빈도만 쓰면 남의 이야기·뉴스에 자주 나오는 낱말이 올라와서 둘을 함께 봤습니다. 표제어와 파생어가 함께 뽑히면(tire, tired) 하나만 남겼습니다.
4. **기분 낱말**: 일기에 쓰는 기분 낱말(sad, shy, brave, comfortable 등)은 300위 밖이어도 넣고, 점수가 가장 낮은 단어를 뺐습니다.
5. **예문 후보**: Tatoeba 한영 쌍 11,572개 중 3~11낱말, 해석 40자 이하, 숫자·@·욕설이 없는 9,714쌍에서, 그 단어(활용형 포함)가 든 문장을 벌점이 낮은 순으로 골랐습니다. 벌점: 7낱말에서 멀어질수록 +1, 나나 너의 말이 아니면 +4, 인물 이름 +3, 어두운 내용 +8, 뉴스 말투 +4, 존댓말 해석 +2, 구동사로 쓰인 문장 +6.
6. **사람이 읽고 고치기**: 예문 600개를 모두 읽었습니다. 번역이 틀리거나(숫자·성별·시제), 다른 뜻으로 쓰였거나(staring을 star로, salad dressing을 dress로, United States를 state로), 어둡거나 앱 말투에 맞지 않는 문장 57개는 후보에서 뺐고, 143개 단어는 예문을 직접 썼습니다(12개는 한영 예문이 아예 없었음).
7. **뜻**: 600개 모두 직접 썼습니다(`words_draft.json`). 감정 동사는 실제로 많이 쓰는 형용사형으로 보여 줍니다(tire → tired, bore → bored).

| 지표 | 값 |
| --- | ---: |
| 초급·중급 | 300개·300개 |
| 처음 목록(전체 빈도만)과 같은 단어 | 548개 (52개 바뀜) |
| 예문: Tatoeba 한영 문장 / 직접 씀 | 457개 / 143개 |
| 무작위 60개 점검: 뜻·번역이 틀린 문장 | 0개 (느슨한 번역 2개) |
| 기분 낱말 35개 중 들어 있는 것 | 32개 (lonely, jealous, grateful은 기본 어휘에 없음) |

앱에서는 단계(초급·중급)와 50개 범위를 골라 보고, Tatoeba 예문에는 문장 번호 링크(예: Tatoeba #1288)를 달아 출처를 밝힙니다. 담은 단어는 단어장으로 들어가 복습합니다. 꾸러미 데이터는 첫 화면 코드와 따로 불러와 앱 시작을 느리게 하지 않습니다.

## 한계

- **말뭉치의 치우침**: Tatoeba는 사람들이 올린 예문이라 실제 대화보다 교과서식 문장이 많을 수 있습니다. 상업 이용이 가능한 실제 대화 말뭉치를 찾지 못해 이 한계를 안고 갔고, wordfreq로 일부 보완했습니다.
- **문자 그대로의 뜻**: 키워드로 세서 piece of cake(케이크 한 조각)처럼 문자 그대로 쓰인 문장도 함께 세집니다. 표본 점검에서 8%가 그랬습니다.
- **빠진 표현**: someone·something이 들어간 표현(pull someone's leg 등)과 떨어져 쓰이는 구동사(pick it up)는 정확히 세지 못해 후보에서 뺐습니다.
- **기본 어휘 파싱**: PDF에서 3,000개 중 2,985개를 읽었고, 활용형 판정은 규칙 기반이라 일부가 틀릴 수 있습니다(I'm, yourself가 기본 어휘가 아닌 것으로 판정됨).
- **최종 선정은 사람의 판단**: 736개에서 400개를 고르고, 단어 예문 143개를 직접 쓴 단계는 기준을 정해 두고 직접 했습니다. 영어 원어민의 검토를 거치면 더 믿을 만합니다.
- **말투 점검은 정규식**: 1인칭·존댓말·어두운 낱말은 정규식으로 셉니다. 주어 없는 명령문("Hurry up!")은 상대에게 하는 말인데도 1인칭으로 세지 않습니다.

## 다시 실행하기

```bash
cd analysis/native
../.venv/Scripts/python -m pip install pandas wordfreq pypdf
../.venv/Scripts/python -I collect.py
../.venv/Scripts/python -I -X utf8 analyze.py --samples
../.venv/Scripts/python -I -X utf8 build_packs.py
../.venv/Scripts/python -I -X utf8 select_words.py
../.venv/Scripts/python -I -X utf8 build_words.py
../.venv/Scripts/python -I -X utf8 make_before.py
../.venv/Scripts/python -I -X utf8 content_fit.py before output/before_words.json output/before_packs.json
../.venv/Scripts/python -I -X utf8 content_fit.py after
```

- `collect.py`: Tatoeba 영어 문장(약 25MB), 위키낱말사전 분류 표제어, 교육과정 PDF(약 3MB)를 `data/`에 받습니다. 위키미디어 서버가 요청을 제한하면 기다렸다 다시 묻습니다.
- `analyze.py`: `output/`에 순위표(`expressions_ranked.csv`), 후보(`shortlist.csv`), 교과서 비교(`textbook_vs_natural.csv`), 표본(`samples.md`), 요약(`summary.json`)을 만듭니다.
- `build_packs.py`: 직접 쓴 원고(`packs_draft.json`)에 빈도를 붙여 앱 데이터 `src/data/packs.json`을 만듭니다.
- `select_words.py`: 단어 600개와 예문 후보를 `data/word_candidates.json`에 만듭니다. 처음 목록(`data/word_candidates_v1.json`)이 있으면 바뀐 단어를 보여 줍니다.
- `build_words.py`: 뜻 원고(`words_draft.json`)와 합쳐 앱 데이터 `src/data/words.json`을 만듭니다.
- `content_fit.py`: 단어·표현 예문이 앱 성격에 맞는지(1인칭, 인물 이름, 어두운 내용, 존댓말, 기분 낱말) 세어 `output/content_fit_*.json`에 둡니다. `make_before.py`는 비교용 처음 버전을 만듭니다.

## 출처 표시

- 문장 빈도와 단어 예문: Tatoeba (https://tatoeba.org), CC BY 2.0 FR. 앱에서 예문마다 문장 번호로 원문에 연결합니다.
- 후보 표현 목록: Wiktionary, CC BY-SA 4.0
- 낱말 빈도: wordfreq (Robyn Speer), 데이터 CC BY-SA 4.0. SUBTLEX(Brysbaert & New) 등의 자료를 포함합니다.
- 기본 어휘: 교육부 고시 제2022-33호 [별책 14] 영어과 교육과정 [별표 3]
