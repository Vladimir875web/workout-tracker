# Журнал тренировок

React-приложение для записи тренировок и показателей тела (вес, талия, давление, пульс). Данные хранятся в `localStorage` браузера.

## Стек

- React 19 + Vite
- Recharts — графики прогресса
- Lucide React — иконки

## Локальный запуск

```bash
cd workout-tracker
npm install
npm run dev
```

Приложение откроется на `http://localhost:5173`.

## Сборка

```bash
npm run build
npm run preview
```

## Деплой на Vercel

1. Загрузите проект на GitHub (см. ниже).
2. Зайдите на [vercel.com](https://vercel.com) и нажмите **Add New Project**.
3. Импортируйте репозиторий с GitHub.
4. Vercel автоматически определит Vite. Настройки по умолчанию:
   - **Root Directory:** `workout-tracker` (если репозиторий содержит родительскую папку) или `.` (если репозиторий — только этот проект)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Нажмите **Deploy**.

Файл `vercel.json` уже настроен для SPA.

## Загрузка на GitHub

### Вариант A — только папка `workout-tracker` как отдельный репозиторий

```bash
cd workout-tracker
git init
git add .
git commit -m "Initial commit: workout tracker app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/workout-tracker.git
git push -u origin main
```

### Вариант B — весь каталог `cover letter`

```bash
cd "cover letter"
git init
git add workout-tracker
git commit -m "Add workout tracker app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

При деплое на Vercel укажите **Root Directory:** `workout-tracker`.

## Структура проекта

```
workout-tracker/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx       # основное приложение
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .gitignore
```
