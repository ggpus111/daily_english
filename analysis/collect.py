"""경쟁 앱의 앱스토어 정보와 최근 리뷰를 모은다.

출처: Apple의 공개 iTunes Search API(앱 정보)와 고객 리뷰 RSS(리뷰).
리뷰 RSS는 앱마다 최근 리뷰를 최대 500개까지만 준다.
작성자 이름은 저장하지 않는다.

실행: .venv/Scripts/python collect.py
"""

import json
import time
import urllib.request
from datetime import date
from pathlib import Path

COUNTRY = "kr"
PAGES = 10  # RSS 한 쪽에 50개씩, 최대 10쪽
HEADERS = {"User-Agent": "daily-english-research/1.0"}
OUT = Path(__file__).parent / "data"

# 우리 앱의 네 가지 성격(학습, 단어장, 실제 대화, 일기)에 맞춰 고른 앱
APPS = [
    ("learning", 570060128, "듀오링고"),
    ("learning", 1286609883, "스픽"),
    ("learning", 1460766549, "말해보카"),
    ("learning", 1350420987, "케이크"),
    ("vocab", 546473125, "Quizlet"),
    ("vocab", 1538546706, "VoCat"),
    ("vocab", 373493387, "AnkiMobile"),
    ("exchange", 557130558, "헬로톡"),
    ("exchange", 959001619, "탄뎀"),
    ("journal", 1044867788, "Day One"),
    ("journal", 1553223828, "하루콩"),
]


def get_json(url):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def label(entry, key):
    value = entry.get(key, {})
    return value.get("label", "") if isinstance(value, dict) else ""


def fetch_app(app_id):
    result = get_json(f"https://itunes.apple.com/lookup?id={app_id}&country={COUNTRY}")
    info = result["results"][0]
    return {
        "name": info["trackName"],
        "seller": info["sellerName"],
        "genre": info["primaryGenreName"],
        "price": info.get("formattedPrice", ""),
        "rating": info.get("averageUserRating"),
        "rating_count": info.get("userRatingCount"),
        "version": info.get("version"),
        "released": info.get("releaseDate"),
        "description": info.get("description", ""),
    }


def fetch_reviews(app_id):
    reviews = []
    for page in range(1, PAGES + 1):
        url = (
            f"https://itunes.apple.com/{COUNTRY}/rss/customerreviews/"
            f"page={page}/id={app_id}/sortby=mostrecent/json"
        )
        try:
            entries = get_json(url).get("feed", {}).get("entry", [])
        except Exception as error:  # 쪽이 없거나 일시적 오류면 그 앱은 거기서 멈춘다
            print(f"  page {page}: {error}")
            break
        if isinstance(entries, dict):
            entries = [entries]
        page_reviews = [
            {
                "review_id": label(entry, "id"),
                "rating": int(label(entry, "im:rating")),
                "title": label(entry, "title"),
                "content": label(entry, "content"),
                "version": label(entry, "im:version"),
                "updated": label(entry, "updated"),
            }
            for entry in entries
            if label(entry, "im:rating")
        ]
        if not page_reviews:
            break
        reviews.extend(page_reviews)
        time.sleep(0.5)
    return reviews


def main():
    OUT.mkdir(exist_ok=True)
    apps = []
    rows = []
    for group, app_id, short in APPS:
        print(f"{short} ({app_id})")
        info = fetch_app(app_id)
        reviews = fetch_reviews(app_id)
        print(f"  reviews: {len(reviews)}")
        apps.append({"group": group, "app_id": app_id, "short": short, **info})
        rows.extend({"app_id": app_id, "short": short, "group": group, **r} for r in reviews)
        time.sleep(0.5)

    meta = {"collected_on": date.today().isoformat(), "country": COUNTRY, "apps": apps}
    (OUT / "apps.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUT / "reviews.jsonl").open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"saved {len(rows)} reviews for {len(apps)} apps")


if __name__ == "__main__":
    main()
