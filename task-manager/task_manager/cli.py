"""Command-line client for the Task Manager API.

Usage: python -m task_manager.cli <command> <subcommand> [options]

Uses only stdlib (argparse + urllib.request). No external dependencies.
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_API_URL = "http://localhost:8000"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _request(method, url, data=None, headers=None):
    """Send an HTTP request and return (status_code, parsed_json | raw_bytes)."""
    hdrs = headers or {}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            if resp.status == 204 or not raw:
                return resp.status, None
            ct = resp.headers.get("Content-Type", "")
            if "json" in ct:
                return resp.status, json.loads(raw)
            return resp.status, raw
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            detail = json.loads(raw)
        except Exception:
            detail = raw.decode("utf-8", errors="replace")
        return exc.code, detail


def _multipart_upload(url, filepath, field_name="file"):
    """Upload a file via multipart/form-data (stdlib only)."""
    import os
    boundary = "----PythonCLIBoundary9876543210"
    filename = os.path.basename(filepath)

    with open(filepath, "rb") as f:
        file_data = f.read()

    # Build multipart body
    lines = []
    lines.append(f"--{boundary}".encode())
    lines.append(
        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode()
    )
    lines.append(b"Content-Type: application/octet-stream")
    lines.append(b"")
    lines.append(file_data)
    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    body = b"\r\n".join(lines)

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            detail = json.loads(raw)
        except Exception:
            detail = raw.decode("utf-8", errors="replace")
        return exc.code, detail


def _api(base_url, method, path, data=None, params=None):
    """High-level API call. Returns (status, body)."""
    url = base_url.rstrip("/") + path
    if params:
        # Filter out None values
        filtered = {k: v for k, v in params.items() if v is not None}
        if filtered:
            url += "?" + urllib.parse.urlencode(filtered)
    return _request(method, url, data=data)


def _die(msg):
    """Print error to stderr and exit 1."""
    print(f"Error: {msg}", file=sys.stderr)
    sys.exit(1)


def _extract_error(body):
    """Pull a human-readable error from an API error response."""
    if isinstance(body, dict):
        if "detail" in body:
            detail = body["detail"]
            if isinstance(detail, list):
                # Validation errors
                parts = []
                for err in detail:
                    loc = " -> ".join(str(l) for l in err.get("loc", []))
                    parts.append(f"{loc}: {err.get('msg', '')}")
                return "; ".join(parts)
            return str(detail)
        return json.dumps(body)
    return str(body)


# ---------------------------------------------------------------------------
# Table formatting
# ---------------------------------------------------------------------------

def _table(rows, headers):
    """Render a list of dicts as an aligned table."""
    if not rows:
        print("(no results)")
        return

    # Compute column widths
    cols = headers
    widths = {c: len(c) for c in cols}
    str_rows = []
    for row in rows:
        sr = {}
        for c in cols:
            val = row.get(c)
            sr[c] = str(val) if val is not None else ""
            widths[c] = max(widths[c], len(sr[c]))
        str_rows.append(sr)

    # Header line
    hdr = "  ".join(h.ljust(widths[h]) for h in cols)
    sep = "  ".join("\u2500" * widths[h] for h in cols)
    print(hdr)
    print(sep)
    for sr in str_rows:
        print("  ".join(sr[h].ljust(widths[h]) for h in cols))


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

# --- Project commands ---

def cmd_project_create(args):
    data = {"name": args.name}
    if args.description:
        data["description"] = args.description
    status, body = _api(args.api_url, "POST", "/projects", data=data)
    if status == 201:
        if args.format == "json":
            print(json.dumps(body, indent=2))
        else:
            print(f"Created project {body['id']}: {body['name']}")
    else:
        _die(_extract_error(body))


def cmd_project_list(args):
    params = {"page": args.page, "per_page": args.per_page}
    status, body = _api(args.api_url, "GET", "/projects", params=params)
    if status == 200:
        if args.format == "json":
            print(json.dumps(body, indent=2))
        else:
            _table(body["items"], ["id", "name", "description", "created_at"])
            print(f"\nPage {body['page']}/{body['pages']} (total: {body['total']})")
    else:
        _die(_extract_error(body))


def cmd_project_delete(args):
    status, body = _api(args.api_url, "DELETE", f"/projects/{args.id}")
    if status == 204:
        print(f"Deleted project {args.id}")
    else:
        _die(_extract_error(body))


# --- Task commands ---

def cmd_task_create(args):
    data = {
        "project_id": args.project_id,
        "title": args.title,
    }
    if args.description:
        data["description"] = args.description
    if args.priority:
        data["priority"] = args.priority
    if args.status:
        data["status"] = args.status
    if args.due_date:
        data["due_date"] = args.due_date
    if args.assigned_to:
        data["assigned_to"] = args.assigned_to
    status, body = _api(args.api_url, "POST", "/tasks", data=data)
    if status == 201:
        if args.format == "json":
            print(json.dumps(body, indent=2))
        else:
            print(f"Created task {body['id']}: {body['title']}")
    else:
        _die(_extract_error(body))


def cmd_task_list(args):
    params = {
        "page": args.page,
        "per_page": args.per_page,
        "status": args.status,
        "priority": args.priority,
        "project_id": args.project_id,
    }
    status, body = _api(args.api_url, "GET", "/tasks", params=params)
    if status == 200:
        if args.format == "json":
            print(json.dumps(body, indent=2))
        else:
            _table(
                body["items"],
                ["id", "title", "project_id", "priority", "status", "due_date", "assigned_to"],
            )
            print(f"\nPage {body['page']}/{body['pages']} (total: {body['total']})")
    else:
        _die(_extract_error(body))


def cmd_task_update(args):
    data = {}
    if args.title is not None:
        data["title"] = args.title
    if args.description is not None:
        data["description"] = args.description
    if args.priority is not None:
        data["priority"] = args.priority
    if args.status is not None:
        data["status"] = args.status
    if args.due_date is not None:
        data["due_date"] = args.due_date
    if args.assigned_to is not None:
        data["assigned_to"] = args.assigned_to
    if not data:
        _die("No fields to update. Provide at least one of --title, --description, --priority, --status, --due-date, --assigned-to")
    status, body = _api(args.api_url, "PUT", f"/tasks/{args.id}", data=data)
    if status == 200:
        if args.format == "json":
            print(json.dumps(body, indent=2))
        else:
            print(f"Updated task {body['id']}: {body['title']}")
    else:
        _die(_extract_error(body))


def cmd_task_delete(args):
    status, body = _api(args.api_url, "DELETE", f"/tasks/{args.id}")
    if status == 204:
        print(f"Deleted task {args.id}")
    else:
        _die(_extract_error(body))


def cmd_task_assign(args):
    data = {"assigned_to": args.to}
    status, body = _api(args.api_url, "PUT", f"/tasks/{args.id}", data=data)
    if status == 200:
        if args.format == "json":
            print(json.dumps(body, indent=2))
        else:
            print(f"Assigned task {body['id']} to {body['assigned_to']}")
    else:
        _die(_extract_error(body))


# --- Stats ---

def cmd_stats_show(args):
    status, body = _api(args.api_url, "GET", "/stats")
    if status == 200:
        if args.format == "json":
            print(json.dumps(body, indent=2))
        else:
            print(f"Total tasks:           {body['total_tasks']}")
            print(f"Overdue tasks:         {body['overdue_tasks']}")
            print(f"Avg tasks/project:     {body['avg_tasks_per_project']:.1f}")
            print()
            print("Tasks by status:")
            for k, v in body.get("tasks_by_status", {}).items():
                print(f"  {k:15s} {v}")
            print()
            print("Tasks by priority:")
            for k, v in body.get("tasks_by_priority", {}).items():
                print(f"  {k:15s} {v}")
            bp = body.get("busiest_project")
            if bp:
                print()
                print(f"Busiest project:       {bp['name']} ({bp['task_count']} tasks)")
    else:
        _die(_extract_error(body))


# --- Export / Import ---

def cmd_export(args):
    params = {"format": args.format}
    status, body = _api(args.api_url, "GET", "/export", params=params)
    if status == 200:
        if isinstance(body, bytes):
            content = body.decode("utf-8")
        elif isinstance(body, dict) or isinstance(body, list):
            content = json.dumps(body, indent=2)
        else:
            content = str(body)

        if args.output:
            with open(args.output, "w") as f:
                f.write(content)
            print(f"Exported to {args.output}")
        else:
            print(content)
    else:
        _die(_extract_error(body))


def cmd_import(args):
    import os
    if not os.path.exists(args.file):
        _die(f"File not found: {args.file}")

    url = args.api_url.rstrip("/") + "/import?" + urllib.parse.urlencode({"format": args.format})
    status, body = _multipart_upload(url, args.file, field_name="file")
    if status in (200, 201):
        if isinstance(body, dict):
            print(f"Imported {body.get('imported_projects', 0)} projects, "
                  f"{body.get('imported_tasks', 0)} tasks "
                  f"(skipped {body.get('skipped_tasks', 0)} duplicates)")
        else:
            print(body)
    else:
        _die(_extract_error(body))


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------

def build_parser():
    parser = argparse.ArgumentParser(
        prog="python -m task_manager.cli",
        description="CLI client for the Task Manager API",
    )
    parser.add_argument(
        "--api-url", default=DEFAULT_API_URL,
        help=f"Base URL of the API (default: {DEFAULT_API_URL})",
    )

    subparsers = parser.add_subparsers(dest="command", help="Top-level command")

    # ── project ──────────────────────────────────────────────────────────
    project_parser = subparsers.add_parser("project", help="Manage projects")
    project_sub = project_parser.add_subparsers(dest="subcommand")

    # project create
    p_create = project_sub.add_parser("create", help="Create a project")
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--description", default=None)
    p_create.add_argument("--format", choices=["json", "table"], default="table")
    p_create.set_defaults(func=cmd_project_create)

    # project list
    p_list = project_sub.add_parser("list", help="List projects")
    p_list.add_argument("--page", type=int, default=1)
    p_list.add_argument("--per-page", type=int, default=20)
    p_list.add_argument("--format", choices=["json", "table"], default="table")
    p_list.set_defaults(func=cmd_project_list)

    # project delete
    p_del = project_sub.add_parser("delete", help="Delete a project")
    p_del.add_argument("id", type=int)
    p_del.set_defaults(func=cmd_project_delete)

    # ── task ─────────────────────────────────────────────────────────────
    task_parser = subparsers.add_parser("task", help="Manage tasks")
    task_sub = task_parser.add_subparsers(dest="subcommand")

    # task create
    t_create = task_sub.add_parser("create", help="Create a task")
    t_create.add_argument("--project-id", type=int, required=True)
    t_create.add_argument("--title", required=True)
    t_create.add_argument("--description", default=None)
    t_create.add_argument("--priority", choices=["low", "medium", "high", "critical"], default=None)
    t_create.add_argument("--status", choices=["todo", "in_progress", "done"], default=None)
    t_create.add_argument("--due-date", default=None)
    t_create.add_argument("--assigned-to", default=None)
    t_create.add_argument("--format", choices=["json", "table"], default="table")
    t_create.set_defaults(func=cmd_task_create)

    # task list
    t_list = task_sub.add_parser("list", help="List tasks")
    t_list.add_argument("--status", choices=["todo", "in_progress", "done"], default=None)
    t_list.add_argument("--priority", choices=["low", "medium", "high", "critical"], default=None)
    t_list.add_argument("--project-id", type=int, default=None)
    t_list.add_argument("--page", type=int, default=1)
    t_list.add_argument("--per-page", type=int, default=20)
    t_list.add_argument("--format", choices=["json", "table"], default="table")
    t_list.set_defaults(func=cmd_task_list)

    # task update
    t_update = task_sub.add_parser("update", help="Update a task")
    t_update.add_argument("id", type=int)
    t_update.add_argument("--title", default=None)
    t_update.add_argument("--description", default=None)
    t_update.add_argument("--priority", choices=["low", "medium", "high", "critical"], default=None)
    t_update.add_argument("--status", choices=["todo", "in_progress", "done"], default=None)
    t_update.add_argument("--due-date", default=None)
    t_update.add_argument("--assigned-to", default=None)
    t_update.add_argument("--format", choices=["json", "table"], default="table")
    t_update.set_defaults(func=cmd_task_update)

    # task delete
    t_del = task_sub.add_parser("delete", help="Delete a task")
    t_del.add_argument("id", type=int)
    t_del.set_defaults(func=cmd_task_delete)

    # task assign
    t_assign = task_sub.add_parser("assign", help="Assign a task")
    t_assign.add_argument("id", type=int)
    t_assign.add_argument("--to", required=True)
    t_assign.add_argument("--format", choices=["json", "table"], default="table")
    t_assign.set_defaults(func=cmd_task_assign)

    # ── stats ────────────────────────────────────────────────────────────
    stats_parser = subparsers.add_parser("stats", help="View statistics")
    stats_sub = stats_parser.add_subparsers(dest="subcommand")

    s_show = stats_sub.add_parser("show", help="Show stats")
    s_show.add_argument("--format", choices=["json", "table"], default="table")
    s_show.set_defaults(func=cmd_stats_show)

    # ── export ───────────────────────────────────────────────────────────
    export_parser = subparsers.add_parser("export", help="Export data")
    export_parser.add_argument("--format", choices=["json", "csv"], required=True)
    export_parser.add_argument("--output", default=None, help="Output file (default: stdout)")
    export_parser.set_defaults(func=cmd_export)

    # ── import ───────────────────────────────────────────────────────────
    import_parser = subparsers.add_parser("import", help="Import data")
    import_parser.add_argument("--format", choices=["json", "csv"], required=True)
    import_parser.add_argument("--file", required=True, help="File to import")
    import_parser.set_defaults(func=cmd_import)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command in ("project", "task", "stats") and not args.subcommand:
        # Print subcommand help
        parser.parse_args([args.command, "--help"])

    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
