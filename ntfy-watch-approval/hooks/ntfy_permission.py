import json, os, sys, time, urllib.request, uuid

BASE = os.environ.get("NTFY_SERVER", "https://ntfy.sh")
ASK, REPLY = os.environ.get("NTFY_TOPIC"), os.environ.get("NTFY_RESPONSE_TOPIC")
if not ASK or not REPLY:
    sys.exit(0)

d = json.load(sys.stdin)
tool, inp = d.get("tool_name", ""), d.get("tool_input", {}) or {}
detail = inp.get("command") or inp.get("file_path") or inp.get("url") or json.dumps(inp, ensure_ascii=False)
project = os.path.basename(d.get("cwd", "").rstrip("/\\")) or "projekt"
rid, since = uuid.uuid4().hex[:8], int(time.time())
reply = f"{BASE}/{REPLY}"
notif_url = f"{BASE}/{ASK}/{rid}"  # sequence id = rid, pozwala usunąć powiadomienie
actions = (f"http, Allow, {reply}, method=POST, body=allow:{rid}, clear=true; "
           f"http, Deny, {reply}, method=POST, body=deny:{rid}, clear=true")
title = f"Claude ({project}): {tool}".encode("ascii", "replace").decode()


def cleanup():
    try:
        urllib.request.urlopen(urllib.request.Request(notif_url, method="DELETE"), timeout=5)
    except Exception:
        pass


try:
    urllib.request.urlopen(urllib.request.Request(
        notif_url, data=detail[:1500].encode(),
        headers={"Title": title, "Priority": "high", "Actions": actions}), timeout=10)
except Exception:
    sys.exit(0)

try:
    deadline = time.time() + 110
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{reply}/json?poll=1&since={since}", timeout=10) as r:
                for line in r.read().decode().splitlines():
                    msg = json.loads(line).get("message", "")
                    if msg in (f"allow:{rid}", f"deny:{rid}"):
                        behavior = msg.split(":")[0]
                        dec = {"behavior": behavior}
                        if behavior == "deny":
                            dec["message"] = "Odrzucono z zegarka/telefonu"
                        print(json.dumps({"hookSpecificOutput": {
                            "hookEventName": "PermissionRequest", "decision": dec}}))
                        sys.exit(0)
        except SystemExit:
            raise
        except Exception:
            pass
        time.sleep(2)
finally:
    cleanup()
