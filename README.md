# Math School Platform

Статический фронт для GitHub/Vercel + Supabase.

## Что умеет
- регистрация и вход
- email confirmation
- профиль справа сверху
- 5 тем
- задачи идут по порядку
- только 4 варианта ответа
- максимум 2 попытки
- после второй ошибки показывается правильный ответ
- admin видит результаты учеников

## Файлы
- `index.html`
- `style.css`
- `script.js`

## Что нужно сделать
1. Создай проект в Supabase.
2. Включи email confirmation в Auth.
3. Открой SQL Editor и вставь `schema.sql`.
4. В `script.js` вставь:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Залей код в GitHub.
6. Лучше деплой на Vercel через GitHub repo.
7. Зарегистрируй свой аккаунт через сайт.
8. В SQL Editor выполни:
   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'your_email@example.com';
   ```

## Важно
GitHub Pages — это статический хостинг. Для auth и прогресса тут используется Supabase как внешний backend.

## Как добавить больше задач
Просто делай новые `insert into public.questions (...) values (...)`.


## Еще важно
В `schema.sql` замени `admin@example.com` на свою почту, чтобы admin-политики работали.
