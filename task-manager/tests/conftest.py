"""Shared fixtures for the task manager test suite."""

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import task_manager.database as db_module
from task_manager.app import app


@pytest.fixture(autouse=True)
def _tmp_database(tmp_path):
    """Override DB_PATH so every test function gets its own empty SQLite database."""
    test_db = tmp_path / "test_tasks.db"
    db_module.DB_PATH = test_db
    db_module.init_db()
    yield
    # Restore (not strictly necessary since tmp_path is unique, but tidy)
    if test_db.exists():
        test_db.unlink()


@pytest.fixture()
def client():
    """FastAPI TestClient that skips the startup event (DB already initialised by _tmp_database)."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def sample_project(client):
    """Create and return a single project dict."""
    resp = client.post("/projects", json={"name": "Test Project", "description": "A test project"})
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture()
def sample_task(client, sample_project):
    """Create and return a single task dict (depends on sample_project)."""
    resp = client.post("/tasks", json={
        "project_id": sample_project["id"],
        "title": "Test Task",
        "description": "A test task",
        "priority": "medium",
        "status": "todo",
    })
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture()
def sample_data(client):
    """Create multiple projects and tasks, return (projects, tasks) lists."""
    projects = []
    tasks = []
    for i in range(3):
        resp = client.post("/projects", json={"name": f"Project {i}", "description": f"Desc {i}"})
        assert resp.status_code == 201
        proj = resp.json()
        projects.append(proj)

        for j in range(4):
            priorities = ["low", "medium", "high", "critical"]
            statuses = ["todo", "in_progress", "done"]
            resp = client.post("/tasks", json={
                "project_id": proj["id"],
                "title": f"Task {i}-{j}",
                "description": f"Desc {i}-{j}",
                "priority": priorities[j % len(priorities)],
                "status": statuses[j % len(statuses)],
                "due_date": "2020-01-01" if j == 0 else None,  # overdue task
            })
            assert resp.status_code == 201
            tasks.append(resp.json())

    return projects, tasks
