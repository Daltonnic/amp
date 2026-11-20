-- Daily check-in: "How are you today?" now allows several feelings.
-- Replaces the single `emotional_state` column with an `emotions` array,
-- carrying any existing value over.

alter table public.check_ins add column emotions text[] not null default '{}';

update public.check_ins
set emotions = array[emotional_state]
where emotional_state <> '';

alter table public.check_ins drop column emotional_state;

alter table public.check_ins
  add constraint check_ins_emotions_limit check (cardinality(emotions) <= 20);
