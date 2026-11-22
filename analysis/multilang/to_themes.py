"""단어 원고를 초급/중급에서 "대화 주제"로 바꾼다(2026-11-22 결정).

이유: 외국인 연인·친구가 있는 사람은 나, 너, 물, 집 같은 기초 낱말을 이미 안다. 앱 성격에 맞게 연인·친구와의 대화에서 쓰는 말만 남긴다.
- 기초 낱말(wordfreq zipf 5.3 이상, analyze_words.py와 같은 기준)은 뺀다.
- 초급 칸에 있던 낱말은 연애·마음·관계·말·여행 주제에 속할 때만 남긴다(음식, 집, 몸 같은 기초 명사는 뺀다).
- 주제는 낱말의 우리말 뜻에서 키워드로 정한다. 맞지 않는 곳은 원고에서 직접 고친다(원고 첫 칸이 주제 id).

실행: ../.venv/Scripts/python -I -X utf8 to_themes.py ja zh es fr   (이미 주제로 바뀐 원고는 건너뜀)
"""

import sys
from pathlib import Path

from wordfreq import zipf_frequency

HERE = Path(__file__).parent
DRAFTS = HERE / "drafts"
BASIC_ZIPF = 5.3

# (주제 id, 우리말 뜻 키워드). 위에서부터 먼저 맞는 주제로 간다.
THEMES = [
    ("love", "사랑 연인 연애 고백 짝사랑 데이트 키스 뽀뽀 안다 안아 손을 잡 손잡 반지 약혼 결혼 신혼 기념일 사귀 헤어지 질투 바람 설레 자기 애정 로맨틱 달콤 서프라이즈 평생 운명 인연 기적 애교 어리광 응석 장거리 남자친구 여자친구 좋아하 보고 싶 곁에 소중 친밀 다정 속삭 눈빛 포옹"),
    ("bond", "위로 격려 응원 지지 감사 사과 용서 화해 다투 싸우 싸움 오해 신뢰 믿 의심 솔직 정직 참다 배려 돌보 돕다 부탁 거절 초대 인내 책임 보호 희망 의지 서로 단둘 공동 친구 절친 가족 이웃 동료 친척 형제 부모"),
    ("feel", "기쁘 기뻐 슬프 외롭 쓸쓸 무섭 부끄 분하 짜증 긴장 안심 놀라 화내 화나 행복 감동 후회 불안 흥분 걱정 그립 지루 귀찮 편안 편하 설렘 부럽 졸리 피곤 고민 망설 곤란 당황 허둥 침착 진정 기분 마음 감정 눈물 울 웃 미소 표정 무섭 외롭 아쉽 만족 실망 자랑 낯설 익숙 조급"),
    ("talk", "대화 통역 번역 발음 문장 단어 문법 존댓말 반말 사투리 농담 비밀 거짓말 소문 인사 연락 알림 읽음 메시지 답장 소식 의견 상담 확인 설명 말하 이야기 목소리 질문 대답 속마음 겉 진지 태도 예의 억양 화면 동영상 방송 검색 등록"),
    ("trip", "여행 공항 비행기 여권 표 환승 시차 예약 취소 변경 지각 기념품 관광 온천 축제 불꽃 호텔 짐 교통 사고 지도 주소 장소 약속 계획 준비 예정 목표 기회 유학 이사 해변 크리스마스 설날 추석 명절 휴가"),
    ("food", "맛 달다 맵다 짜다 쓰다 달콤 음식 요리 밥 커피 술 과일 채소 감기 열 약 다치 부상 운동 체중 다이어트 수면 피로 스트레스 휴식 배 목 등 머리카락 병원 건강 상처 아프"),
]
TITLES = {
    "love": ("연애·애정", "Love & romance"),
    "bond": ("관계·위로·부탁", "People & support"),
    "feel": ("기분·마음", "Feelings"),
    "talk": ("말·연락", "Talking & messages"),
    "trip": ("여행·약속", "Trips & plans"),
    "food": ("음식·건강", "Food & health"),
    "life": ("생활·그 밖의 말", "Daily life & more"),
}
KEEP_FROM_BASIC = {"love", "bond", "feel", "talk", "trip"}


def theme_of(meaning):
    for theme, keywords in THEMES:
        if any(keyword in meaning for keyword in keywords.split()):
            return theme
    return "life"


def convert(lang):
    path = DRAFTS / f"{lang}_words.tsv"
    lines = path.read_text(encoding="utf-8").splitlines()
    if any(line.startswith("love\t") for line in lines):
        print(lang, "이미 주제로 바뀜")
        return
    out = ["# {} 단어 원고(대화 주제별). 첫 칸이 주제 id: {}. 기초 낱말(zipf {} 이상)은 뺐다. to_themes.py로 바꾼 뒤 직접 고쳐도 된다.".format(
        lang, " ".join(TITLES), BASIC_ZIPF), "# 주제\t단어\t뜻\t[예문]\t[예문 해석]"]
    kept = dropped = 0
    for line in lines:
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split("\t") + [""] * 5
        level, word, meaning, example, example_tr = parts[:5]
        head = word.split(" (")[0]
        theme = theme_of(meaning)
        basic = zipf_frequency(head, lang) >= BASIC_ZIPF
        if basic or (level == "beginner" and theme not in KEEP_FROM_BASIC):
            dropped += 1
            continue
        kept += 1
        out.append("\t".join([theme, word, meaning, example, example_tr]).rstrip("\t"))
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    counts = {}
    for row in out[2:]:
        counts[row.split("\t")[0]] = counts.get(row.split("\t")[0], 0) + 1
    print(lang, f"남김 {kept}, 뺌 {dropped}", counts)


if __name__ == "__main__":
    for lang in sys.argv[1:]:
        convert(lang)
