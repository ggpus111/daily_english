"""Daily English 실사용 기록 분석.

export.sql로 내려받은 익명 CSV(kind, user_key, at, data)를 읽어 친구 시험 기간의 사용 수치를 계산한다.
결과: output/report.md(표), output/report.html(그래프), output/summary.json(숫자만)

질문
  1. 몇 명이 가입했고, 그중 몇 명이 실제로 기록을 남겼나(활성화)?
  2. 가입한 사람이 다음 날, 일주일 뒤에도 돌아왔나(재방문)?
  3. 어떤 기록을 많이 남기고, 꾸러미·일기 교정에서 담은 말은 얼마나 되나?
  4. 복습에서 얼마나 맞히고, 어떤 말을 많이 헷갈리나?
  5. AI 교정과 친구 기능은 얼마나 쓰이나?

실행
  analysis/.venv/Scripts/python -I -X utf8 analysis/usage/analyze.py                 data/export.csv 분석
  analysis/.venv/Scripts/python -I -X utf8 analysis/usage/analyze.py --sample        지어낸 예시 데이터로 시험
  옵션: --input 경로, --since 2026-11-25(이 날 이후 가입한 사람만), --include-admin(관리자 계정도 포함), --include-demo(시연용 +demo 계정도 포함)

한계(보고서에도 적는다)
  - 앱 안 화면 이동이나 머문 시간은 남기지 않으므로 "활동한 날"은 기록을 만들거나 고친 날, 문장을 보낸 날,
    반응한 날, AI 교정을 쓴 날로만 센다. 복습은 기록의 마지막 수정 시각만 남아서 활동한 날이 실제보다 적게 잡힌다.
  - 로그인 없이 쓰는 사람의 기록은 그 기기에만 있어서 여기에 없다.
"""

import argparse
import html
import json
from datetime import timedelta
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "output"
TYPES = ["word", "expression", "chat", "journal", "grammar"]
TYPE_KO = {"word": "단어", "expression": "표현", "chat": "대화", "journal": "일기", "grammar": "문법"}
PAIR_KO = {"friend": "친구", "partner": "연인"}
REPORT_KO = {"bug": "오류", "content": "콘텐츠", "idea": "아이디어"}
SOURCE_KO = {"pack": "꾸러미에서 담음", "journal": "일기 교정에서 담음", "self": "직접 입력"}
SETTLED_BOX = 3  # src/lib/review.js: 이 상자 이상이면 익숙해진 말로 본다


# ── 읽기 ─────────────────────────────────────────────────────────
def load(path):
    raw = pd.read_csv(path, dtype={"kind": str, "user_key": str, "data": str})
    raw["at"] = pd.to_datetime(raw["at"], utc=True, format="mixed")
    raw["data"] = raw["data"].fillna("{}").map(json.loads)
    return raw


def table(raw, kind):
    part = raw[raw["kind"] == kind]
    if part.empty:
        return pd.DataFrame({"user_key": pd.Series(dtype=object), "at": pd.Series(dtype="datetime64[ns, UTC]")})
    data = pd.json_normalize(part["data"].tolist())
    data.index = part.index
    return pd.concat([part[["user_key", "at"]], data], axis=1).reset_index(drop=True)


def pack_texts():
    """꾸러미(공개 콘텐츠)에 있는 말. 저장한 말이 꾸러미 것인지 가리는 데 쓴다."""
    texts = set()
    for path in (ROOT / "src" / "data").rglob("*.json"):
        def walk(node):
            if isinstance(node, dict):
                for key in ("text", "word"):  # 표현·문법은 text, 단어는 word
                    if isinstance(node.get(key), str):
                        texts.add(node[key].strip().lower())
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)
        walk(json.loads(path.read_text(encoding="utf-8")))
    return texts


# ── 계산 ─────────────────────────────────────────────────────────
def pct(part, whole):
    return round(100 * part / whole, 1) if whole else None


def analyze(raw, since=None, include_admin=False, include_demo=False):
    users = table(raw, "user")
    users["is_admin"] = users.get("is_admin", False)
    excluded = 0
    if not include_admin:
        excluded = int(users["is_admin"].fillna(False).astype(bool).sum())
        users = users[~users["is_admin"].fillna(False).astype(bool)]
    demo_excluded = 0
    if not include_demo and "is_demo" in users:  # 시연용 계정(날짜를 과거로 맞춘 예시 데이터)은 실제 수치에서 뺀다
        demo_excluded = int(users["is_demo"].fillna(False).astype(bool).sum())
        users = users[~users["is_demo"].fillna(False).astype(bool)]
    if since:
        users = users[users["at"] >= pd.Timestamp(since, tz="UTC")]
    keep = set(users["user_key"])
    pick = lambda kind: (lambda t: t[t["user_key"].isin(keep)].reset_index(drop=True))(table(raw, kind))

    records, ai, members = pick("record"), pick("ai"), pick("member")
    sentences, reactions = pick("sentence"), pick("reaction")
    errors, reports = pick("error"), pick("report")
    pairs = table(raw, "pair")
    for frame, cols in [(records, ["type", "updated_at", "box", "reviews", "misses", "source", "text", "has_ai",
                                   "learning_len", "native_len", "category", "mood"]),
                        (ai, ["count"]), (members, ["pair"]), (sentences, ["pair", "length"]),
                        (reactions, ["sentence", "reaction"]), (errors, ["source", "platform", "count"]),
                        (reports, ["report_kind"]), (pairs, ["pair", "pair_kind"])]:
        for col in cols:
            if col not in frame:
                frame[col] = None

    result = {"scope": {"users": len(users), "admins_excluded": excluded, "demo_excluded": demo_excluded, "since": since,
                        "first_signup": users["at"].min(), "last_activity": None}}

    # 활동한 날(사람별 날짜 모음)
    activity = pd.concat([
        records[["user_key", "at"]],
        records.assign(at=pd.to_datetime(records["updated_at"], utc=True, format="mixed"))[["user_key", "at"]],
        sentences[["user_key", "at"]], reactions[["user_key", "at"]], ai[["user_key", "at"]],
    ]).dropna()
    activity["at"] = pd.to_datetime(activity["at"], utc=True)
    activity["day"] = activity["at"].dt.tz_convert("Asia/Seoul").dt.date
    days = activity.groupby("user_key")["day"].apply(set).to_dict()
    result["scope"]["last_activity"] = activity["at"].max() if len(activity) else None

    # 1. 활성화
    users = users.copy()
    users["signup_day"] = users["at"].dt.tz_convert("Asia/Seoul").dt.date
    first_record = records.groupby("user_key")["at"].min()
    users["first_record"] = pd.to_datetime(users["user_key"].map(first_record.to_dict()), utc=True)
    with_record = users["first_record"].notna()
    hours = ((users["first_record"] - users["at"]).dt.total_seconds() / 3600)[with_record]
    result["activation"] = {
        "signups": len(users),
        "email_confirmed": int(users.get("confirmed", pd.Series(dtype=bool)).fillna(False).astype(bool).sum()),
        "made_a_record": int(with_record.sum()),
        "made_a_record_pct": pct(with_record.sum(), len(users)),
        "made_a_record_within_1_day": int((hours <= 24).sum()),
        "median_hours_to_first_record": round(float(hours.median()), 1) if len(hours) else None,
    }

    # 2. 재방문: 가입한 다음 날 / 2~7일 사이에 활동한 날이 있나. 그 기간이 다 지난 사람만 센다.
    today = (result["scope"]["last_activity"] or pd.Timestamp.now(tz="UTC")).tz_convert("Asia/Seoul").date()
    def came_back(row, start, end):
        span = {row.signup_day + timedelta(days=d) for d in range(start, end + 1)}
        return bool(span & days.get(row.user_key, set()))
    d1 = users[users["signup_day"] + timedelta(days=1) <= today]
    d7 = users[users["signup_day"] + timedelta(days=7) <= today]
    active_days = pd.Series({u: len(days.get(u, set())) for u in users["user_key"]}, dtype=float)
    result["retention"] = {
        "day1_eligible": len(d1),
        "day1_returned": int(sum(came_back(r, 1, 1) for r in d1.itertuples())),
        "week1_eligible": len(d7),
        "week1_returned": int(sum(came_back(r, 1, 7) for r in d7.itertuples())),
        "median_active_days": float(active_days.median()) if len(active_days) else None,
    }
    result["retention"]["day1_pct"] = pct(result["retention"]["day1_returned"], len(d1))
    result["retention"]["week1_pct"] = pct(result["retention"]["week1_returned"], len(d7))

    daily = activity.groupby("day")["user_key"].nunique()
    if len(daily):  # 아무도 활동하지 않은 날도 0으로 보이게 채운다
        span = pd.date_range(min(daily.index), max(daily.index), freq="D").date
        daily = daily.reindex(span, fill_value=0)
    result["daily_active"] = {str(k): int(v) for k, v in daily.sort_index().items()}

    # 3. 기록
    packs = pack_texts()
    def source(row):
        if row.source in ("pack", "journal"):
            return row.source
        if row.type in ("word", "expression") and isinstance(row.text, str) and row.text.strip().lower() in packs:
            return "pack"
        return "self"
    records["origin"] = [source(r) for r in records.itertuples()] if len(records) else []
    per_user = records.groupby(["user_key", "type"]).size().unstack(fill_value=0).reindex(columns=TYPES, fill_value=0)
    per_user = per_user.reindex(users["user_key"], fill_value=0)
    result["records"] = {
        "total": len(records),
        "by_type": {t: int((records["type"] == t).sum()) for t in TYPES},
        "median_per_user": {t: float(per_user[t].median()) if len(per_user) else 0 for t in TYPES},
        "users_using_type": {t: int((per_user[t] > 0).sum()) for t in TYPES},
        "origin": {k: int(v) for k, v in records[records["type"].isin(["word", "expression", "grammar"])]
                   .groupby("origin").size().items()},
        "word_categories": {k: int(v) for k, v in records[records["type"].isin(["word", "expression"])]
                            ["category"].fillna("(없음)").value_counts().items()},
    }
    saved = records[records["type"].isin(["word", "expression"]) & (records["origin"] == "pack")]
    top_saved = saved.groupby(saved["text"].str.strip())["user_key"].nunique().sort_values(ascending=False).head(10)
    result["records"]["top_pack_saves"] = [{"text": k, "users": int(v)} for k, v in top_saved.items()]

    # 4. 복습
    studied = records[records["type"].isin(["word", "expression", "grammar"])].copy()
    studied["reviews"] = pd.to_numeric(studied["reviews"], errors="coerce").fillna(0)
    studied["misses"] = pd.to_numeric(studied["misses"], errors="coerce").fillna(0)
    studied["box"] = pd.to_numeric(studied["box"], errors="coerce").fillna(0).astype(int)
    reviewed = studied[studied["reviews"] > 0]
    by_type = {}
    for t, part in reviewed.groupby("type"):
        answered = part["reviews"].sum()
        by_type[t] = {"items": len(part), "answers": int(answered), "correct_pct": pct(answered - part["misses"].sum(), answered)}
    answered = reviewed["reviews"].sum()
    result["review"] = {
        "users_who_reviewed": int(reviewed["user_key"].nunique()),
        "items_reviewed": len(reviewed),
        "items_reviewed_pct": pct(len(reviewed), len(studied)),
        "answers": int(answered),
        "correct_pct": pct(answered - reviewed["misses"].sum(), answered),
        "by_type": by_type,
        "box": {int(k): int(v) for k, v in studied["box"].value_counts().sort_index().items()},
        "settled_pct": pct((studied["box"] >= SETTLED_BOX).sum(), len(studied)),
    }
    # 많이 헷갈리는 말: 여러 사람이 틀린 꾸러미 말만 글자 그대로 보여 주고, 직접 입력한 말은 종류로만 센다.
    missed = reviewed[reviewed["misses"] > 0]
    public = missed[missed["origin"] == "pack"]
    top_missed = (public.groupby(public["text"].str.strip())
                  .agg(users=("user_key", "nunique"), misses=("misses", "sum"), reviews=("reviews", "sum"))
                  .sort_values(["misses", "users"], ascending=False).head(10))
    result["review"]["top_missed_pack"] = [
        {"text": k, "users": int(r.users), "misses": int(r.misses), "miss_pct": pct(r.misses, r.reviews)}
        for k, r in top_missed.iterrows()]
    result["review"]["missed_by_origin"] = {k: int(v) for k, v in missed.groupby("origin").size().items()}

    # 5-1. 일기와 AI 교정
    journals = records[records["type"] == "journal"].copy()
    with_ai = journals["has_ai"].fillna(False).astype(bool)
    ai["count"] = pd.to_numeric(ai["count"], errors="coerce").fillna(0)
    result["journal"] = {
        "journals": len(journals),
        "writers": int(journals["user_key"].nunique()),
        "with_ai_pct": pct(with_ai.sum(), len(journals)),
        "median_learning_len": float(pd.to_numeric(journals["learning_len"], errors="coerce").median()) if len(journals) else None,
        "moods": {k: int(v) for k, v in journals["mood"].dropna().value_counts().items()},
        "ai_requests": int(ai["count"].sum()),
        "ai_users": int(ai.loc[ai["count"] > 0, "user_key"].nunique()),
        "ai_days_at_limit": int((ai["count"] >= 5).sum()),
        "grammar_from_journal": int(((records["type"] == "grammar") & (records["source"] == "journal")).sum()),
    }

    # 5-2. 친구·연인
    members_per_pair = members.groupby("pair")["user_key"].nunique()
    pairs = pairs.assign(members=pairs["pair"].map(members_per_pair).fillna(0).astype(int))
    pairs = pairs[pairs["pair"].isin(members["pair"])]
    sent_ids = set(sentences["sentence"].dropna().astype(int)) if "sentence" in sentences else set()
    reacted = set(reactions["sentence"].dropna().astype(int))
    result["friends"] = {
        "users_in_a_pair": int(members["user_key"].nunique()),
        "pairs_started": len(pairs),
        "pairs_joined": int((pairs["members"] >= 2).sum()),
        "pairs_by_kind": {k: int(v) for k, v in pairs[pairs["members"] >= 2]["pair_kind"].value_counts().items()},
        "sentences": len(sentences),
        "senders": int(sentences["user_key"].nunique()),
        "sentences_with_reaction_pct": pct(len(sent_ids & reacted), len(sent_ids)),
        "reactions": {k: int(v) for k, v in reactions["reaction"].value_counts().items()},
    }

    # 6. 오류와 신고
    errors["count"] = pd.to_numeric(errors["count"], errors="coerce").fillna(1)
    result["quality"] = {
        "error_events": int(errors["count"].sum()),
        "users_with_errors": int(errors["user_key"].nunique()),
        "errors_by_platform": {k: int(v) for k, v in errors.groupby("platform")["count"].sum().items()},
        "reports": {k: int(v) for k, v in reports["report_kind"].value_counts().items()},
    }
    return result


# ── 쓰기 ─────────────────────────────────────────────────────────
def fmt(value, unit=""):
    if value is None:
        return "-"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return f"{value:,}{unit}" if isinstance(value, (int, float)) else str(value)


def ratio(part, whole, p):
    return f"{fmt(part)} / {fmt(whole)}명 ({fmt(p, '%')})" if whole else "아직 셀 수 있는 사람이 없음"


def markdown(r, sample):
    a, ret, rec, rev, j, f, q = (r[k] for k in ["activation", "retention", "records", "review", "journal", "friends", "quality"])
    s = r["scope"]
    lines = ["# Daily English 실사용 분석", ""]
    if sample:
        lines += ["> **지어낸 예시 데이터로 만든 보고서예요.** 실제 사용자 수치가 아닙니다. 분석 방법을 미리 확인하는 용도예요.", ""]
    lines += [
        f"- 대상: 가입한 사람 {fmt(s['users'])}명 (관리자 계정 {s['admins_excluded']}개, 시연용 계정 {s['demo_excluded']}개 제외{', ' + s['since'] + ' 이후 가입' if s['since'] else ''})",
        f"- 기간: 첫 가입 {s['first_signup']:%Y-%m-%d} ~ 마지막 활동 {s['last_activity']:%Y-%m-%d}" if s["last_activity"] is not None and s["first_signup"] is not pd.NaT else "- 기간: 활동 없음",
        "",
        "## 1. 가입하고 실제로 써 봤나",
        "",
        "| 지표 | 값 |", "| --- | --- |",
        f"| 가입 | {fmt(a['signups'])}명 (이메일 확인 {fmt(a['email_confirmed'])}명) |",
        f"| 기록을 하나라도 남김 | {ratio(a['made_a_record'], a['signups'], a['made_a_record_pct'])} |",
        f"| 가입 후 하루 안에 첫 기록 | {fmt(a['made_a_record_within_1_day'])}명 |",
        f"| 첫 기록까지 걸린 시간(중앙값) | {fmt(a['median_hours_to_first_record'], '시간')} |",
        "",
        "## 2. 다시 돌아왔나",
        "",
        "| 지표 | 값 |", "| --- | --- |",
        f"| 다음 날 다시 활동 | {ratio(ret['day1_returned'], ret['day1_eligible'], ret['day1_pct'])} |",
        f"| 7일 안에 다시 활동 | {ratio(ret['week1_returned'], ret['week1_eligible'], ret['week1_pct'])} |",
        f"| 한 사람이 활동한 날(중앙값) | {fmt(ret['median_active_days'], '일')} |",
        "",
        "가입 뒤 그 기간이 다 지난 사람만 셌어요.",
        "",
        "## 3. 무엇을 기록했나",
        "",
        "| 종류 | 기록 수 | 쓴 사람 | 한 사람 중앙값 |", "| --- | --- | --- | --- |",
    ]
    for t in TYPES:
        lines.append(f"| {TYPE_KO[t]} | {fmt(rec['by_type'][t])} | {fmt(rec['users_using_type'][t])}명 | {fmt(rec['median_per_user'][t])} |")
    lines += ["", "단어·표현·문법을 어디서 담았나: " + ", ".join(
        f"{SOURCE_KO.get(k, k)} {fmt(v)}개" for k, v in rec["origin"].items()) if rec["origin"] else "", ""]
    if rec["top_pack_saves"]:
        lines += ["많이 담은 꾸러미 말", "", "| 말 | 담은 사람 |", "| --- | --- |"]
        lines += [f"| {x['text']} | {x['users']}명 |" for x in rec["top_pack_saves"]] + [""]
    lines += [
        "## 4. 복습에서 얼마나 맞혔나",
        "",
        "| 지표 | 값 |", "| --- | --- |",
        f"| 복습한 사람 | {fmt(rev['users_who_reviewed'])}명 |",
        f"| 한 번이라도 복습한 말 | {fmt(rev['items_reviewed'])}개 (담은 말의 {fmt(rev['items_reviewed_pct'], '%')}) |",
        f"| 답한 횟수 / 맞힌 비율 | {fmt(rev['answers'])}번 / {fmt(rev['correct_pct'], '%')} |",
        f"| 익숙해진 말(상자 {SETTLED_BOX} 이상) | {fmt(rev['settled_pct'], '%')} |",
        "",
    ]
    if rev["by_type"]:
        lines += ["| 종류 | 복습한 말 | 답한 횟수 | 맞힌 비율 |", "| --- | --- | --- | --- |"]
        lines += [f"| {TYPE_KO.get(t, t)} | {fmt(v['items'])} | {fmt(v['answers'])} | {fmt(v['correct_pct'], '%')} |" for t, v in rev["by_type"].items()] + [""]
    if rev["top_missed_pack"]:
        lines += ["많이 헷갈린 꾸러미 말(직접 입력한 말은 개인 기록이라 글자를 보여 주지 않아요)", "",
                  "| 말 | 틀린 사람 | 틀린 횟수 | 틀린 비율 |", "| --- | --- | --- | --- |"]
        lines += [f"| {x['text']} | {x['users']}명 | {x['misses']} | {fmt(x['miss_pct'], '%')} |" for x in rev["top_missed_pack"]] + [""]
    lines += [
        "## 5. 일기, AI 교정, 친구 기능",
        "",
        "| 지표 | 값 |", "| --- | --- |",
        f"| 일기 | {fmt(j['journals'])}편, {fmt(j['writers'])}명 |",
        f"| AI 교정을 받은 일기 | {fmt(j['with_ai_pct'], '%')} |",
        f"| 배우는 언어로 쓴 글자 수(중앙값) | {fmt(j['median_learning_len'], '자')} |",
        f"| AI 요청 | {fmt(j['ai_requests'])}번, {fmt(j['ai_users'])}명 (하루 한도 5번을 다 쓴 날 {fmt(j['ai_days_at_limit'])}번) |",
        f"| 일기 교정에서 담은 문법 | {fmt(j['grammar_from_journal'])}개 |",
        f"| 친구·연인 짝을 만든 사람 | {fmt(f['users_in_a_pair'])}명 |",
        f"| 짝 (만든 것 / 둘 다 들어온 것) | {fmt(f['pairs_started'])} / {fmt(f['pairs_joined'])}개 "
        f"({', '.join(f'{PAIR_KO.get(k, k)} {v}' for k, v in f['pairs_by_kind'].items()) or '-'}) |",
        f"| 주고받은 문장 | {fmt(f['sentences'])}개, 보낸 사람 {fmt(f['senders'])}명 |",
        f"| 반응을 받은 문장 | {fmt(f['sentences_with_reaction_pct'], '%')} |",
        "",
        "## 6. 오류와 신고",
        "",
        f"- 앱 오류 {fmt(q['error_events'])}번, 겪은 사람 {fmt(q['users_with_errors'])}명"
        + (f" ({', '.join(f'{k} {v}번' for k, v in q['errors_by_platform'].items())})" if q["errors_by_platform"] else ""),
        f"- 문제 신고: {', '.join(f'{REPORT_KO.get(k, k)} {v}건' for k, v in q['reports'].items()) or '없음'}",
        "",
        "## 이 숫자를 읽을 때",
        "",
        "- 사람 수가 적을 때는 비율이 한 사람에 따라 크게 흔들려요. 비율 옆의 사람 수를 같이 보세요.",
        "- 앱은 화면 이동이나 머문 시간을 남기지 않아요. 활동한 날은 기록을 만들거나 고친 날, 문장·반응을 보낸 날, AI 교정을 쓴 날로만 셌어요.",
        "- 복습은 기록마다 마지막 시각만 남아서, 복습만 한 날은 일부 빠질 수 있어요.",
        "- 로그인 없이 쓴 기록은 그 기기에만 있어서 들어 있지 않아요.",
        "- 이메일, 닉네임, 일기·대화·문장 내용은 내보내지 않았어요(export.sql 참고).",
        "",
    ]
    return "\n".join(lines)


def bars_svg(title, items, unit=""):
    """가로 막대 그래프(SVG). items: [(이름, 값)]. 값마다 글자로도 적어서 색만으로 읽지 않게 한다."""
    if not items:
        return f"<figure><figcaption>{html.escape(title)}</figcaption><p class='empty'>아직 데이터가 없어요.</p></figure>"
    width, label_w, row = 560, 150, 30
    top = max(v for _, v in items) or 1
    rows = []
    for i, (name, value) in enumerate(items):
        w = max(2, (width - label_w - 70) * value / top)
        y = i * row
        rows.append(
            f"<g><title>{html.escape(str(name))}: {fmt(value, unit)}</title>"
            f"<text x='{label_w - 8}' y='{y + 19}' text-anchor='end' class='label'>{html.escape(str(name))}</text>"
            f"<rect x='{label_w}' y='{y + 6}' width='{w:.1f}' height='18' rx='4' class='bar'/>"
            f"<text x='{label_w + w + 6:.1f}' y='{y + 19}' class='value'>{fmt(value, unit)}</text></g>")
    height = len(items) * row + 6
    return (f"<figure><figcaption>{html.escape(title)}</figcaption>"
            f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='{html.escape(title)}'>{''.join(rows)}</svg></figure>")


def columns_svg(title, items):
    """날짜별 세로 막대(활동한 사람 수)."""
    if not items:
        return f"<figure><figcaption>{html.escape(title)}</figcaption><p class='empty'>아직 데이터가 없어요.</p></figure>"
    width, height, bottom = 560, 180, 24
    top = max(v for _, v in items) or 1
    step = width / len(items)
    bar = max(3, min(28, step - 2))
    parts = [f"<line x1='0' x2='{width}' y1='{height - bottom}' y2='{height - bottom}' class='axis'/>"]
    for i, (day, value) in enumerate(items):
        h = (height - bottom - 16) * value / top
        x = i * step + (step - bar) / 2
        parts.append(f"<g><title>{day}: {value}명</title><rect x='{x:.1f}' y='{height - bottom - h:.1f}' width='{bar:.1f}' "
                     f"height='{h:.1f}' rx='3' class='bar'/></g>")
    for i in sorted({0, len(items) - 1, len(items) // 2}):
        anchor = "start" if i == 0 else "end" if i == len(items) - 1 else "middle"
        x = i * step + step / 2
        parts.append(f"<text x='{x:.1f}' y='{height - 6}' text-anchor='{anchor}' class='label'>{items[i][0][5:]}</text>")
    parts.append(f"<text x='0' y='10' class='label'>최고 {top}명</text>")
    return (f"<figure><figcaption>{html.escape(title)}</figcaption>"
            f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='{html.escape(title)}'>{''.join(parts)}</svg></figure>")


def html_report(r, md, sample):
    rec, rev = r["records"], r["review"]
    charts = [
        columns_svg("날짜별 활동한 사람", list(r["daily_active"].items())),
        bars_svg("종류별 기록 수", [(TYPE_KO[t], rec["by_type"][t]) for t in TYPES]),
        bars_svg("복습 종류별 맞힌 비율", [(TYPE_KO.get(t, t), v["correct_pct"] or 0) for t, v in rev["by_type"].items()], "%"),
        bars_svg("복습 상자별 말 수(0: 처음·틀림, 높을수록 익숙)", [(f"상자 {k}", v) for k, v in rev["box"].items()]),
        bars_svg("많이 담은 꾸러미 말(담은 사람)", [(x["text"], x["users"]) for x in rec["top_pack_saves"]], "명"),
    ]
    banner = "<p class='banner'>지어낸 예시 데이터로 만든 보고서예요. 실제 사용자 수치가 아닙니다.</p>" if sample else ""
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily English 실사용 분석</title>
<style>
:root {{ --bg:#f6f1ec; --card:#fffdfa; --ink:#3b2a22; --muted:#7a675c; --bar:#c98e78; --line:#e4d8cf; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#1f1916; --card:#2a221e; --ink:#f3e9e2; --muted:#bcaa9e; --bar:#d9a08a; --line:#43362f; }} }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 system-ui, "Pretendard", sans-serif; }}
main {{ max-width:760px; margin:0 auto; padding:24px 16px 48px; }}
figure {{ background:var(--card); border:1px solid var(--line); border-radius:16px; margin:0 0 16px; padding:16px; }}
figcaption {{ font-weight:700; margin-bottom:8px; }}
svg {{ width:100%; height:auto; display:block; }}
.bar {{ fill:var(--bar); }} .axis {{ stroke:var(--line); }}
.label, .value {{ fill:var(--muted); font-size:12px; }} .value {{ fill:var(--ink); }}
.banner {{ background:var(--card); border-left:4px solid var(--bar); padding:10px 14px; border-radius:8px; }}
.empty {{ color:var(--muted); }}
pre {{ white-space:pre-wrap; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; font-size:13px; }}
</style></head>
<body><main>
<h1>Daily English 실사용 분석</h1>
{banner}
{''.join(charts)}
<h2>표로 보기</h2>
<pre>{html.escape(md)}</pre>
</main></body></html>
"""


def main():
    parser = argparse.ArgumentParser(description="Daily English 실사용 기록 분석")
    parser.add_argument("--input", type=Path, default=HERE / "data" / "export.csv")
    parser.add_argument("--sample", action="store_true", help="지어낸 예시 데이터(sample/sample_export.csv)로 시험")
    parser.add_argument("--since", help="이 날(YYYY-MM-DD) 이후 가입한 사람만")
    parser.add_argument("--include-admin", action="store_true", help="관리자 계정도 포함")
    parser.add_argument("--include-demo", action="store_true", help="시연용(+demo) 계정도 포함")
    args = parser.parse_args()

    path = HERE / "sample" / "sample_export.csv" if args.sample else args.input
    if not path.exists():
        raise SystemExit(f"{path}가 없어요. export.sql을 SQL Editor에서 돌려 CSV로 내려받아 이 이름으로 저장해 주세요.")
    result = analyze(load(path), since=args.since, include_admin=args.include_admin, include_demo=args.include_demo)

    out = OUT / "sample" if args.sample else OUT
    out.mkdir(parents=True, exist_ok=True)
    md = markdown(result, args.sample)
    (out / "report.md").write_text(md, encoding="utf-8")
    (out / "report.html").write_text(html_report(result, md, args.sample), encoding="utf-8")
    (out / "summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=1, default=str) + "\n", encoding="utf-8")
    a, ret, rev = result["activation"], result["retention"], result["review"]
    print(f"가입 {a['signups']}명 · 기록 남김 {fmt(a['made_a_record_pct'], '%')} · 7일 재방문 {fmt(ret['week1_pct'], '%')} · "
          f"복습 정답 {fmt(rev['correct_pct'], '%')} -> {out}")


if __name__ == "__main__":
    main()
