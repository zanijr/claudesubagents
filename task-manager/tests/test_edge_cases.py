"""Edge case and validation tests."""


class TestTitleValidation:
    def test_empty_string_title_task(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "",
        })
        assert resp.status_code == 422

    def test_whitespace_only_title_task(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "   ",
        })
        # Pydantic min_length=1 counts whitespace as valid chars, so this may pass.
        # Accept either 201 (whitespace allowed) or 422 (stripped validation).
        assert resp.status_code in (201, 422)

    def test_empty_string_project_name(self, client):
        resp = client.post("/projects", json={"name": ""})
        assert resp.status_code == 422

    def test_whitespace_only_project_name(self, client):
        resp = client.post("/projects", json={"name": "   "})
        assert resp.status_code in (201, 422)


class TestDescriptionLimits:
    def test_description_at_max_length_task(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "Max desc task",
            "description": "x" * 1000,
        })
        assert resp.status_code == 201
        assert len(resp.json()["description"]) == 1000

    def test_description_over_max_length_task(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "Over desc task",
            "description": "x" * 1001,
        })
        assert resp.status_code == 422

    def test_description_at_max_length_project(self, client):
        resp = client.post("/projects", json={
            "name": "Proj",
            "description": "x" * 500,
        })
        assert resp.status_code == 201

    def test_description_over_max_length_project(self, client):
        resp = client.post("/projects", json={
            "name": "Proj",
            "description": "x" * 501,
        })
        assert resp.status_code == 422


class TestInvalidEnumValues:
    def test_invalid_priority(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "Bad priority",
            "priority": "super_urgent",
        })
        assert resp.status_code == 422

    def test_invalid_status(self, client, sample_project):
        resp = client.post("/tasks", json={
            "project_id": sample_project["id"],
            "title": "Bad status",
            "status": "cancelled",
        })
        assert resp.status_code == 422

    def test_invalid_status_filter(self, client):
        resp = client.get("/tasks", params={"status": "invalid"})
        assert resp.status_code == 422

    def test_invalid_priority_filter(self, client):
        resp = client.get("/tasks", params={"priority": "invalid"})
        assert resp.status_code == 422


class TestPaginationEdgeCases:
    def test_very_large_page_number(self, client, sample_project):
        resp = client.get("/projects", params={"page": 999999})
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []

    def test_per_page_zero(self, client):
        resp = client.get("/projects", params={"per_page": 0})
        assert resp.status_code == 422

    def test_per_page_negative(self, client):
        resp = client.get("/projects", params={"per_page": -1})
        assert resp.status_code == 422

    def test_page_zero(self, client):
        resp = client.get("/projects", params={"page": 0})
        assert resp.status_code == 422

    def test_per_page_over_max(self, client):
        resp = client.get("/projects", params={"per_page": 101})
        assert resp.status_code == 422


class TestUpdateEdgeCases:
    def test_update_task_empty_body(self, client, sample_task):
        resp = client.put(f"/tasks/{sample_task['id']}", json={})
        assert resp.status_code == 200
        # Should return unchanged task
        assert resp.json()["title"] == sample_task["title"]

    def test_update_task_invalid_status(self, client, sample_task):
        resp = client.put(f"/tasks/{sample_task['id']}", json={"status": "invalid"})
        assert resp.status_code == 422

    def test_update_task_title_too_long(self, client, sample_task):
        resp = client.put(f"/tasks/{sample_task['id']}", json={"title": "x" * 201})
        assert resp.status_code == 422


class TestExportEdgeCases:
    def test_export_invalid_format(self, client):
        resp = client.get("/export", params={"format": "xml"})
        assert resp.status_code == 422

    def test_export_missing_format(self, client):
        resp = client.get("/export")
        assert resp.status_code == 422
