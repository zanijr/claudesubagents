"""Tests for the stats endpoint."""


class TestStats:
    def test_stats_empty_db(self, client):
        resp = client.get("/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_tasks"] == 0
        assert data["tasks_by_status"] == {}
        assert data["tasks_by_priority"] == {}
        assert data["overdue_tasks"] == 0
        assert data["avg_tasks_per_project"] == 0.0
        assert data["busiest_project"] is None

    def test_stats_with_data(self, client, sample_data):
        resp = client.get("/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_tasks"] == 12

    def test_stats_tasks_by_status(self, client, sample_data):
        resp = client.get("/stats")
        data = resp.json()
        by_status = data["tasks_by_status"]
        # sample_data creates tasks with statuses cycling: todo, in_progress, done
        # 3 projects * 4 tasks, pattern per project: todo, in_progress, done, todo
        # Per project: 2 todo, 1 in_progress, 1 done => total: 6 todo, 3 in_progress, 3 done
        assert by_status["todo"] == 6
        assert by_status["in_progress"] == 3
        assert by_status["done"] == 3

    def test_stats_tasks_by_priority(self, client, sample_data):
        resp = client.get("/stats")
        data = resp.json()
        by_priority = data["tasks_by_priority"]
        # pattern per project: low, medium, high, critical => total: 3 each
        assert by_priority["low"] == 3
        assert by_priority["medium"] == 3
        assert by_priority["high"] == 3
        assert by_priority["critical"] == 3

    def test_stats_overdue_tasks(self, client, sample_data):
        resp = client.get("/stats")
        data = resp.json()
        # sample_data sets due_date="2020-01-01" for j==0 tasks (status=todo, not done)
        # That's 3 overdue tasks (one per project)
        assert data["overdue_tasks"] == 3

    def test_stats_busiest_project(self, client, sample_data):
        projects, _ = sample_data
        resp = client.get("/stats")
        data = resp.json()
        busiest = data["busiest_project"]
        assert busiest is not None
        assert busiest["task_count"] == 4
        # All projects have 4 tasks; busiest is whichever comes first
        assert busiest["id"] == projects[0]["id"]

    def test_stats_avg_tasks_per_project(self, client, sample_data):
        resp = client.get("/stats")
        data = resp.json()
        # 12 tasks / 3 projects = 4.0
        assert data["avg_tasks_per_project"] == 4.0

    def test_stats_with_single_project(self, client, sample_project, sample_task):
        resp = client.get("/stats")
        data = resp.json()
        assert data["total_tasks"] == 1
        assert data["avg_tasks_per_project"] == 1.0
        assert data["busiest_project"]["name"] == "Test Project"
