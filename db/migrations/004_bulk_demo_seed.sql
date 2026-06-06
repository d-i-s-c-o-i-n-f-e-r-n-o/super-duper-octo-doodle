create table if not exists demo_seed_runs (
  seed_key text primary key,
  applied_at timestamptz not null default now()
);

insert into demo_seed_runs(seed_key)
values ('bulk_demo_seed_v20260503_fast_noop')
on conflict (seed_key) do nothing;
