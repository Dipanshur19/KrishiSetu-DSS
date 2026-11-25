"""Read-only smoke checks for a running local demo. Run test_app.py for the full lifecycle."""
import json
import urllib.request

BASE = "http://127.0.0.1:8000"
client = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def request(path, headers=None, data=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    with client.open(req, timeout=30) as response:
        return response.read()


if __name__ == "__main__":
    assert b"_next/static" in request("/")
    for email, path in [("farmer@demo", "/api/farmer/my-applications"), ("bank@demo", "/api/bank/applications"),
                        ("govt@demo", "/api/govt/district-heatmap")]:
        session = json.loads(request("/api/auth/login", data={"email":email}))
        token = {"Authorization": "Bearer " + session["access_token"]}
        rows = json.loads(request(path, token))
        assert isinstance(rows, list)
        request("/api/auth/logout", token, {})
        print(email, len(rows), "records")
    print("Frontend and three authenticated workspaces passed.")
