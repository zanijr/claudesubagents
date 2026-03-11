"""Tests for task CRUD endpoints."""


class TestCreateTask:
    def test_create_task(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "New Task",
            "description": "Some description",
            "priority": "high",
            "status": "todo",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Task"
        assert data["priority"] == "high"
        assert data["project_id"] == sample_project["id"]

    def test_create_task_missing_title(self, client, sample_project):
        resp = client.post("/tasks", json={"project_id": sample_project["id"]})
        assert resp.status_code == 422

    def test_create_task_title_too_long(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "x" * 201,
        })
        assert resp.status_code == 422

    def test_create_task_invalid_project_id(self, client):
        resp = client.post("/tasks", json={
            "project_id": 99999,
            "title": "Orphan Task",
        })
        assert resp.status_code == 404

    def test_create_task_with_due_date(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "Due Task",
            "due_date": "2026-12-31",
        })
        assert resp.status_code == 201
        assert resp.json()["due_date"] == "2026-12-31"

    def test_create_task_defaults(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "Defaults Task",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["priority"] == "medium"
        assert data["status"] == "todo"


class TestListTasks:
    def test_list_tasks(self, client, sample_data):
        resp = client.get("/tasks")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 12  # 3 projects * 4 tasks

    def test_list_tasks_filter_by_status(self, client, sample_data):
        resp = client.get("/tasks", params={"status": "todo"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0
        for item in data["items"]:
            assert item["status"] == "todo"

    def test_list_tasks_filter_by_priority(self, client, sample_data):
        resp = client.get("/tasks", params={"priority": "high"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0
        for item in data["items"]:
            assert item["priority"] == "high"

    def test_list_tasks_filter_by_project_id(self, client, sample_data):
        projects, _ = sample_data
        pid = projects[0]["id"]
        resp = client.get("/tasks", params={"project_id": pid})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 4
        for item in data["items"]:
            assert item["project_id"] == pid

    def test_list_tasks_pagination(self, client, sample_data):
        resp = client.get("/tasks", params={"page": 1, "per_page": 5})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 5
        assert data["total"] == 12
        assert data["pages"] == 3

    def test_list_tasks_combined_filters(self, client, sample_data):
        projects, _ = sample_data
        pid = projects[0]["id"]
        resp = client.get("/tasks", params={"project_id": pid, "status": "todo"})
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["project_id"] == pid
            assert item["status"] == "todo"


class TestGetTask:
    def test_get_task_by_id(self, client, sample_task):
        resp = client.get(f"/tasks/{sample_task['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == sample_task["id"]
        assert data["title"] == sample_task["title"]

    def test_get_nonexistent_task(self, client):
        resp = client.get("/tasks/99999")
        assert resp.status_code == 404


class TestUpdateTask:
    def test_update_task_status(self, client, sample_task):
        resp = client.put(f"/tasks/{sample_task['id']}", json={"status": "done"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "done"

    def test_update_task_title(self, client, sample_task):
        resp = client.put(f"/tasks/{sample_task['id']}", json={"title": "Updated Title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    def test_update_task_priority(self, client, sample_task):
        resp = client.put(f"/tasks/{sample_task['id']}", json={"priority": "critical"})
        assert resp.status_code == 200
        assert resp.json()["priority"] == "critical"

    def test_update_nonexistent_task(self, client):
        resp = client.put("/tasks/99999", json={"title": "Nope"})
        assert resp.status_code == 404

    def test_update_preserves_other_fields(self, client, sample_task):
        resp = client.put(f"/tasks/{sample_task['id']}", json={"status": "in_progress"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "in_progress"
        assert data["title"] == sample_task["title"]
        assert data["priority"] == sample_task["priority"]


class TestDeleteTask:
    def test_delete_task(self, client, sample_task):
        resp = client.delete(f"/tasks/{sample_task['id']}")
        assert resp.status_code == 204
        # Verify it's gone
        resp = client.get(f"/tasks/{sample_task['id']}")
        assert resp.status_code == 404

    def test_delete_nonexistent_task(self, client):
        resp = client.delete("/tasks/99999")
        assert resp.status_code == 404
