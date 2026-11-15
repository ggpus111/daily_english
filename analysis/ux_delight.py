"""화면·재미 요소에 대한 반응을 따로 본다.

질문: 앱이 '단조롭다'는 느낌을 줄이려면 어떤 화면 요소가 사용자 만족과 같이 나오는가?

방법
- analyze.py와 같은 리뷰(5,142개)를 쓴다.
- 화면·재미 요소를 세부 주제로 나눠 키워드로 표시한다.
- 높은 별점(4~5)과 낮은 별점(1~2)의 언급률 차이와 95% 신뢰구간을 구한다.
- 앱별 언급률로 어떤 앱이 그 요소로 칭찬받는지 본다.
- --samples 를 주면 주제마다 높은 별점 리뷰 표본을 출력해 직접 읽어 확인한다.

실행: .venv/Scripts/python ux_delight.py [--samples]
"""

import json
import sys
from pathlib import Path

import pandas as pd

from analyze import HIGH, LOW, diff_ci, load

OUTPUT = Path(__file__).parent / "output"

# 표본을 읽어 고친 기록
# - character: '캐릭터'만 쓰면 게임 이야기도 잡혀서 앱 마스코트 이름을 함께 넣었다.
# - reward: '포인트'가 결제 포인트를 잡는 경우가 있어 '보상·칭찬·뱃지' 중심으로 좁혔다.
UX = {
    "character": ("캐릭터·마스코트", r"캐릭터|마스코트|부엉이|듀오(?!링고)|올빼미|고양이|냥|mascot|character|\bowl\b"),
    "cute": ("귀여움·감성", r"귀엽|귀여|깜찍|아기자기|감성|힐링|cute|adorable"),
    "reward": ("보상·칭찬·뱃지", r"보상|칭찬|뱃지|배지|트로피|메달|레벨\s*업|도장|스탬프|reward|badge|trophy|achievement"),
    "progress": ("진행 보이기·통계", r"그래프|통계|진도|진행률|성취감|성장|얼마나\s*했|기록이\s*쌓|progress|stats|statistic"),
    "motion": ("움직임·효과음", r"애니메이션|움직|효과음|소리가|진동|모션|animation|sound effect"),
    "game": ("게임처럼·경쟁", r"게임\s*(?:같|처럼|하듯)|게임화|리그|랭킹|순위|경쟁|친구랑|친구와|league|leaderboard|gamif"),
    "custom_look": ("꾸미기·테마", r"꾸미|꾸밀|테마|다크\s*모드|색깔|색상|폰트|스티커|위젯|theme|dark mode|widget|sticker"),
    "simple": ("깔끔·단순", r"깔끔|단순|심플|군더더기|간단|가볍|simple|clean|minimal"),
    "boring": ("지루함·단조로움", r"지루|단조|밋밋|재미\s*없|재미가\s*없|심심|boring|dull|monoton"),
    "pressure": ("압박·죄책감", r"압박|스트레스|협박|죄책감|강요|귀찮게|집착|무섭|guilt|pressure|annoying"),
}


def table(frame):
    low = frame[frame["rating"].isin(LOW)]
    high = frame[frame["rating"].isin(HIGH)]
    rows = []
    for key, (name, _) in UX.items():
        lo, hi = low[key].mean(), high[key].mean()
        ci = diff_ci(lo, len(low), hi, len(high))
        rows.append(
            {
                "theme": key,
                "name": name,
                "mentions": int(frame[key].sum()),
                "share_pct": round(frame[key].mean() * 100, 1),
                "low_pct": round(lo * 100, 1),
                "high_pct": round(hi * 100, 1),
                "diff_low_minus_high": round((lo - hi) * 100, 1),
                "ci95_low": ci[0],
                "ci95_high": ci[1],
                "avg_rating_when_mentioned": round(frame.loc[frame[key], "rating"].mean(), 2)
                if frame[key].any()
                else None,
            }
        )
    return pd.DataFrame(rows).sort_values("mentions", ascending=False)


def main():
    meta, reviews = load()
    for key, (_, pattern) in UX.items():
        reviews[key] = reviews["text"].str.contains(pattern, case=False, regex=True)

    overall = table(reviews)
    by_app = (
        reviews.groupby("short")[list(UX)].mean().mul(100).round(1).reset_index()
    )
    by_app["avg_rating"] = reviews.groupby("short")["rating"].mean().round(2).values

    OUTPUT.mkdir(exist_ok=True)
    overall.to_csv(OUTPUT / "ux_overall.csv", index=False, encoding="utf-8-sig")
    by_app.to_csv(OUTPUT / "ux_by_app.csv", index=False, encoding="utf-8-sig")

    pd.set_option("display.width", 200)
    print(overall.to_string(index=False))
    print()
    print(by_app.to_string(index=False))

    if "--samples" in sys.argv:
        for key, (name, _) in UX.items():
            pick = reviews[reviews[key]].sort_values("rating", ascending=key in ("boring", "pressure"))
            print(f"\n=== {name} ===")
            for _, row in pick.head(8).iterrows():
                print(f"[{row['short']} {row['rating']}] {row['text'][:150]}")


if __name__ == "__main__":
    main()
