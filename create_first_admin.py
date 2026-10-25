import getpass
import json
import urllib.error
import urllib.request

url = "http://127.0.0.1:8000/api/v1/auth/bootstrap"

print("=== Cyber DNA First Administrator Setup ===")
secret = getpass.getpass("Bootstrap secret: ")
username = input("Administrator username: ").strip()
email = input("Administrator email (optional): ").strip() or None
organization = input("Organization name: ").strip()
password = getpass.getpass("New administrator password (minimum 12 characters): ")
confirm = getpass.getpass("Confirm password: ")

if password != confirm:
    raise SystemExit("Passwords do not match.")
if len(password) < 12:
    raise SystemExit("Password must be at least 12 characters.")
if len(username) < 3 or len(organization) < 2:
    raise SystemExit("Username must have at least 3 characters and organization at least 2.")

body = {
    "bootstrap_secret": secret,
    "username": username,
    "email": email,
    "password": password,
    "organization_name": organization,
}

request = urllib.request.Request(
    url,
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=15) as response:
        result = json.loads(response.read().decode())
        print("\nAdministrator created successfully.")
        print("Username:", result.get("username"))
        print("Organization ID:", result.get("organization_id"))
        print("You can now sign in through Cyber DNA.")
except urllib.error.HTTPError as exc:
    print(f"\nSetup failed: HTTP {exc.code}")
    print(exc.read().decode()[:1000])
except urllib.error.URLError as exc:
    print("\nCannot reach the backend:", exc.reason)
