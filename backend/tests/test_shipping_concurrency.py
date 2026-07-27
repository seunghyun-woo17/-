"""Postgres 전용 이중 출고 동시성 검증.

두 스레드가 동시에 같은 IN_STOCK 행을 SHIPPED로 바꾸려 할 때
정확히 하나만 rowcount=1(OK), 나머지 하나는 rowcount=0(CONFLICT)이고
outgoing_log 행이 정확히 1건 생성됨을 증명한다.

실행 조건: Postgres가 localhost:5432에 기동 중이거나
          TEST_PG_URL 환경변수로 접속 가능한 DB를 지정해야 한다.
미가용 시 자동으로 SKIP(ERROR 아님) 처리된다.
"""
import concurrent.futures
import os
from datetime import date

import pytest
from sqlalchemy import create_engine, select, text, update
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.models.inventory import Inventory, OutgoingLog

PG_URL = os.environ.get(
    "TEST_PG_URL",
    "postgresql+psycopg://scmauto:scmauto@localhost:5432/scmauto",
)


@pytest.mark.postgres
def test_two_concurrent_ships_exactly_one_succeeds():
    """동시 출고 2요청 → 정확히 1성공·1충돌, 로그 1건."""
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

        # 테스트용 IN_STOCK 재고 행 1건 삽입
        s = Session()
        s.add(
            Inventory(
                mc_code="MC-1",
                item_code="ITM-001",
                serial_no="SN-CONCUR-001",
                status="IN_STOCK",
            )
        )
        s.commit()
        s.close()

        # ── 2개 스레드 동시 출고 시도 ────────────────────────────────────
        def try_ship(idx):
            sess = Session()
            try:
                res = sess.execute(
                    update(Inventory)
                    .where(
                        Inventory.mc_code == "MC-1",
                        Inventory.status == "IN_STOCK",
                    )
                    .values(
                        status="SHIPPED",
                        vessel_assigned="V-TEST",
                        version=Inventory.version + 1,
                    )
                )
                if res.rowcount == 1:
                    sess.add(
                        OutgoingLog(
                            log_id=f"OUT-CONCUR-{idx}",
                            inv_mc="MC-1",
                            inv_sn="SN-CONCUR-001",
                            action="SHIPPED",
                            date=date.today(),
                        )
                    )
                    sess.commit()
                    return "OK"
                sess.rollback()
                return "CONFLICT"
            finally:
                sess.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(try_ship, range(2)))

        # ── 검증 ─────────────────────────────────────────────────────────
        assert outcomes.count("OK") == 1, f"OK 횟수 오류: {outcomes}"
        assert outcomes.count("CONFLICT") == 1, f"CONFLICT 횟수 오류: {outcomes}"

        check = Session()
        logs = check.execute(select(OutgoingLog)).scalars().all()
        check.close()
        assert len(logs) == 1, f"outgoing_log 행 수 오류: {len(logs)}"

    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
