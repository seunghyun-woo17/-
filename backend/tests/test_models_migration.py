from app.models import Base

EXPECTED_TABLES = {
    "vessel_master", "vessel_bom", "vessel_notes", "vessel_docs",
    "suppliers", "bom_catalog",
    "po_header", "po_line", "po_counter",
    "inventory", "incoming_header", "incoming_line",
    "inspection_cert", "outgoing_log", "defect_log",
    "delivery_schedule",
    "fat_master", "fat_history", "fat_comment", "fat_comment_codes",
    "fat_ref_docs", "med_cert",
    "file_object",
}


def test_metadata_registers_all_23_tables():
    assert set(Base.metadata.tables.keys()) == EXPECTED_TABLES


def test_every_business_table_has_version_and_timestamps():
    skip = set()  # all tables carry the mixins in B1
    for name, table in Base.metadata.tables.items():
        cols = set(table.c.keys())
        assert "created_at" in cols, name
        assert "updated_at" in cols, name
        assert "version" in cols, name
        assert "id" in cols, name
