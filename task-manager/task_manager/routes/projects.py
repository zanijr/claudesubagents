"""Project CRUD endpoints."""

from fastapi import APIRouter, HTTPException, Query
from ..models import ProjectCreate, ProjectResponse, PaginatedResponse, paginate
from .. import database as db

router = APIRouter()


@router.post("/projects", status_code=201, response_model=ProjectResponse)
def create_project(project: ProjectCreate):
    result = db.create_project(name=project.name, description=project.description)
    return result


@router.get("/projects", response_model=PaginatedResponse[ProjectResponse])
def list_projects(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100)):
    items, total = db.list_projects(page=page, per_page=per_page)
    return paginate(items, total, page, per_page)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int):
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int):
    if not db.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return None
