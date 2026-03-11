"""Tests for import/export functionality."""

import csv
import io
import json


class TestExport:
    def test_export_json(self, client, sample_data):
        resp = client.get("/export", params={"format": "json"})
        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert "projects" in data
        assert "tasks" in data
        assert len(data["projects"]) == 3
        assert len(data["tasks"]) == 12

    def test_export_json_empty_db(self, client):
        resp = client.get("/export", params={"format": "json"})
        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert data["projects"] == []
        assert data["tasks"] == []

    def test_export_csv(self, client, sample_data):
        resp = client.get("/export", params={"format": "csv"})
        assert resp.status_code == 200
        reader = csv.reader(io.StringIO(resp.text))
        rows = list(reader)
        header = rows[0]
        assert "project_name" in header
        assert "title" in header
        assert "priority" in header
        assert "status" in header
        # 12 data rows + 1 header
        assert len(rows) == 13

    def test_export_csv_columns(self, client, sample_task):
        resp = client.get("/export", params={"format": "csv"})
        reader = csv.DictReader(io.StringIO(resp.text))
        rows = list(reader)
        assert len(rows) == 1
        row = rows[0]
        assert row["project_name"] == "Test Project"
        assert row["title"] == "Test Task"
        assert row["priority"] == "medium"
        assert row["status"] == "todo"


class TestImportJSON:
    def test_import_json(self, client):
        payload = {
            "projects": [{"id": 1, "name": "Imported Proj", "description": "desc"}],
            "tasks": [
                {"project_id": 1, "title": "Imported Task", "priority": "high", "status": "todo"}
            ],
        }
        file_bytes = json.dumps(payload).encode("utf-8")
        resp = client.post(
            "/import",
            params={"format": "json"},
            files={"file": ("import.json", file_bytes, "application/json")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported_projects"] == 1
        assert data["imported_tasks"] == 1

        # Verify the data actually exists
        resp = client.get("/projects")
        assert resp.json()["total"] == 1
        resp = client.get("/tasks")
        assert resp.json()["total"] == 1

    def test_import_json_duplicate_skipping(self, client, sample_project, sample_task):
        # Export current data
        resp = client.get("/export", params={"format": "json"})
        exported = resp.content

        # Import same data again
        resp = client.post(
            "/import",
            params={"format": "json"},
            files={"file": ("import.json", exported, "application/json")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported_projects"] == 0  # project already exists
        assert data["imported_tasks"] == 0  # task skipped as duplicate
        assert data["skipped_tasks"] == 1


class TestImportCSV:
    def test_import_csv(self, client):
        csv_content = "project_name,title,description,priority,status,due_date,assigned_to\n"
        csv_content += "CSV Project,CSV Task,desc,high,todo,,\n"
        resp = client.post(
            "/import",
            params={"format": "csv"},
            files={"file": ("import.csv", csv_content.encode(), "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported_projects"] == 1
        assert data["imported_tasks"] == 1

    def test_import_csv_auto_creates_projects(self, client):
        csv_content = "project_name,title,description,priority,status,due_date,assigned_to\n"
        csv_content += "AutoProj1,Task A,,,,,\n"
        csv_content += "AutoProj2,Task B,,,,,\n"
        resp = client.post(
            "/import",
            params={"format": "csv"},
            files={"file": ("import.csv", csv_content.encode(), "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported_projects"] == 2
        assert data["imported_tasks"] == 2

    def test_import_csv_duplicate_skipping(self, client):
        csv_content = "project_name,title,description,priority,status,due_date,assigned_to\n"
        csv_content += "DupProj,DupTask,desc,medium,todo,,\n"

        # Import once
        client.post(
            "/import",
            params={"format": "csv"},
            files={"file": ("import.csv", csv_content.encode(), "text/csv")},
        )

        # Import again
        resp = client.post(
            "/import",
            params={"format": "csv"},
            files={"file": ("import.csv", csv_content.encode(), "text/csv")},
        )
        data = resp.json()
        assert data["imported_projects"] == 0
        assert data["imported_tasks"] == 0
        assert data["skipped_tasks"] == 1


class TestRoundTrip:
    def test_roundtrip_json(self, client, sample_data):
        # Export
        resp = client.get("/export", params={"format": "json"})
        exported = json.loads(resp.content)
        exported_bytes = resp.content

        # Delete everything
        for proj in exported["projects"]:
            client.delete(f"/projects/{proj['id']}")

        # Verify empty
        assert client.get("/tasks").json()["total"] == 0

        # Re-import
        resp = client.post(
            "/import",
            params={"format": "json"},
            files={"file": ("export.json", exported_bytes, "application/json")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported_projects"] == 3
        assert data["imported_tasks"] == 12

        # Verify data is back
        assert client.get("/projects").json()["total"] == 3
        assert client.get("/tasks").json()["total"] == 12
