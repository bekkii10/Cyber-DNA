from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base, SessionLocal
from app.db.models import Organization, Event, Alert, Incident, Computer, DetectionFinding
from app.services.security import hash_password, verify_password


def test_password_hash_is_salted_and_verifiable():
    first = hash_password('A-very-long-test-password-2026!')
    second = hash_password('A-very-long-test-password-2026!')
    assert first != second
    assert verify_password('A-very-long-test-password-2026!', first)
    assert not verify_password('wrong-password', first)


def test_tenant_scoped_queries_do_not_return_other_org_events():
    engine = create_engine('sqlite:///:memory:', connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    db = SessionLocal(bind=engine)
    try:
        one = Organization(name='Tenant One')
        two = Organization(name='Tenant Two')
        db.add_all([one, two]); db.flush()
        now = datetime.now(timezone.utc)
        db.add_all([
            Event(organization_id=one.id, timestamp=now, event_id=4624, username='one'),
            Event(organization_id=two.id, timestamp=now, event_id=4625, username='two'),
            Computer(organization_id=one.id, hostname='one-dc'), Computer(organization_id=two.id, hostname='two-dc'),
            Alert(organization_id=one.id, id='a-one', severity='low', time=now), Alert(organization_id=two.id, id='a-two', severity='high', time=now),
            Incident(organization_id=one.id, id='i-one', title='one', risk='low', score=1, first_seen=now, last_seen=now),
            Incident(organization_id=two.id, id='i-two', title='two', risk='high', score=90, first_seen=now, last_seen=now),
            DetectionFinding(organization_id=one.id, finding_key='f-one', engine_type='rule', detection_name='one'),
            DetectionFinding(organization_id=two.id, finding_key='f-two', engine_type='rule', detection_name='two'),
        ])
        db.commit()
        db.info['organization_id'] = one.id
        assert [row.username for row in db.query(Event).all()] == ['one']
        assert [row.hostname for row in db.query(Computer).all()] == ['one-dc']
        assert [row.id for row in db.query(Alert).all()] == ['a-one']
        assert [row.id for row in db.query(Incident).all()] == ['i-one']
        assert [row.finding_key for row in db.query(DetectionFinding).all()] == ['f-one']
    finally:
        db.close(); Base.metadata.drop_all(engine); engine.dispose()
