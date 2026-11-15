"""구독형 학습·기록 앱 사용자는 가격의 무엇에 불만을 갖나? 그리고 비슷한 앱은 얼마를 받나?

1. 리뷰(../data/reviews.jsonl, 11개 앱 5,142건) 중 가격·구독을 말한 리뷰를 세부 주제로 나눈다.
   "비싸다"(가격 수준)와 "자동 결제·해지·환불"(결제 방식)을 나눠 보면, 가격을 낮추는 것과 결제 방식을 바꾸는 것 중
   무엇이 더 중요한지 알 수 있다. 최근 1년(2025-11-13 이후) 리뷰만 따로 본다.
2. App Store 앱 내 구입 목록(data/prices.json)에서 월 구독과 연 구독 가격을 뽑아 비교한다.

실행: ../.venv/Scripts/python -I -X utf8 analyze_pricing.py [--samples]
     -> output/price_subtopics.csv, competitor_prices.csv, mentioned_prices.csv, summary.json
"""

import json
import re
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from analyze import THEMES, diff_ci, load  # noqa: E402

OUT = HERE / "output"
RECENT_FROM = "2025-11-13"

# 가격 이야기의 세부 주제. 표본을 읽고 고친 기록은 README에 있다.
SUBTOPICS = {
    # 표본 15개 점검 후 고침: '부담'만으로는 "길게 써야 한다는 부담"까지, '아까워'는 "돈이 안 아까워요"까지 잡았다.
    "expensive": ("비싸다·가격 부담", r"비싸|비쌈|가격.{0,6}부담|부담.{0,6}(?:가격|비용|금액)|(?<!안)(?<!안 )돈\s*(?:이\s*)?아깝|가격이\s*(?:너무|좀|넘)|too expensive|overpriced"),
    "autorenew": ("자동 결제·갱신", r"자동\s*(?:결제|갱신|연장)|결제가\s*(?:되|됐)|결제됐|빠져나|auto[-\s]?renew"),
    "cancel": ("해지·구독 취소", r"해지|구독\s*취소|취소가\s*안|취소\s*방법|cancel"),
    "refund": ("환불", r"환불|refund"),
    "paywall": ("무료 기능이 줄었다·유료로 막힘", r"유료\s*(?:로|화|전환)|무료(?:였|던|인데|로\s*쓰|\s*기능).{0,15}(?:유료|막|없어|줄)|결제\s*(?:해야|안\s*하면)|paywall"),
    "raise": ("가격 인상", r"(?:가격|요금|구독료).{0,6}(?:올|인상)|인상|올랐"),
    "trial": ("무료 체험", r"무료\s*체험|체험\s*(?:기간|판)|free trial|trial"),
    "worth": ("값어치를 한다", r"돈이\s*(?:안|하나도\s*안)\s*아깝|아깝지\s*않|값어치|가성비|돈값|충분히\s*가치|worth"),
}
AMOUNT = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(만\s*원|만원|원)")


def amount_won(number, unit):
    value = float(number.replace(",", ""))
    return int(value * 10000) if "만" in unit else int(value)


def subtopic_table(price_reviews):
    rows = []
    low = price_reviews[price_reviews["band"] == "low"]
    high = price_reviews[price_reviews["band"] == "high"]
    for key, (name, _) in SUBTOPICS.items():
        p_low, p_high = low[key].mean(), high[key].mean()
        ci_low, ci_high = diff_ci(p_low, len(low), p_high, len(high))
        rows.append(
            {
                "subtopic": key,
                "name": name,
                "share_of_price_reviews": round(price_reviews[key].mean() * 100, 1),
                "low_pct": round(p_low * 100, 1),
                "high_pct": round(p_high * 100, 1),
                "ci95_low": ci_low,
                "ci95_high": ci_high,
                "avg_rating": round(price_reviews.loc[price_reviews[key], "rating"].mean(), 2) if price_reviews[key].any() else None,
            }
        )
    return pd.DataFrame(rows).sort_values("share_of_price_reviews", ascending=False)


def plan_kind(name):
    lowered = name.lower()
    if re.search(r"평생|lifetime|영구", lowered):
        return "lifetime"
    if re.search(r"1\s*년|12\s*개월|연간|annual|year|yearly", lowered):
        return "year"
    if re.search(r"1\s*개월|월간|한\s*달|monthly|month", lowered):
        return "month"
    if re.search(r"(?:3|6)\s*개월|quarter", lowered):
        return "other_period"
    return "other"


# 개인 구독이 아닌 항목(코인, 수업, 가족·교사용, 다른 상품, 할부·첫 구매 할인)
NOT_PERSONAL = re.compile(r"coin|코인|클로버|class|선생님|teacher|family|패밀리|\bgo\b|할부|소개|플러스|plus /|gold|super vip", re.IGNORECASE)


def classify(frame):
    """이름에 기간이 없으면(Cake Plus, Quizlet Plus) 같은 이름 안의 가격 차이로 월·연을 가른다."""
    frame["kind"] = frame["item"].map(plan_kind)
    frame.loc[frame["item"].str.contains(NOT_PERSONAL), "kind"] = "excluded"
    for (_, _), group in frame[frame["kind"] == "other"].groupby(["app", "item"]):
        low = group["krw"].min()
        for index, row in group.iterrows():
            if row["krw"] == low and low <= 30000 and group["krw"].max() >= 3.5 * low:
                frame.loc[index, "kind"] = "month"
            elif row["krw"] >= 40000:
                frame.loc[index, "kind"] = "year"
    return frame


def competitor_table():
    data = json.loads((HERE / "data" / "prices.json").read_text(encoding="utf-8"))
    rows = []
    for app in data["apps"]:
        seen = set()
        for item in app["items"]:
            name = item["name"].lstrip("> ").strip()
            key = (name, item["krw"])
            if key in seen:
                continue
            seen.add(key)
            rows.append({"app": app["short"], "group": app["group"], "item": name, "krw": item["krw"]})
    frame = classify(pd.DataFrame(rows))
    return frame, data["collected_on"]


def main():
    _, reviews = load()
    reviews["price_any"] = reviews["text"].str.contains(THEMES["price"][1], case=False, regex=True)
    price_reviews = reviews[reviews["price_any"]].copy()
    for key, (_, pattern) in SUBTOPICS.items():
        price_reviews[key] = price_reviews["text"].str.contains(pattern, case=False, regex=True)
    recent = price_reviews[price_reviews["updated"] >= pd.Timestamp(RECENT_FROM, tz="UTC")]

    OUT.mkdir(exist_ok=True)
    table_all = subtopic_table(price_reviews)
    table_recent = subtopic_table(recent)
    table_all.to_csv(OUT / "price_subtopics.csv", index=False, encoding="utf-8-sig")
    table_recent.to_csv(OUT / "price_subtopics_recent.csv", index=False, encoding="utf-8-sig")

    # 리뷰에 적힌 금액: 사용자가 실제로 비교하는 가격대
    mentions = []
    for _, row in price_reviews.iterrows():
        for number, unit in AMOUNT.findall(row["text"]):
            won = amount_won(number, unit)
            if 900 <= won <= 500000:
                mentions.append({"app": row["short"], "rating": row["rating"], "won": won})
    mentioned = pd.DataFrame(mentions)
    mentioned.to_csv(OUT / "mentioned_prices.csv", index=False, encoding="utf-8-sig")

    competitors, collected_on = competitor_table()
    competitors.to_csv(OUT / "competitor_prices.csv", index=False, encoding="utf-8-sig")
    monthly = competitors[competitors["kind"] == "month"].groupby("app")["krw"].min()
    yearly = competitors[competitors["kind"] == "year"].groupby("app")["krw"].min()
    plans = pd.DataFrame({"monthly": monthly, "yearly": yearly})
    plans["yearly_per_month"] = (plans["yearly"] / 12).round(-1)
    plans["yearly_discount_pct"] = ((1 - plans["yearly"] / (plans["monthly"] * 12)) * 100).round(1)

    summary = {
        "reviews_total": int(len(reviews)),
        "price_reviews": int(len(price_reviews)),
        "price_reviews_recent": int(len(recent)),
        "recent_from": RECENT_FROM,
        "price_low_share": round(price_reviews["band"].eq("low").mean() * 100, 1),
        "subtopics_all": table_all.to_dict("records"),
        "subtopics_recent": table_recent.to_dict("records"),
        "mentioned_prices": {
            "count": int(len(mentioned)),
            "median": int(mentioned["won"].median()) if len(mentioned) else None,
            "quartiles": [int(mentioned["won"].quantile(q)) for q in (0.25, 0.5, 0.75)] if len(mentioned) else None,
        },
        "prices_collected_on": collected_on,
        "competitor_plans": plans.reset_index().rename(columns={"index": "app"}).to_dict("records"),
        "competitor_monthly_median": int(plans["monthly"].median()) if plans["monthly"].notna().any() else None,
        "competitor_yearly_per_month_median": int(plans["yearly_per_month"].median()) if plans["yearly_per_month"].notna().any() else None,
    }
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1, default=str), encoding="utf-8")

    print(f"가격·구독을 말한 리뷰 {len(price_reviews):,}건 (최근 1년 {len(recent):,}건), 그중 1~2점 {summary['price_low_share']}%")
    print(table_all.to_string(index=False))
    print("\n최근 1년")
    print(table_recent.to_string(index=False))
    print(f"\n리뷰에 적힌 금액 {summary['mentioned_prices']}")
    print(f"\n경쟁 앱 가격({collected_on})")
    print(plans.to_string())

    if "--samples" in sys.argv:
        for key, (name, _) in SUBTOPICS.items():
            print(f"\n## {name}")
            for text in price_reviews[price_reviews[key]].sample(min(5, int(price_reviews[key].sum())), random_state=7)["text"]:
                print(" -", re.sub(r"\s+", " ", text)[:160])


if __name__ == "__main__":
    main()
