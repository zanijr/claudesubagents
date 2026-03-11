"""Task CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from ..models import (
    TaskCreate, TaskUpdate, TaskResponse,
    PaginatedResponse, paginate, Priority, Status,
)
from .. import database as db

router = APIRouter()


@router.post("/tasks", status_code=201, response_model=TaskResponse)
def create_task(task: TaskCreate):
    # Verify project exists
    project = db.get_project(task.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = db.create_task(
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        priority=task.priority.value,
        status=task.status.value,
        due_date=task.due_date.isoformat() if task.due_date else None,
        assigned_to=task.assigned_to,
    )
    return result


@router.get("/tasks", response_model=PaginatedResponse[TaskResponse])
def list_tasks(
    status: Optional[Status] = None,
    priority: Optional[Priority] = None,
    project_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    items, total = db.list_tasks(
        status=status.value if status else None,
        priority=priority.value if priority else None,
        project_id=project_id,
        page=page,
        per_page=per_page,
    )
    return paginate(items, total, page, per_page)


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int):
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, updates: TaskUpdate):
    # Non-nullable columns — reject explicit null for these
    non_nullable = ("title", "project_id", "priority", "status")

    # Build update dict from set fields
    fields = {}
    for field_name, value in updates.model_dump(exclude_unset=True).items():
        if value is None and field_name in non_nullable:
            raise HTTPException(
                status_code=422, detail=f"Field '{field_name}' cannot be null"
            )
        if value is not None or field_name in updates.model_fields_set:
            if field_name == "due_date" and value is not None:
                fields[field_name] = value.isoformat()
            elif field_name in ("priority", "status") and value is not None:
                fields[field_name] = value.value if hasattr(value, "value") else value
            else:
                fields[field_name] = value

    # Verify project exists if project_id is being changed
    if "project_id" in fields:
        project = db.get_project(fields["project_id"])
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    result = db.update_task(task_id, **fields)
    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return result


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int):
    if not db.delete_task(task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return None
