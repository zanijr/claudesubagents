"""Tests for project CRUD endpoints."""


class TestCreateProject:
    def test_create_project(self, client):
        resp = client.post("/projects", json={"name": "My Project", "description": "desc"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Project"
        assert data["description"] == "desc"
        assert "id" in data
        assert "created_at" in data

    def test_create_project_missing_name(self, client):
        resp = client.post("/projects", json={"description": "no name"})
        assert resp.status_code == 422

    def test_create_project_name_too_long(self, client):
        resp = client.post("/projects", json={"name": "x" * 101})
        assert resp.status_code == 422

    def test_create_project_name_at_max_length(self, client):
        resp = client.post("/projects", json={"name": "x" * 100})
        assert resp.status_code == 201


class TestListProjects:
    def test_list_projects_empty(self, client):
        resp = client.get("/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_projects_with_data(self, client, sample_data):
        projects, _ = sample_data
        resp = client.get("/projects")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    def test_list_projects_pagination(self, client):
        # Create 25 projects
        for i in range(25):
            client.post("/projects", json={"name": f"Project {i}"})

        resp = client.get("/projects", params={"page": 1, "per_page": 10})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 10
        assert data["total"] == 25
        assert data["page"] == 1
        assert data["per_page"] == 10
        assert data["pages"] == 3

        # Page 3 should have 5 items
        resp = client.get("/projects", params={"page": 3, "per_page": 10})
        data = resp.json()
        assert len(data["items"]) == 5


class TestGetProject:
    def test_get_project_by_id(self, client, sample_project):
        resp = client.get(f"/projects/{sample_project['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == sample_project["id"]
        assert data["name"] == sample_project["name"]

    def test_get_nonexistent_project(self, client):
        resp = client.get("/projects/99999")
        assert resp.status_code == 404


class TestDeleteProject:
    def test_delete_project(self, client, sample_project):
        resp = client.delete(f"/projects/{sample_project['id']}")
        assert resp.status_code == 204
        # Verify it's gone
        resp = client.get(f"/projects/{sample_project['id']}")
        assert resp.status_code == 404

    def test_delete_project_cascades_tasks(self, client, sample_project):
        # Create a task under the project
        client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "Cascading Task",
        })
        # Delete the project
        resp = client.delete(f"/projects/{sample_project['id']}")
        assert resp.status_code == 204
        # Tasks should also be gone
        resp = client.get("/tasks", params={"project_id": sample_project["id"]})
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_delete_nonexistent_project(self, client):
        resp = client.delete("/projects/99999")
        assert resp.status_code == 404
