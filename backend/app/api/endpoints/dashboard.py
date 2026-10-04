from fastapi import APIRouter
from app.schemas import DashboardOverview, DashboardActivity

router = APIRouter()

@router.get("/dashboard/overview", response_model=DashboardOverview)
def get_dashboard_overview():
    return DashboardOverview(
        events_count=12482,
        active_alerts=17,
        open_incidents=4,
        high_risk_users=6,
        monitored_hosts=38,
        event_activity=[],
        risk_distribution={},
        recent_events=[],
        recent_alerts=[]
    )

@router.get("/dashboard/activity", response_model=DashboardActivity)
def get_dashboard_activity(hours: int = 24):
    return DashboardActivity(
        hours=hours,
        points=[]
    )
