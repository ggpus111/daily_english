"""분석 스크립트를 시험할 지어낸 예시 데이터(sample/sample_export.csv)를 만든다.

실제 사용자 기록이 아니다. export.sql과 같은 모양(kind, user_key, at, data)으로, 친구 12명이 2주 동안 쓴 것처럼
무작위로 만든다(난수 씨앗 고정이라 매번 같다). 단어·표현은 공개 꾸러미(src/data/en)에서 고르고,
직접 입력한 말은 "my-word-3"처럼 지어낸 이름을 쓴다.

실행: analysis/.venv/Scripts/python -I -X utf8 analysis/usage/make_sample.py
"""

import csv
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "sample" / "sample_export.csv"
START = datetime(2026, 11, 25, 10, tzinfo=timezone(timedelta(hours=9)))
rng = random.Random(7)


def pack_items():
    packs = json.loads((ROOT / "src" / "data" / "en" / "packs.json").read_text(encoding="utf-8"))
    groups = packs.get("groups") or packs.get("packs")
    expressions = [item["text"] for group in groups for item in group["items"]]
    words = json.loads((ROOT / "src" / "data" / "en" / "words.json").read_text(encoding="utf-8"))
    word_list = [item.get("text") or item["word"] for level in words["levels"] for item in (level.get("items") or level.get("words"))]
    grammar = json.loads((ROOT / "src" / "data" / "en" / "grammar.json").read_text(encoding="utf-8"))
    grammar_list = [item["text"] for pack in grammar["packs"] for item in pack["items"]]
    return expressions, word_list, grammar_list


def main():
    expressions, words, grammar = pack_items()
    rows = []
    add = lambda kind, user, at, data: rows.append([kind, user, at.isoformat(), json.dumps(data, ensure_ascii=False)])

    users = [f"u{n:03d}" for n in range(1, 14)]
    add("user", "u001", START - timedelta(days=3), {"confirmed": True, "is_admin": True, "is_pro": True, "provider": "email"})
    pair_no = 0
    for index, user in enumerate(users[1:]):
        signup = START + timedelta(days=rng.choice([0, 0, 0, 1, 1, 2, 3, 5]), hours=rng.randint(0, 10))
        add("user", user, signup, {"confirmed": rng.random() > 0.1, "is_admin": False, "is_pro": False, "provider": "email"})
        engaged = rng.random()  # 사람마다 얼마나 꾸준히 쓰는지
        if engaged < 0.2:
            continue  # 가입만 하고 기록이 없는 사람
        active_days = sorted({0} | {d for d in range(1, 14) if rng.random() < engaged * 0.6})
        for day in active_days:
            when = signup + timedelta(days=day, minutes=rng.randint(5, 600))
            for _ in range(rng.randint(1, 4)):
                kind = rng.choices(["word", "expression", "journal", "chat", "grammar"], [5, 4, 2, 1, 1])[0]
                data = {"type": kind}
                if kind in ("word", "expression"):
                    from_pack = rng.random() < 0.7
                    data["text"] = rng.choice(words if kind == "word" else expressions) if from_pack else f"my-{kind}-{rng.randint(1, 99)}"
                    data["category"] = rng.choice(["daily", "friends", "love", "feelings", "food", None])
                elif kind == "grammar":
                    data["text"] = rng.choice(grammar)
                    data["source"] = rng.choice(["pack", "journal", None])
                elif kind == "journal":
                    data.update(native_len=rng.randint(40, 300), learning_len=rng.randint(30, 400),
                                has_ai=rng.random() < 0.5, mood=rng.choice(["happy", "tired", "calm", None]))
                    if data["has_ai"]:
                        add("ai", user, when.replace(hour=0, minute=0), {"count": rng.randint(1, 5)})
                else:
                    data["message_len"] = rng.randint(5, 120)
                if kind in ("word", "expression", "grammar") and rng.random() < engaged:
                    reviews = rng.randint(1, 6)
                    misses = sum(rng.random() < 0.3 for _ in range(reviews))
                    data.update(reviews=reviews, misses=misses, box=max(0, min(5, reviews - 2 * misses)))
                    data["updated_at"] = (when + timedelta(days=rng.randint(1, 5))).isoformat()
                else:
                    data["updated_at"] = when.isoformat()
                add("record", user, when, {k: v for k, v in data.items() if v is not None})
        if index % 3 == 0 and index + 2 < len(users):
            pair_no += 1
            pair = f"c{pair_no:03d}"
            add("pair", None, signup, {"pair": pair, "pair_kind": rng.choice(["friend", "friend", "partner"])})
            add("member", user, signup, {"pair": pair, "notify": True})
            friend = users[index + 2]
            if rng.random() < 0.8:
                add("member", friend, signup + timedelta(hours=5), {"pair": pair, "notify": False})
                for day in range(rng.randint(1, 8)):
                    for sender, receiver in ((user, friend), (friend, user)):
                        if rng.random() < 0.6:
                            sid = len(rows) + 1
                            at = signup + timedelta(days=day, hours=rng.randint(1, 12))
                            add("sentence", sender, at, {"pair": pair, "day": at.date().isoformat(), "lang": "en",
                                                         "length": rng.randint(10, 80), "sentence": sid})
                            if rng.random() < 0.5:
                                add("reaction", receiver, at + timedelta(hours=2),
                                    {"sentence": sid, "reaction": rng.choice(["heart", "thanks", "funny", "learned"])})
        if rng.random() < 0.2:
            add("error", user, signup + timedelta(days=1), {"source": "window", "platform": rng.choice(["web", "android"]), "count": rng.randint(1, 3)})
    add("report", "u004", START + timedelta(days=4), {"report_kind": "content", "platform": "web", "status": "new"})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["kind", "user_key", "at", "data"])
        writer.writerows(rows)
    print(f"예시 데이터 {len(rows)}줄 -> {OUT}")


if __name__ == "__main__":
    main()
