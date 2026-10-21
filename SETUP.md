# Admin + database setup

## 1. Create the free database (Supabase)
1. supabase.com > New project (choose a region close to you, set a DB password).
2. SQL Editor > New query > paste and Run:

    create table products(id bigint generated always as identity primary key, name text not null, cat text, price numeric not null, emoji text, image text, description text, stock int, active boolean default true, created_at timestamptz default now());
    create table orders(id text primary key, data jsonb, status text default 'new', created_at timestamptz default now());
    create table settings(id int primary key, data jsonb);
    alter table products enable row level security;
    alter table orders enable row level security;
    alter table settings enable row level security;

3. Project Settings > API: copy the Project URL and the `service_role` key (secret, never share it).

## 2. Add variables in Render (Environment tab)
ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_KEY (keep your existing GMAIL/TELEGRAM/CHAPA/RESEND/PUBLIC_URL).

## 3. Update GitHub
Replace server.js and package.json; add db.js; in public/ add/replace index.html, app.js, admin.html, admin.js, style.css.
Render redeploys by itself.

## 4. Use it
Open YOUR_URL/admin.html, log in, then: Shop settings (name, phone, social links, GPS, payment numbers), then Products.

## Update: Sale prices (run once in Supabase SQL Editor)

    alter table products add column if not exists old_price numeric;
