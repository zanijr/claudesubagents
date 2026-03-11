"""JSON/CSV import and export functionality."""

import csv
import io
import json
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from . import database as db
from .models import Priority, Status

VALID_PRIORITIES = {e.value for e in Priority}
VALID_STATUSES = {e.value for e in Status}

router = APIRouter()


@router.get("/export")
def export_data(format: str = Query(..., pattern="^(json|csv)$")):
    projects = db.get_all_projects()
    tasks = db.get_all_tasks()

    if format == "json":
        data = {"projects": projects, "tasks": tasks}
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=export.json"},
        )
    else:
        # CSV: export tasks with project_name column
        project_map = {p["id"]: p["name"] for p in projects}

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "project_name", "title", "description", "priority",
            "status", "due_date", "assigned_to",
        ])
        for task in tasks:
            writer.writerow([
                project_map.get(task["project_id"], ""),
                task["title"],
                task.get("description", ""),
                task["priority"],
                task["status"],
                task.get("due_date", ""),
                task.get("assigned_to", ""),
            ])

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=export.csv"},
        )


@router.post("/import")
async def import_data(
    format: str = Query(..., pattern="^(json|csv)$"),
    file: UploadFile = File(...),
):
    content = await file.read()
    imported_projects = 0
    imported_tasks = 0
    skipped_tasks = 0

    if format == "json":
        try:
            data = json.loads(content.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

        # Import projects
        project_id_map: dict[int, int] = {}  # old_id -> new_id
        for p in data.get("projects", []):
            existing = db.get_project_by_name(p["name"])
            if existing:
                project_id_map[p.get("id", 0)] = existing["id"]
            else:
                new_p = db.create_project(name=p["name"], description=p.get("description"))
                project_id_map[p.get("id", 0)] = new_p["id"]
                imported_projects += 1

        # Import tasks
        for t in data.get("tasks", []):
            project_id = project_id_map.get(t.get("project_id", 0))
            if project_id is None:
                continue

            # Skip duplicates (match by project_id + title)
            existing = db.get_task_by_project_and_title(project_id, t["title"])
            if existing:
                skipped_tasks += 1
                continue

            priority = t.get("priority", "medium")
            status = t.get("status", "todo")
            if priority not in VALID_PRIORITIES:
                skipped_tasks += 1
                continue
            if status not in VALID_STATUSES:
                skipped_tasks += 1
                continue

            db.create_task(
                project_id=project_id,
                title=t["title"],
                description=t.get("description"),
                priority=priority,
                status=status,
                due_date=t.get("due_date"),
                assigned_to=t.get("assigned_to"),
            )
            imported_tasks += 1

    else:  # CSV
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV encoding: {e}")

        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            project_name = row.get("project_name", "").strip()
            title = row.get("title", "").strip()
            if not project_name or not title:
                continue

            # Get or create project
            project = db.get_project_by_name(project_name)
            if not project:
                project = db.create_project(name=project_name)
                imported_projects += 1

            # Skip duplicates
            existing = db.get_task_by_project_and_title(project["id"], title)
            if existing:
                skipped_tasks += 1
                continue

            priority = row.get("priority", "medium") or "medium"
            status = row.get("status", "todo") or "todo"
            if priority not in VALID_PRIORITIES:
                skipped_tasks += 1
                continue
            if status not in VALID_STATUSES:
                skipped_tasks += 1
                continue

            db.create_task(
                project_id=project["id"],
                title=title,
                description=row.get("description") or None,
                priority=priority,
                status=status,
                due_date=row.get("due_date") or None,
                assigned_to=row.get("assigned_to") or None,
            )
            imported_tasks += 1

    return {
        "imported_projects": imported_projects,
        "imported_tasks": imported_tasks,
        "skipped_tasks": skipped_tasks,
    }
