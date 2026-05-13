## Быстрый запуск

```bash
docker compose up --build
```

- Фронтенд: http://localhost:3000
- Бэкенд API: http://localhost:8000
- MongoDB: mongodb://admin:Asdqwe123%21@localhost:27017/csv_import_service?authSource=admin
- RabbitMQ UI: http://localhost:15672

## Окружение

В корне монорепозитория используется `.env` для локального запуска MongoDB и RabbitMQ.

## Генерация sample.csv

Сгенерировать тестовый CSV-файл в корне проекта:

```bash
npm run gen:sample
```

Файл будет создан как `./sample.csv`.

Пример с параметрами (больше строк и дубликаты VIN):

```bash
npm run gen:sample -- --rows 50000 --dups 5000 --out ./test/artifacts/sample-medium.csv
```

## API

- `POST /api/imports` — загрузка CSV, создание задачи импорта.
- `GET /api/imports/:jobId/events` — SSE-прогресс по задаче.
- `GET /api/imports/:jobId` — финальная сводка по задаче.
- `GET /api/imports` — список последних импортов.

## Архитектура

Система состоит из следующих сервисов:

- `frontend` (Next.js): интерфейс загрузки CSV, отображение прогресса, итоговой сводки и истории импортов.
- `backend` (NestJS): прием файла, создание задачи импорта, публикация чанков в RabbitMQ, выдача SSE и данных по импортам.
- `worker` (NestJS): чтение чанков из RabbitMQ, валидация строк CSV, upsert автомобилей в MongoDB, обновление прогресса и финального статуса.
- `mongodb`: хранение данных по импортам и автомобилям.
- `rabbitmq`: брокер сообщений между `backend` и `worker`.

### Backend

- Модули: `imports`, `cars`.
- `imports` отвечает за API импорта, создание job и публикацию чанков в очередь.
- Также backend отдает SSE-прогресс и методы получения сводки/истории из базы.

### Worker

- Подписывается на очередь импорта в RabbitMQ.
- Валидирует строки CSV и сохраняет валидные данные автомобилей в MongoDB.
- Обновляет прогресс задачи (`processedRows`, `successRows`, `failedRows`) и финальный статус.

### Frontend

- Реализован по FSD-подходу.
- Отправляет CSV в `POST /api/imports`.
- Подписывается на SSE-прогресс.
- Показывает сводку и последние 20 импортов.

## Проверка сценариев

- `happy path`: загрузка валидного CSV -> статус `completed`.
- `mixed`: CSV с невалидными строками -> статус `completed_with_errors`, заполнен `topErrors`.
- `failed`: инфраструктурная ошибка (например, недоступен RabbitMQ/worker) -> статус `failed`.

## Сложности

- Настройка монорепозитория и согласование конфигов между сервисами.
- Разделение ответственности между `backend` и `worker`.
- Реализация и отладка SSE + асинхронной обработки через RabbitMQ.
- Синхронизация `stream_end` и фактической обработки чанков при e2e-проверках.
