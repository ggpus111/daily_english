"""모은 리뷰에서 주제별 언급률과 별점의 관계를 계산한다.

방법
- 주제마다 한국어/영어 키워드 정규식을 정하고, 제목+본문에 있으면 그 주제를 언급한 리뷰로 센다.
- 낮은 별점(1~2점)과 높은 별점(4~5점)에서 각 주제의 언급률을 비교한다.
  낮은 별점에서 훨씬 자주 나오면 불만 요인, 높은 별점에서 자주 나오면 만족 요인으로 본다.
- 키워드 방식은 반어법이나 문맥을 놓칠 수 있어서, 주제마다 표본을 직접 읽어 확인한다(--samples).

실행: .venv/Scripts/python analyze.py [--samples]
"""

import json
import sys
from pathlib import Path

import pandas as pd

DATA = Path(__file__).parent / "data"
OUTPUT = Path(__file__).parent / "output"

# 표본을 읽어 고친 기록(정확도 점검)
# - bugs: '안 돼/안 되'가 "기초가 안돼있는데" 같은 평범한 문장까지 잡아서 뺐다.
# - ai: '고쳐'가 "버그 좀 고쳐 주세요"를 잡아서 뺐다.
# - notifications: '알림장'(학교 알림장)을 제외했다.
# - motivation: 'fun'이 "function"을 잡아서 단어 경계를 넣었다.
# - people: '차단'이 계정 제재 이야기까지 잡아서 사람 문제를 가리키는 표현만 남겼다.
THEMES = {
    "price": ("가격·구독", r"가격|구독|유료|결제|비싸|비쌈|환불|프리미엄|요금|슈퍼|\bsuper\b|\bmax\b|subscription|price|paywall"),
    "ads": ("광고", r"광고|\bads?\b|advert"),
    "limits": ("하트·횟수 제한", r"하트|에너지|횟수\s*제한|제한(?:이|을|돼|되)|\blimit"),
    "motivation": ("재미·꾸준함", r"재미|재밌|꾸준|습관|매일|스트릭|연속\s*학습|동기부여|streak|\bfun\b|habit"),
    "notifications": ("알림", r"알림(?!장)|푸시|알람|notification"),
    "bugs": ("오류·버그", r"오류|버그|튕|먹통|에러|꺼지|꺼져|멈춰|멈추|정지돼|렉(?:이|걸|때|\b)|작동\s*안|실행\s*안|접속\s*안|로그인(?:이)?\s*안|crash|\bbug|error|freez"),
    "sync": ("동기화·백업·데이터 유실", r"동기화|백업|날아|사라졌|사라져|복구|유실|초기화|\bsync|backup|\blost\b"),
    "review": ("복습·암기", r"복습|암기|외우|외워|외울|반복|기억|망각|spaced|repetition|\breview"),
    "real_talk": ("실제 대화·실용성", r"실생활|실제\s*대화|실전|회화|원어민|현지인|실용|\bnative|conversation|real\s*life"),
    "ai": ("AI·피드백·교정", r"\bai\b|인공지능|피드백|교정|첨삭|chatgpt|\bgpt|feedback|correction"),
    "design": ("디자인·사용 편의", r"디자인|귀엽|귀여|예쁘|이쁘|감성|깔끔|편하|편리|직관|인터페이스|\bui\b|design|cute|clean|easy to use"),
    "custom": ("나만의 단어장·직접 입력", r"단어장|나만의|직접\s*(?:추가|입력|만들)|내가\s*만든|custom|my own"),
    "people": ("사람·안전 문제", r"이상한\s*사람|성희롱|변태|작업\s*걸|데이팅|연애\s*목적|사기\s*(?:채팅|꾼|계정)|스캠|scam|creep|dating|harass"),
    "journaling": ("일기·감정 기록", r"일기|다이어리|기록|감정|기분|하루를|journal|diary|mood"),
}

LOW, HIGH = (1, 2), (4, 5)


def load():
    meta = json.loads((DATA / "apps.json").read_text(encoding="utf-8"))
    reviews = pd.read_json(DATA / "reviews.jsonl", lines=True)
    reviews["text"] = (reviews["title"].fillna("") + " " + reviews["content"].fillna("")).str.lower()
    reviews["updated"] = pd.to_datetime(reviews["updated"], utc=True)
    reviews["band"] = pd.cut(reviews["rating"], [0, 2, 3, 5], labels=["low", "mid", "high"])
    for key, (_, pattern) in THEMES.items():
        reviews[key] = reviews["text"].str.contains(pattern, case=False, regex=True)
    return meta, reviews


def diff_ci(p_low, n_low, p_high, n_high, z=1.96):
    """두 비율 차이(낮은 별점 - 높은 별점)의 95% 신뢰구간. 정규 근사."""
    if not n_low or not n_high:
        return None, None
    se = ((p_low * (1 - p_low)) / n_low + (p_high * (1 - p_high)) / n_high) ** 0.5
    diff = p_low - p_high
    return round((diff - z * se) * 100, 1), round((diff + z * se) * 100, 1)


def theme_table(frame):
    rows = []
    low = frame[frame["rating"].isin(LOW)]
    high = frame[frame["rating"].isin(HIGH)]
    for key, (name, _) in THEMES.items():
        mentioned = frame[frame[key]]
        low_share = low[key].mean() if len(low) else float("nan")
        high_share = high[key].mean() if len(high) else float("nan")
        ci_low, ci_high = diff_ci(low_share, len(low), high_share, len(high))
        rows.append(
            {
                "theme": key,
                "name": name,
                "mentions": int(frame[key].sum()),
                "share": round(frame[key].mean() * 100, 1),
                "low_share": round(low_share * 100, 1),
                "high_share": round(high_share * 100, 1),
                # 낮은 별점에서 몇 배 더 자주 나오는가. 1보다 크면 불만 쪽 주제다.
                "low_high_ratio": round(low_share / high_share, 2) if high_share else None,
                # 차이(%p)의 95% 신뢰구간이 0을 포함하지 않으면 우연으로 보기 어렵다.
                "diff_ci_low": ci_low,
                "diff_ci_high": ci_high,
                "significant": bool(ci_low is not None and (ci_low > 0 or ci_high < 0)),
                "avg_rating_when_mentioned": round(mentioned["rating"].mean(), 2) if len(mentioned) else None,
            }
        )
    return pd.DataFrame(rows).sort_values("share", ascending=False)


def app_table(meta, reviews):
    info = pd.DataFrame(meta["apps"])[["app_id", "short", "group", "rating", "rating_count", "price"]]
    recent = reviews.groupby("app_id").agg(
        reviews=("rating", "size"),
        recent_avg=("rating", "mean"),
        low_pct=("rating", lambda r: r.isin(LOW).mean() * 100),
        first=("updated", "min"),
        last=("updated", "max"),
    )
    table = info.join(recent, on="app_id")
    table["recent_avg"] = table["recent_avg"].round(2)
    table["low_pct"] = table["low_pct"].round(1)
    table["first"] = table["first"].dt.date.astype(str)
    table["last"] = table["last"].dt.date.astype(str)
    return table


def app_theme_matrix(reviews):
    keys = list(THEMES)
    matrix = reviews.groupby("short")[keys].mean().mul(100).round(1)
    low = reviews[reviews["rating"].isin(LOW)].groupby("short")[keys].mean().mul(100).round(1)
    return matrix, low


def clean(value):
    """JSON에는 NaN이 없으므로, 계산할 수 없던 값(0으로 나누기 등)은 null로 바꾼다."""
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [clean(item) for item in value]
    if isinstance(value, float) and value != value:
        return None
    return value


def print_samples(reviews, per_theme=4):
    for key, (name, _) in THEMES.items():
        hits = reviews[reviews[key]]
        print(f"\n## {name} ({len(hits)})")
        for _, row in hits.sample(min(per_theme, len(hits)), random_state=7).iterrows():
            print(f"- [{row['short']} {row['rating']}점] {row['text'][:110]}")


def main():
    meta, reviews = load()
    if "--samples" in sys.argv:
        print_samples(reviews)
        return

    OUTPUT.mkdir(exist_ok=True)
    apps = app_table(meta, reviews)
    overall = theme_table(reviews)
    by_group = {group: theme_table(frame) for group, frame in reviews.groupby("group")}
    matrix, low_matrix = app_theme_matrix(reviews)
    distribution = reviews["rating"].value_counts().sort_index()

    apps.to_csv(OUTPUT / "apps.csv", index=False, encoding="utf-8-sig")
    overall.to_csv(OUTPUT / "themes_overall.csv", index=False, encoding="utf-8-sig")
    matrix.to_csv(OUTPUT / "themes_by_app.csv", encoding="utf-8-sig")
    low_matrix.to_csv(OUTPUT / "themes_by_app_low_ratings.csv", encoding="utf-8-sig")

    summary = {
        "collected_on": meta["collected_on"],
        "country": meta["country"],
        "total_reviews": int(len(reviews)),
        "rating_distribution": {int(k): int(v) for k, v in distribution.items()},
        "low_reviews": int(reviews["rating"].isin(LOW).sum()),
        "high_reviews": int(reviews["rating"].isin(HIGH).sum()),
        "apps": apps.to_dict(orient="records"),
        "themes_overall": overall.to_dict(orient="records"),
        "themes_by_group": {g: t.to_dict(orient="records") for g, t in by_group.items()},
        "themes_by_app": matrix.reset_index().to_dict(orient="records"),
        "themes_by_app_low": low_matrix.reset_index().to_dict(orient="records"),
    }
    (OUTPUT / "summary.json").write_text(
        json.dumps(clean(summary), ensure_ascii=False, indent=2, default=str, allow_nan=False),
        encoding="utf-8",
    )

    pd.set_option("display.width", 200)
    pd.set_option("display.max_columns", 20)
    print(apps.drop(columns=["app_id"]).to_string(index=False))
    print("\nrating distribution:", summary["rating_distribution"])
    print("\n[overall]")
    print(overall.drop(columns=["theme"]).to_string(index=False))
    for group, table in by_group.items():
        print(f"\n[{group}]")
        print(table[["name", "share", "low_share", "high_share", "low_high_ratio"]].head(8).to_string(index=False))
    print("\n[by app, % of reviews]")
    print(matrix.to_string())


if __name__ == "__main__":
    main()
