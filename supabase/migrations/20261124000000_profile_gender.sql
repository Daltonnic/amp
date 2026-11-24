-- Whether the person is a man or a woman, asked during account setup.
-- It picks which background photos they see: a man working on his own
-- recovery sees men or nature, a woman sees women or nature, and a betrayed
-- spouse (either) sees family, nature or faith-building photos. It also lets
-- the app and the Grounding Guide speak to them as a man or a woman.
-- Nullable so profiles created before this question existed keep working;
-- the app asks for it in Settings when it's missing.
alter table public.profiles
  add column gender text check (gender in ('man', 'woman'));

comment on column public.profiles.gender is 'man or woman; null if not answered yet';
