-- 원본 Daily English 앱의 기록을 새 표로 복사합니다.
--
-- 실행 순서
-- 1. 원본 앱이 쓰던 Supabase 프로젝트의 SQL Editor를 엽니다.
-- 2. supabase/schema.sql을 먼저 실행해 새 표(study_records)를 만듭니다.
-- 3. 이 파일을 실행합니다. 여러 번 실행해도 같은 기록이 두 번 들어가지 않습니다.
--
-- 원본 표(learning_records)는 읽기만 하고 바꾸거나 지우지 않습니다.
-- 문제가 생기면 study_records만 비우고 다시 실행하면 됩니다.

insert into public.study_records (id, user_id, type, data, created_at, updated_at)
select
  -- 같은 원본 기록은 항상 같은 id가 되도록 만들어 중복 복사를 막는다.
  md5(o.user_id::text || ':' || o.record_type || ':' || o.record_id)::uuid,
  o.user_id,
  o.record_type,
  case o.record_type
    when 'word' then jsonb_build_object(
      'text', coalesce(o.data ->> 'word', o.data ->> 'text', ''),
      'meaning', coalesce(o.data ->> 'meaning', ''),
      'example', coalesce(o.data ->> 'example', '')
    )
    when 'expression' then jsonb_build_object(
      'text', coalesce(o.data ->> 'expression', o.data ->> 'text', ''),
      'meaning', coalesce(o.data ->> 'meaning', ''),
      'example', coalesce(o.data ->> 'example', '')
    )
    when 'chat' then jsonb_build_object(
      'situation', coalesce(o.data ->> 'situation', ''),
      'message', coalesce(o.data ->> 'message', ''),
      'meaning', coalesce(o.data ->> 'meaning', ''),
      'category', case o.data ->> 'category'
        when '일상' then 'daily'
        when '애정 표현' then 'affection'
        when '장난' then 'joke'
        when '감정과 관계' then 'emotion'
        when '약속과 계획' then 'plans'
        when '군대 / 업무' then 'work'
        when '기타' then 'other'
        else case
          when o.data ->> 'category' in ('daily', 'affection', 'joke', 'emotion', 'plans', 'work', 'other')
            then o.data ->> 'category'
          else 'other'
        end
      end,
      'note', coalesce(o.data ->> 'note', o.data ->> 'explanation', '')
    )
    when 'journal' then jsonb_build_object(
      'native', coalesce(o.data ->> 'nativeText', o.data ->> 'native', ''),
      'translation', coalesce(o.data ->> 'translation', ''),
      'aiFeedback', '',
      'memo', coalesce(o.data ->> 'note', o.data ->> 'memo', '')
    )
  end,
  o.created_at,
  o.created_at
from (
  select
    lr.*,
    -- 원본은 Date.now() 값(밀리초)을 기록 id로 썼다. 그 값을 작성 시각으로 되살린다.
    case
      when lr.record_id ~ '^[0-9]{12,14}$' then to_timestamp(lr.record_id::bigint / 1000.0)
      else now()
    end as created_at
  from public.learning_records lr
  where lr.record_type in ('word', 'expression', 'chat', 'journal')
    and lr.user_id in (select id from auth.users)
) o
on conflict (id) do nothing;

-- 결과 확인: 종류별로 원본과 복사본 개수를 비교합니다.
-- 이미 탈퇴한 사용자의 기록과 알 수 없는 종류는 복사하지 않으므로 그만큼 차이가 날 수 있습니다.
select 'original' as source, record_type as type, count(*) from public.learning_records group by record_type
union all
select 'copied', type, count(*) from public.study_records group by type
order by type, source;
