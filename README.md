## Quick Start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- MongoDB: mongodb://mongo_root:change_me_local@localhost:27017

## Local Run Details

- Frontend env file: `frontend/.env`
- Backend env file: `backend/.env`
- Reset MongoDB data volume: `docker compose down -v`
