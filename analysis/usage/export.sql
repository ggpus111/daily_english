-- Daily English 사용 기록 내보내기(익명).
--
-- 쓰는 법: Supabase 대시보드 > SQL Editor에 이 파일 전체를 붙여 넣고 Run → 결과 표 오른쪽 위 "Export > CSV"로
-- 내려받아 analysis/usage/data/export.csv로 저장한다(이 폴더는 .gitignore로 올리지 않는다).
-- 그다음: analysis/.venv/Scripts/python -I -X utf8 analysis/usage/analyze.py
--
-- 무엇을 내보내나(개인정보 처리방침 "이용 통계"와 같은 범위):
--   - 사람은 가입 순서 번호(u001, u002 ...)로만 나온다. 이메일, 닉네임, 사용자 id는 내보내지 않는다.
--   - 일기, 대화 기록, 친구와 주고받은 문장은 내용을 내보내지 않고 글자 수만 센다.
--   - 단어·표현·문법은 "어떤 말을 많이 담고 헷갈리는지" 보려고 그 말(text, 80자까지)만 내보낸다. 뜻·예문·메모는 뺀다.
--   - 오류 기록과 문제 신고는 종류와 시각만 내보낸다(메시지 내용은 빼고).
-- SQL Editor는 관리자 권한으로 돌아가서 RLS와 상관없이 모든 사람의 기록을 읽는다. 결과 파일은 공유하지 않는다.
--
-- 결과는 한 표(kind, user_key, at, data)다. kind마다 data(JSON)에 들어 있는 값이 다르다.

with people as (
  select
    u.id,
    'u' || lpad(row_number() over (order by u.created_at, u.id)::text, 3, '0') as user_key,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null as confirmed,
    exists (select 1 from public.admins a where a.user_id = u.id) as is_admin,
    -- 학술제 시연용 계정(이메일에 +demo). 이메일 자체는 내보내지 않고 표시만 한다.
    lower(u.email) like '%+demo%' as is_demo,
    exists (select 1 from public.pro_members p where p.user_id = u.id) as is_pro,
    coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider
  from auth.users u
),
pairs as (
  select c.id, 'c' || lpad(row_number() over (order by c.created_at, c.id)::text, 3, '0') as pair_key, c.kind, c.created_at
  from public.couples c
)
select 'user' as kind, p.user_key, p.created_at as at,
  jsonb_build_object(
    'last_sign_in_at', p.last_sign_in_at, 'confirmed', p.confirmed,
    'is_admin', p.is_admin, 'is_demo', p.is_demo, 'is_pro', p.is_pro, 'provider', p.provider
  ) as data
from people p

union all
select 'record', p.user_key, r.created_at,
  jsonb_strip_nulls(jsonb_build_object(
    'type', r.type,
    'updated_at', r.updated_at,
    'box', r.data -> 'box',
    'reviews', r.data -> 'reviews',
    'misses', r.data -> 'misses',
    'due_at', r.data ->> 'dueAt',
    'source', r.data ->> 'source',
    'category', r.data ->> 'category',
    'text', case when r.type in ('word', 'expression', 'grammar') then left(r.data ->> 'text', 80) end,
    'native_len', case when r.type = 'journal' then char_length(coalesce(r.data ->> 'native', '')) end,
    'learning_len', case when r.type = 'journal' then char_length(coalesce(r.data ->> 'translation', '')) end,
    'has_ai', case when r.type = 'journal' then coalesce(r.data ->> 'aiFeedback', '') <> '' end,
    'mood', case when r.type = 'journal' then nullif(r.data ->> 'mood', '') end,
    'message_len', case when r.type = 'chat' then char_length(coalesce(r.data ->> 'message', '')) end
  ))
from public.study_records r join people p on p.id = r.user_id

union all
select 'ai', p.user_key, a.day::timestamptz, jsonb_build_object('count', a.count)
from public.ai_usage a join people p on p.id = a.user_id

union all
select 'pair', null, c.created_at, jsonb_build_object('pair', c.pair_key, 'pair_kind', c.kind)
from pairs c

union all
select 'member', p.user_key, m.joined_at, jsonb_build_object('pair', c.pair_key, 'notify', m.notify)
from public.couple_members m join people p on p.id = m.user_id join pairs c on c.id = m.couple_id

union all
select 'sentence', p.user_key, s.created_at,
  jsonb_build_object('pair', c.pair_key, 'day', s.day, 'lang', s.lang, 'length', char_length(s.body), 'sentence', s.id)
from public.couple_sentences s join people p on p.id = s.user_id join pairs c on c.id = s.couple_id

union all
select 'reaction', p.user_key, x.created_at, jsonb_build_object('sentence', x.sentence_id, 'reaction', x.kind)
from public.couple_reactions x join people p on p.id = x.user_id

union all
select 'error', p.user_key, e.created_at, jsonb_build_object('source', e.source, 'platform', e.platform, 'count', e.count)
from public.client_errors e join people p on p.id = e.user_id

union all
select 'report', p.user_key, r.created_at, jsonb_build_object('report_kind', r.kind, 'platform', r.platform, 'status', r.status)
from public.reports r join people p on p.id = r.user_id

order by kind, at;
