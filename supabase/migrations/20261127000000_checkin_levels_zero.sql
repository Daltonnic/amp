-- Temptation and stress can be rated 0 ("none at all"), not just 1–10.
alter table public.check_ins
  drop constraint check_ins_temptation_level_check,
  drop constraint check_ins_stress_level_check,
  add constraint check_ins_temptation_level_check check (temptation_level between 0 and 10),
  add constraint check_ins_stress_level_check check (stress_level between 0 and 10);
