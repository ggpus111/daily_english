"""비슷한 앱 11개의 구독 가격을 한국 App Store 앱 페이지에서 모은다.

- 출처: apps.apple.com/kr 앱 페이지의 "앱 내 구입" 목록(공개 웹 페이지). 페이지에는 많이 팔리는 항목 최대 10개만 보인다.
- 리뷰 분석(../collect.py)과 같은 앱 11개를 본다.

실행: ../.venv/Scripts/python -I -X utf8 collect_prices.py  -> data/prices.json
"""

import html
import json
import re
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
USER_AGENT = "Mozilla/5.0 (daily-english pricing study)"
APPS = [
    (570060128, "듀오링고", "learning"),
    (1286609883, "스픽", "learning"),
    (1460766549, "말해보카", "learning"),
    (1350420987, "케이크", "learning"),
    (546473125, "Quizlet", "vocab"),
    (1538546706, "VoCat", "vocab"),
    (373493387, "AnkiMobile", "vocab"),
    (557130558, "헬로톡", "exchange"),
    (959001619, "탄뎀", "exchange"),
    (1044867788, "Day One", "journal"),
    (1553223828, "하루콩", "journal"),
]
ITEM = re.compile(r"(.+?)\s*[￦₩]\s*([0-9][0-9,]*)")


def fetch(app_id, tries=6):
    """429(요청이 너무 많음)면 서버가 알려 준 시간만큼, 없으면 점점 길게 기다렸다 다시 묻는다."""
    for attempt in range(tries):
        request = urllib.request.Request(f"https://apps.apple.com/kr/app/id{app_id}", headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == tries - 1:
                raise
            wait = int(error.headers.get("Retry-After") or 0) or 20 * (attempt + 1)
            print(f"  요청이 많다고 해서 {wait}초 기다림")
            time.sleep(wait)


def purchases(page):
    """'앱 내 구입' 항목을 (이름, 원) 목록으로."""
    start = page.find(">앱 내 구입</dt>")
    if start < 0:
        return []
    # "앱 내 구입" 칸(<dd>…</dd>) 안만 읽는다. 페이지 전체를 넘기면 정규식이 매우 느려진다.
    end = page.find("</dd>", start)
    block = page[start:end if 0 < end - start < 20000 else start + 8000]
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", block)))
    text = text.replace("앱 내 구입", "").replace("사용 가능", "")
    items = []
    for name, price in ITEM.findall(text):
        items.append({"name": name.strip(), "krw": int(price.replace(",", ""))})
    return items


def main():
    DATA.mkdir(exist_ok=True)
    result = {"collected_on": date.today().isoformat(), "source": "apps.apple.com/kr 앱 내 구입 목록", "apps": []}
    for app_id, short, group in APPS:
        items = purchases(fetch(app_id))
        result["apps"].append({"app_id": app_id, "short": short, "group": group, "items": items})
        print(f"{short}: {len(items)}개 항목")
        time.sleep(6)  # 서버에 부담을 주지 않게 천천히
    (DATA / "prices.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
