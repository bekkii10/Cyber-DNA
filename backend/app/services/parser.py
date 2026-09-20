from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.models import RawEvent, NormalizedEvent
import datetime

class ParserService:
    @staticmethod
    def process_raw_events(db: Session, raw_events: List[Dict[str, Any]]):
        """
        Parses raw JSON events, stores them in the raw events table,
        and normalizes essential fields to store in the normalized table.
        """
        for raw_data in raw_events:
            # 1. Save raw event
            db_raw_event = RawEvent(raw_json=raw_data)
            db.add(db_raw_event)
            db.flush()  # To get the ID for normalized event
            
            # 2. Extract and Normalize data
            # Note: The specific extraction logic will depend on the exact Winlogbeat payload structure
            # This is a generic placeholder implementation based on typical Windows Event Logs
            
            event_data = raw_data.get("winlog", {})
            event_id = str(event_data.get("event_id", "Unknown"))
            
            # Try to get timestamp, default to now if not found
            timestamp_str = raw_data.get("@timestamp")
            if timestamp_str:
                try:
                    # Very basic parsing, might need adjustment based on exact format
                    from dateutil import parser
                    timestamp = parser.parse(timestamp_str)
                except:
                    timestamp = datetime.datetime.utcnow()
            else:
                timestamp = datetime.datetime.utcnow()
                
            event_data_details = event_data.get("event_data", {})
            
            # Extract common fields
            user_name = event_data_details.get("TargetUserName") or event_data_details.get("SubjectUserName")
            computer_name = event_data.get("computer_name") or raw_data.get("host", {}).get("name")
            source_ip = event_data_details.get("IpAddress")
            
            # Store normalized event
            db_normalized_event = NormalizedEvent(
                timestamp=timestamp,
                event_type=event_id,
                user_name=user_name,
                computer_name=computer_name,
                source_ip=source_ip,
                status="Processed",
                raw_event_id=db_raw_event.id
            )
            db.add(db_normalized_event)
            
        # Commit the transaction
        db.commit()
