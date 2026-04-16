-- =========================
-- 1. Таблицы
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  real_name text not null,
  email text unique not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  order_index int not null unique
);

create table if not exists public.questions (
  id bigint generated always as identity primary key,
  topic_id bigint not null references public.topics(id) on delete cascade,
  order_index int not null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D'))
);

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id bigint not null references public.questions(id) on delete cascade,
  attempt_number int not null check (attempt_number in (1,2)),
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id bigint not null references public.questions(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'solved', 'failed')),
  attempts_used int not null default 0 check (attempts_used between 0 and 2),
  last_selected_option text check (last_selected_option in ('A', 'B', 'C', 'D')),
  finished_at timestamptz,
  unique(user_id, question_id)
);

create index if not exists idx_questions_topic_order on public.questions(topic_id, order_index);
create index if not exists idx_attempts_user_question on public.attempts(user_id, question_id);
create index if not exists idx_progress_user_question on public.question_progress(user_id, question_id);

-- =========================
-- 2. Включаем RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.question_progress enable row level security;

-- =========================
-- 3. Политики
-- ВАЖНО: ЗАМЕНИ admin@example.com НА СВОЙ EMAIL
-- =========================

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or auth.jwt() ->> 'email' = 'admin@example.com'
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or auth.jwt() ->> 'email' = 'admin@example.com'
)
with check (
  auth.uid() = id
  or auth.jwt() ->> 'email' = 'admin@example.com'
);

-- Topics and questions: читают все авторизованные
drop policy if exists "topics_select_authenticated" on public.topics;
create policy "topics_select_authenticated"
on public.topics
for select
to authenticated
using (true);

drop policy if exists "questions_select_authenticated" on public.questions;
create policy "questions_select_authenticated"
on public.questions
for select
to authenticated
using (true);

-- Attempts
drop policy if exists "attempts_select_own_or_admin" on public.attempts;
create policy "attempts_select_own_or_admin"
on public.attempts
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.jwt() ->> 'email' = 'admin@example.com'
);

drop policy if exists "attempts_insert_own" on public.attempts;
create policy "attempts_insert_own"
on public.attempts
for insert
to authenticated
with check (auth.uid() = user_id);

-- Question progress
drop policy if exists "progress_select_own_or_admin" on public.question_progress;
create policy "progress_select_own_or_admin"
on public.question_progress
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.jwt() ->> 'email' = 'admin@example.com'
);

drop policy if exists "progress_insert_own" on public.question_progress;
create policy "progress_insert_own"
on public.question_progress
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "progress_update_own_or_admin" on public.question_progress;
create policy "progress_update_own_or_admin"
on public.question_progress
for update
to authenticated
using (
  auth.uid() = user_id
  or auth.jwt() ->> 'email' = 'admin@example.com'
)
with check (
  auth.uid() = user_id
  or auth.jwt() ->> 'email' = 'admin@example.com'
);

-- =========================
-- 4. 5 тем
-- =========================

insert into public.topics (title, description, order_index)
values
  ('Сложение и вычитание', 'Базовые задачи на сложение и вычитание', 1),
  ('Умножение и деление', 'Легкие задачи на умножение и деление', 2),
  ('Отрицательные числа', 'Сравнение и простые действия', 3),
  ('Дроби и проценты', 'Базовые дроби, десятичные числа и проценты', 4),
  ('Простые уравнения', 'Самые простые уравнения и выражения', 5)
on conflict (order_index) do nothing;

-- =========================
-- 5. Примерные задачи
-- Можно потом добавить хоть по 100 на каждую тему
-- =========================

insert into public.questions
(topic_id, order_index, question_text, option_a, option_b, option_c, option_d, correct_option)
values
  -- topic 1
  (1, 1, '17 + 8 = ?', '23', '24', '25', '26', 'C'),
  (1, 2, '43 - 19 = ?', '24', '22', '26', '21', 'A'),
  (1, 3, '56 + 14 = ?', '60', '68', '70', '72', 'C'),

  -- topic 2
  (2, 1, '7 × 6 = ?', '42', '36', '48', '56', 'A'),
  (2, 2, '54 ÷ 6 = ?', '8', '9', '7', '6', 'B'),
  (2, 3, '9 × 4 = ?', '36', '35', '32', '38', 'A'),

  -- topic 3
  (3, 1, 'Какое число меньше?', '-3', '2', '5', '9', 'A'),
  (3, 2, '-4 + 7 = ?', '2', '1', '3', '4', 'C'),
  (3, 3, 'Поставь знак: -6 __ -2', '>', '<', '=', 'не знаю', 'B'),

  -- topic 4
  (4, 1, '1/2 = ?', '0,2', '0,5', '2,0', '1,5', 'B'),
  (4, 2, '25% от 100 = ?', '20', '30', '25', '15', 'C'),
  (4, 3, 'Сократи дробь 4/8', '1/4', '2/4', '1/2', '3/4', 'C'),

  -- topic 5
  (5, 1, 'x + 5 = 11. Найди x.', '5', '6', '7', '8', 'B'),
  (5, 2, '3x = 12. Найди x.', '2', '3', '4', '6', 'C'),
  (5, 3, 'x - 9 = 4. Найди x.', '12', '13', '14', '15', 'B');

-- =========================
-- 6. Как сделать себя admin
-- Сначала зарегистрируйся через сайт, потом выполни:
-- update public.profiles set role = 'admin' where email = 'your_email@example.com';
-- И НЕ ЗАБУДЬ ЗАМЕНИТЬ admin@example.com В ПОЛИТИКАХ ВЫШЕ.
-- =========================
