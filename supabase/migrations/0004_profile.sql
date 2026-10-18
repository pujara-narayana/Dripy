-- Picked at sign-up and changeable in Settings:
-- gender: which demo closet and shop the user gets (women | men).
-- spend_limit_cents: the most the agent may spend on one purchase (null = the server cap).
alter table users add column if not exists gender text check (gender in ('women', 'men'));
alter table users add column if not exists spend_limit_cents integer check (spend_limit_cents > 0);
