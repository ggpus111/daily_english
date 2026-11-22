-- 웹 알림 예약 작업: 10분마다 서버 함수 send-reminders를 부른다.
-- schema.sql을 실행하고 함수(supabase/functions/send-reminders)를 배포한 뒤, SQL Editor에서 한 번 실행한다.
-- <PROJECT_REF>와 <ANON_KEY>를 내 프로젝트 값으로 바꾼다(Project Settings > API).
-- anon key는 공개용 키라 여기 적어도 되고, 함수는 보낼 때가 된 알림만 보내므로 누가 불러도 일찍 보내지 않는다.
-- 무료 요금제: 한 달 약 4,300번 호출(무료 한도 50만 번).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');

select cron.schedule(
  'send-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
