-- Demo "card on file" for the web checkout. Only the brand and last four digits are kept;
-- the full number and CVC never leave the request that validates them.
alter table users add column if not exists card_brand text;
alter table users add column if not exists card_last4 text;
