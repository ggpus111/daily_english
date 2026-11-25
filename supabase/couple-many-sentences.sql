-- 친구·연인 문장을 하루에 여러 번 보낼 수 있게 바꾼다(2026-11-26).
-- Supabase 대시보드 > SQL Editor에 붙여 넣고 Run. schema.sql 전체를 다시 돌려도 같은 결과다.

-- 1. 날짜당 한 문장 제약을 풀고, 짝·날짜로 찾는 색인을 둔다.
alter table public.couple_sentences drop constraint if exists couple_sentences_couple_id_user_id_day_key;
create index if not exists couple_sentences_couple_day_idx on public.couple_sentences (couple_id, day);

-- 2. 새 문장 알림: 여러 번 보내도 아직 안 나간 알림이 있으면 하나만 남긴다.
-- 새 문장이 올라오면, 알림을 켠 상대의 웹 알림 대기열에 넣는다. 보낸 사람 이름만 넣고 문장 내용은 담지 않는다.
-- 보내는 일은 서버 함수 send-reminders가 10분마다 한다. 고쳐 쓴 문장(update)에는 다시 알리지 않는다.
-- 하루에 여러 번 보낼 수 있어서, 같은 사람에게 아직 안 나간 새 문장 알림이 있으면 하나만 남긴다.
create or replace function public.notify_partner_of_sentence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
  sender text;
begin
  select nickname into sender from couple_members where couple_id = new.couple_id and user_id = new.user_id;
  for member in
    select user_id, notify_lang from couple_members
    where couple_id = new.couple_id and user_id <> new.user_id and notify
  loop
    if exists (
      select 1 from push_queue
      where user_id = member.user_id and kind = 'couple'
        and title in ('새 문장이 도착했어요', 'A new sentence for you')
        and send_at > now() - interval '10 minutes'
    ) then
      continue;
    end if;
    insert into push_queue (user_id, send_at, kind, title, body, url)
    values (
      member.user_id,
      now(),
      'couple',
      case when member.notify_lang = 'ko' then '새 문장이 도착했어요' else 'A new sentence for you' end,
      case when member.notify_lang = 'ko' then coalesce(sender, '상대') || '님이 새 문장을 보냈어요.'
           else coalesce(sender, 'Someone') || ' sent you a new sentence.' end,
      '/#couple'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists couple_sentence_notify on public.couple_sentences;
create trigger couple_sentence_notify
  after insert on public.couple_sentences
  for each row execute function public.notify_partner_of_sentence();
