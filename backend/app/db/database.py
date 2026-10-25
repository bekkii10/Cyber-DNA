from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

connect_args = {}
if settings.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Minimal additive migration for existing installations; never drops or rewrites data.
def migrate_tenant_columns():
    from sqlalchemy import inspect, text
    tables = {"events", "users", "computers", "detection_rules", "incidents", "alerts", "ml_analysis", "sessions", "detection_findings"}
    inspector = inspect(engine)
    with engine.begin() as conn:
        existing = set(inspector.get_table_names())
        for table in sorted(tables & existing):
            columns = {column["name"] for column in inspect(conn).get_columns(table)}
            if "organization_id" not in columns:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN organization_id INTEGER"))
                try:
                    conn.execute(text(f"CREATE INDEX ix_{table}_organization_id ON {table} (organization_id)"))
                except Exception:
                    pass
        # Directory usernames and hostnames must be unique per organization, not globally.
        for table, column, index_name, composite_name in (
            ("users", "username", "ix_users_username", "uq_users_org_username"),
            ("computers", "hostname", "ix_computers_hostname", "uq_computers_org_hostname"),
        ):
            if table not in existing:
                continue
            indexes = inspect(conn).get_indexes(table)
            for index in indexes:
                if index.get("unique") and index.get("column_names") == [column]:
                    conn.execute(text(f"DROP INDEX IF EXISTS {index['name']}"))
            refreshed = inspect(conn).get_indexes(table)
            if not any(index.get("unique") and index.get("column_names") == ["organization_id", column] for index in refreshed):
                try:
                    conn.execute(text(f"CREATE UNIQUE INDEX {composite_name} ON {table} (organization_id, {column})"))
                except Exception:
                    # Existing duplicate data must be reviewed, not destructively rewritten.
                    pass

from sqlalchemy import event as sqlalchemy_event
from sqlalchemy.orm import with_loader_criteria
TENANT_MODEL_NAMES = {"Event", "User", "Computer", "Incident", "Alert", "MLAnalytics", "Session", "DetectionFinding"}
TENANT_INSERT_MODEL_NAMES = TENANT_MODEL_NAMES | {"DetectionRule"}

@sqlalchemy_event.listens_for(SessionLocal.class_, "do_orm_execute")
def _scope_tenant_queries(execute_state):
    if not execute_state.is_select:
        return
    tenant_id = execute_state.session.info.get("organization_id")
    if tenant_id is None:
        return
    from app.db import models
    for name in TENANT_MODEL_NAMES:
        model = getattr(models, name)
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(model, lambda entity: entity.organization_id == tenant_id, include_aliases=True)
        )
    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(models.DetectionRule, lambda entity: (entity.organization_id == tenant_id) | (entity.organization_id.is_(None)), include_aliases=True)
    )

@sqlalchemy_event.listens_for(SessionLocal.class_, "before_flush")
def _assign_tenant_on_insert(session, flush_context, instances):
    tenant_id = session.info.get("organization_id")
    if tenant_id is None:
        return
    from app.db import models
    for obj in session.new:
        if obj.__class__.__name__ in TENANT_INSERT_MODEL_NAMES and getattr(obj, "organization_id", None) is None:
            obj.organization_id = tenant_id
