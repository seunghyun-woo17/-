"""Postgres 전용 채번 동시성 검증.

10개 스레드가 동시에 next_po_ref_no를 호출할 때
중복(duplicate) 0, 갭(gap) 0임을 SELECT...FOR UPDATE 행잠금으로 증명한다.

실행 조건: Postgres가 localhost:5432에 기동 중이거나
          TEST_PG_URL 환경변수로 접속 가능한 DB를 지정해야 한다.
미가용 시 자동으로 SKIP(ERROR 아님) 처리된다.
"""
import concurrent.futures
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.services.numbering import next_po_ref_no

PG_URL = os.environ.get(
    "TEST_PG_URL",
    "postgresql+psycopg://scmauto:scmauto@localhost:5432/scmauto",
)


@pytest.mark.postgres
def test_ten_concurrent_allocations_no_dup_no_gap():
    """10개 동시 요청 → 중복 0, 갭 0 (A-PO-260001..A-PO-260010)."""
    # ── 스킵 가드: Postgres 미가용 시 SKIP (ERROR 아님) ──────────────────
    engine = create_engine(PG_URL)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        engine.dispose()
        pytest.skip(f"Postgres 미가용: {PG_URL} ({exc})")

    # ── 스키마 초기화 ─────────────────────────────────────────────────────
    try:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)

        # ── 10개 스레드 동시 채번 ─────────────────────────────────────────
        def allocate(_):
            s = Session()
            try:
                ref = next_po_ref_no(s, year=2026)
                s.commit()
                return ref
            finally:
                s.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            refs = list(pool.map(allocate, range(10)))

        # ── 검증 ─────────────────────────────────────────────────────────
        assert len(set(refs)) == 10, f"중복 발생: {refs}"
        seqs = sorted(int(r[-4:]) for r in refs)
        assert seqs == list(range(1, 11)), f"갭 발생: {seqs}"

    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
