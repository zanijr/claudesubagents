"""Pydantic v2 models for request/response bodies."""

from datetime import date, datetime
from enum import Enum
from math import ceil
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, Field


# --- Enums ---

class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Status(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


# --- Project models ---

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: str  # ISO 8601


# --- Task models ---

class TaskCreate(BaseModel):
    project_id: int
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    priority: Priority = Priority.medium
    status: Status = Status.todo
    due_date: Optional[date] = None
    assigned_to: Optional[str] = Field(None, max_length=100)


class TaskUpdate(BaseModel):
    project_id: Optional[int] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    priority: Optional[Priority] = None
    status: Optional[Status] = None
    due_date: Optional[date] = None
    assigned_to: Optional[str] = Field(None, max_length=100)


class TaskResponse(BaseModel):
    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    created_at: str
    updated_at: str


# --- Pagination ---

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int


def paginate(items: list, total: int, page: int, per_page: int) -> dict:
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": ceil(total / per_page) if per_page > 0 else 0,
    }


# --- Stats ---

class BusiestProject(BaseModel):
    id: int
    name: str
    task_count: int


class StatsResponse(BaseModel):
    total_tasks: int
    tasks_by_status: dict[str, int]
    tasks_by_priority: dict[str, int]
    overdue_tasks: int
    avg_tasks_per_project: float
    busiest_project: Optional[BusiestProject] = None
