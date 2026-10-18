-- Dripy core schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Every table is accessed server-side with the service-role key only; no browser
-- client ever talks to Postgres, so RLS stays off for the hackathon.

create extension if not exists "pgcrypto";

create type wardrobe_source as enum ('receipt', 'upload', 'reel', 'purchase', 'seed');
create type chat_channel    as enum ('imessage', 'sms', 'whatsapp', 'web');
create type chat_direction  as enum ('inbound', 'outbound');
create type intent_status   as enum ('proposed', 'awaiting_approval', 'approved', 'paid', 'failed', 'cancelled', 'expired');
create type intent_mode     as enum ('sandbox', 'simulated');
create type donation_kind   as enum ('thrift', 'consignment', 'donation_dropoff', 'recycling');
create type analysis_mode   as enum ('cached', 'live', 'simulated');

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,                       -- E.164; maps a Photon sender to a user
  email text,
  home_lat double precision,
  home_lng double precision,
  -- the product the user is currently discussing, so "buy it" two turns later
  -- still resolves to the right match (QA #5)
  current_match_id uuid,
  created_at timestamptz not null default now()
);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source_message_id text not null,         -- gmail id or seed filename
  retailer text,
  order_date date,
  total_cents integer,
  currency text not null default 'USD',
  parsed_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, source_message_id)
);

create table wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  brand text,
  category text not null,                  -- outerwear|top|bottom|dress|shoes|accessory
  subcategory text,                        -- e.g. 'bomber', 'blazer'
  color text,                              -- normalized basic color
  size text,
  price_cents integer,
  currency text not null default 'USD',
  source wardrobe_source not null,
  occasion_tags text[] not null default '{}',
  image_url text,
  times_worn integer not null default 0,
  last_worn_at timestamptz,
  -- receipt lineage: one row per receipt line, so re-syncing never duplicates (QA #9)
  receipt_id uuid references receipts(id) on delete cascade,
  receipt_line integer,
  created_at timestamptz not null default now(),
  unique (receipt_id, receipt_line)
);
create index on wardrobe_items (user_id);
create index on wardrobe_items (user_id, category);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel chat_channel not null,
  direction chat_direction not null,
  external_id text,                        -- Photon message id; dedupes webhook retries
  body text,
  attachments jsonb not null default '[]',
  cards jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create unique index chat_messages_external_id_uidx on chat_messages (external_id) where external_id is not null;
create index on chat_messages (user_id, created_at desc);

-- One analysis per image (screenshot) or per reel URL. Screenshots are the primary input.
create table reel_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  source_url text,                         -- reel/TikTok link, when the input was a link
  image_url text,                          -- public image actually analyzed
  cache_key text not null,                 -- sha256 of image bytes, or of the normalized URL
  identified jsonb not null default '[]',
  mode analysis_mode not null,
  created_at timestamptz not null default now()
);
create unique index reel_analyses_cache_key_uidx on reel_analyses (cache_key);

create table product_matches (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references reel_analyses(id) on delete cascade,
  name text not null,
  brand text,
  category text,
  subcategory text,
  color text,
  occasion_tags text[] not null default '{}',
  price_cents integer,
  market_median_cents integer,             -- stored so the verdict is deterministic in the demo
  currency text not null default 'USD',
  merchant text,
  merchant_domain text,
  url text not null,
  image_url text,
  rank integer not null default 0,         -- display order; matches[0] is the hero pick
  created_at timestamptz not null default now()
);
create index on product_matches (analysis_id, rank);

create table purchase_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  match_id uuid references product_matches(id) on delete set null,
  item_name text not null,
  merchant_url text not null,
  merchant_domain text not null,
  amount_cents integer not null check (amount_cents > 0),   -- from the match, never from the model
  currency text not null default 'USD',
  status intent_status not null default 'proposed',
  mode intent_mode not null,
  visa_instruction_id text,
  visa_transaction_id text,
  approved_by_message_id uuid references chat_messages(id),
  approval_expires_at timestamptz,
  confirmation_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the payment invariant, enforced by the database itself
  constraint paid_requires_approval check (status <> 'paid' or approved_by_message_id is not null)
);
create index on purchase_intents (user_id, status);
create unique index one_open_intent_per_user on purchase_intents (user_id)
  where status in ('proposed', 'awaiting_approval');

-- Append-only payment audit trail.
create table purchase_intent_events (
  id bigserial primary key,
  intent_id uuid not null references purchase_intents(id) on delete cascade,
  from_status intent_status,
  to_status intent_status not null,
  trigger text not null,                   -- model_tool|approve_endpoint|chat_affirmative|chat_negative|ttl_expiry|visa_adapter|superseded
  actor text not null,                     -- user|system|agent
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on purchase_intent_events (intent_id, created_at);

create table donation_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  kind donation_kind not null,
  hours_json jsonb not null default '{}',  -- {"mon":[["10:00","20:00"]], ...}
  maps_url text,
  phone text,
  is_seed boolean not null default false,
  created_at timestamptz not null default now()
);

create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  match_id uuid references product_matches(id) on delete set null,
  name text not null,
  brand text,
  url text,
  image_url text,
  price_cents integer,
  currency text not null default 'USD',
  added_from text,                         -- chat|reel
  created_at timestamptz not null default now()
);

-- Stretch: price-drop watches.
create table price_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wishlist_item_id uuid not null references wishlist_items(id) on delete cascade,
  target_cents integer,
  last_cents integer,
  last_checked_at timestamptz,
  status text not null default 'watching', -- watching|dropped|bought
  created_at timestamptz not null default now()
);

alter table users add constraint users_current_match_fk
  foreign key (current_match_id) references product_matches(id) on delete set null;

-- Atomic approval: only one caller can move an intent out of awaiting_approval
-- (web button and chat "yes" racing each other can never both win). QA #4.
create or replace function approve_intent(p_intent_id uuid, p_message_id uuid)
returns setof purchase_intents
language sql
as $$
  update purchase_intents
     set status = 'approved',
         approved_by_message_id = p_message_id,
         updated_at = now()
   where id = p_intent_id
     and status = 'awaiting_approval'
     and approval_expires_at > now()
  returning *;
$$;

-- Public storage buckets: SerpAPI Lens needs a public image URL.
insert into storage.buckets (id, name, public)
values ('user-uploads', 'user-uploads', true),
       ('wardrobe-images', 'wardrobe-images', true)
on conflict (id) do nothing;
