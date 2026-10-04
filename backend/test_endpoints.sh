#!/bin/bash
BASE_URL="http://127.0.0.1:8000"

echo "Testing Endpoints Report" > report.txt
echo "========================" >> report.txt

check_url() {
    METHOD=$1
    ENDPOINT=$2
    PAYLOAD=$3
    
    echo -n "Testing $METHOD $ENDPOINT ... "
    
    if [ "$METHOD" == "POST" ]; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$ENDPOINT" -H "Content-Type: application/json" -d "$PAYLOAD")
        RESPONSE=$(curl -s -X POST "$BASE_URL$ENDPOINT" -H "Content-Type: application/json" -d "$PAYLOAD")
    elif [ "$METHOD" == "PATCH" ]; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL$ENDPOINT" -H "Content-Type: application/json" -d "$PAYLOAD")
        RESPONSE=$(curl -s -X PATCH "$BASE_URL$ENDPOINT" -H "Content-Type: application/json" -d "$PAYLOAD")
    else
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$ENDPOINT")
        RESPONSE=$(curl -s "$BASE_URL$ENDPOINT")
    fi
    
    echo "Status: $HTTP_STATUS" >> report.txt
    echo "Endpoint: $METHOD $ENDPOINT" >> report.txt
    echo "Response: $RESPONSE" >> report.txt
    echo "------------------------" >> report.txt
    
    if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
        echo "OK ($HTTP_STATUS)"
    elif [ "$HTTP_STATUS" -eq 404 ]; then
        echo "NOT FOUND ($HTTP_STATUS) - Expected if DB empty"
    else
        echo "ERROR ($HTTP_STATUS)"
    fi
}

check_url "GET" "/api/health" ""
check_url "GET" "/api/dashboard/overview" ""
check_url "GET" "/api/collector/status" ""

PAYLOAD='{"timestamp":"2026-10-04T06:40:12Z","event_id":4625,"username":"sifen.melaku","domain":"corp.local","logon_type":3,"source_ip":"192.168.56.102","computer":"WIN-CLIENT01","record_id":12015,"result":"FAILURE","action":"Failed logon","event_details":{}}'
check_url "POST" "/api/collector/events" "$PAYLOAD"

check_url "GET" "/api/events" ""
check_url "GET" "/api/alerts" ""
check_url "GET" "/api/incidents" ""
check_url "GET" "/api/users" ""
check_url "GET" "/api/hosts" ""

