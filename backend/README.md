# SCMAUTO ERP 백엔드

SCMAUTO ERP의 FastAPI 백엔드입니다. 이 문서는 B0(스캐폴드) 단계 기준이며,
도메인 모델과 CRUD(B1)는 아직 포함되지 않습니다.

설계 상세는 상위 폴더의 `BACKEND-DESIGN.md`를 참조하세요.

## 요구 사항

- Python 3.13
- (운영/로컬 Postgres) PostgreSQL 16 — 로컬 개발은 SQLite로도 테스트 가능

## 프로젝트 구조

```
backend/
  app/
    main.py         FastAPI 앱, 예외 핸들러 등록, health 라우터 포함
    config.py       pydantic-settings 기반 환경 설정
    database.py     SQLAlchemy 2.0 엔진/세션, get_db 의존성
    errors.py       AppError 계층 + 예외 핸들러
    deps.py         의존성 재노출(get_db)
    models/base.py  DeclarativeBase, TimestampMixin, VersionMixin
    routers/health.py  GET /api/health
    schemas/ services/  (B1에서 채움)
  migrations/       Alembic (env.py, script.py.mako, versions/)
  tests/            pytest (health 스모크 테스트)
  requirements.txt
  Dockerfile / docker-compose.yml / Caddyfile
```

## 로컬 개발 (Git Bash 기준)

아래 예시는 Windows Git Bash에서 절대경로를 사용합니다.

### 1. 가상환경 생성

```bash
cd "C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/backend"
python -m venv .venv
```

### 2. 의존성 설치

```bash
"C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/backend/.venv/Scripts/python" -m pip install -r "C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/backend/requirements.txt"
```

### 3. 테스트 실행

테스트는 in-memory SQLite를 사용하므로 별도 DB가 필요 없습니다.
`PYTHONPATH`를 backend 루트로 지정한 뒤 실행합니다.

```bash
cd "C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/backend"
PYTHONPATH="C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/backend" ".venv/Scripts/python" -m pytest tests/ -v
```

### 4. 로컬 서버 구동

```bash
cd "C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/backend"
".venv/Scripts/python" -m uvicorn app.main:app --reload
```

기동 후 헬스 체크:

```
GET http://localhost:8000/api/health
-> {"status": "ok", "db": "up"}   (DB 연결 실패 시 "db": "down", HTTP는 200 유지)
```

## 환경 변수 (.env)

`.env.example`을 복사해 `.env`를 만드세요. 파일이 없어도 기본값으로 동작합니다.

- `DATABASE_URL` — SQLAlchemy 연결 URL.
  기본값 `postgresql+psycopg://scmauto:scmauto@localhost:5432/scmauto`.
  SQLite로 시작하면 자동으로 `check_same_thread=False`가 적용됩니다.
- `ENV` — 실행 환경 문자열. 기본값 `dev`.

## 데이터베이스 마이그레이션 (Alembic)

`migrations/env.py`가 `app.config.settings`에서 `DATABASE_URL`을 읽어
`alembic.ini`의 빈 URL을 런타임에 덮어씁니다. 리비전은 B1에서 추가됩니다.

```bash
cd "C:/Users/seunghyunwoo/Desktop/github/SCMAUTO/backend"
".venv/Scripts/python" -m alembic revision --autogenerate -m "message"
".venv/Scripts/python" -m alembic upgrade head
```

## EC2 배포 (docker compose 개요)

`Dockerfile`, `docker-compose.yml`, `Caddyfile`이 포함되어 있습니다.

- `api` — FastAPI 컨테이너(uvicorn, 8000 포트).
- `postgres` — 로컬 개발 전용 DB. 운영에서는 이 서비스를 제거하고
  `api`의 `DATABASE_URL`만 RDS 엔드포인트로 바꾸면 됩니다.
- `caddy` — 리버스 프록시 + TLS. 80/443을 열고 `/api/*`를 `api:8000`으로
  프록시하며, 프론트 빌드는 `/srv/frontend`에서 정적 서빙합니다.

EC2에서:

```bash
docker compose up -d --build
```

`Caddyfile`의 도메인 자리표시자(예: `scmauto.avikus.ai`)를 실제 도메인으로
교체하면 Caddy가 자동으로 인증서를 발급합니다.
