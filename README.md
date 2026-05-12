## Quick Start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- MongoDB: mongodb://admin:Asdqwe123%21@localhost:27017/csv_import_service?authSource=admin
- RabbitMQ UI: http://localhost:15672

## Local Run Details

- Shared local env file: `.env` (demo values for test assignment, not production secrets)
- Frontend env file: `frontend/.env` (optional local overrides, ignored by git)
- Backend env file: `backend/.env` (optional local overrides, ignored by git)
- RabbitMQ AMQP URL: `amqp://admin:Asdqwe123!@rabbitmq:5672`
- Reset MongoDB data volume: `docker compose down -v`
