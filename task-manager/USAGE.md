# Task Manager API -- Usage Guide

A task management backend built with FastAPI and SQLite. Organize work into projects, create and track tasks with priorities, statuses, due dates, and assignees.

## Table of Contents

- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Root](#root)
  - [Projects](#projects)
  - [Tasks](#tasks)
  - [Statistics](#statistics)
  - [Import/Export](#importexport)
- [CLI Reference](#cli-reference)
- [Configuration](#configuration)

---

## Quick Start

### Prerequisites

- Python 3.10 or later
- pip

### Install Dependencies

```bash
cd task-manager

# Option A: install from requirements.txt
pip install -r requirements.txt

# Option B: install as a package (includes dev dependencies)
pip install -e ".[dev]"
```

### Start the Server

```bash
uvicorn task_manager.app:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. The SQLite database (`task_manager/tasks.db`) is created automatically on first startup.

### Verify It Works

```bash
curl http://localhost:8000/
```

Expected response:

```json
{
  "message": "Task Manager API",
  "version": "0.1.0"
}
```

### Interactive Docs

FastAPI generates interactive API documentation automatically:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## API Reference

All endpoints accept and return JSON. The base URL for all examples below is `http://localhost:8000`.

### Root

#### `GET /`

Returns API name and version.

```bash
curl http://localhost:8000/
```

Response (`200 OK`):

```json
{
  "message": "Task Manager API",
  "version": "0.1.0"
}
```

---

### Projects

#### Create a Project

`POST /projects`

| Field         | Type   | Required | Constraints        |
|---------------|--------|----------|--------------------|
| `name`        | string | yes      | 1--100 characters  |
| `description` | string | no       | max 500 characters |

```bash
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Redesign",
    "description": "Overhaul the marketing site with new branding"
  }'
```

Response (`201 Created`):

```json
{
  "id": 1,
  "name": "Website Redesign",
  "description": "Overhaul the marketing site with new branding",
  "created_at": "2026-03-11T14:22:08.123456Z"
}
```

#### List Projects

`GET /projects`

| Query Parameter | Type | Default | Constraints  |
|-----------------|------|---------|--------------|
| `page`          | int  | 1       | >= 1         |
| `per_page`      | int  | 20      | 1--100       |

```bash
curl "http://localhost:8000/projects?page=1&per_page=10"
```

Response (`200 OK`):

```json
{
  "items": [
    {
      "id": 1,
      "name": "Website Redesign",
      "description": "Overhaul the marketing site with new branding",
      "created_at": "2026-03-11T14:22:08.123456Z"
    },
    {
      "id": 2,
      "name": "Mobile App v2",
      "description": null,
      "created_at": "2026-03-11T14:23:01.654321Z"
    }
  ],
  "total": 2,
  "page": 1,
  "per_page": 10,
  "pages": 1
}
```

#### Get a Single Project

`GET /projects/{project_id}`

```bash
curl http://localhost:8000/projects/1
```

Response (`200 OK`):

```json
{
  "id": 1,
  "name": "Website Redesign",
  "description": "Overhaul the marketing site with new branding",
  "created_at": "2026-03-11T14:22:08.123456Z"
}
```

Error (`404 Not Found`):

```json
{
  "detail": "Project not found"
}
```

#### Delete a Project

`DELETE /projects/{project_id}`

Deleting a project cascades to all its tasks.

```bash
curl -X DELETE http://localhost:8000/projects/1
```

Response: `204 No Content` (empty body)

Error (`404 Not Found`):

```json
{
  "detail": "Project not found"
}
```

---

### Tasks

#### Create a Task

`POST /tasks`

| Field         | Type   | Required | Default    | Constraints                                  |
|---------------|--------|----------|------------|----------------------------------------------|
| `project_id`  | int    | yes      | --         | Must reference an existing project           |
| `title`       | string | yes      | --         | 1--200 characters                            |
| `description` | string | no       | `null`     | max 1000 characters                          |
| `priority`    | string | no       | `"medium"` | One of: `low`, `medium`, `high`, `critical`  |
| `status`      | string | no       | `"todo"`   | One of: `todo`, `in_progress`, `done`        |
| `due_date`    | string | no       | `null`     | ISO 8601 date (e.g., `2026-04-15`)           |
| `assigned_to` | string | no       | `null`     | max 100 characters                           |

```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "title": "Design new landing page mockups",
    "description": "Create three design options for stakeholder review",
    "priority": "high",
    "due_date": "2026-04-01",
    "assigned_to": "Alice Chen"
  }'
```

Response (`201 Created`):

```json
{
  "id": 1,
  "project_id": 1,
  "title": "Design new landing page mockups",
  "description": "Create three design options for stakeholder review",
  "priority": "high",
  "status": "todo",
  "due_date": "2026-04-01",
  "assigned_to": "Alice Chen",
  "created_at": "2026-03-11T14:30:00.000000Z",
  "updated_at": "2026-03-11T14:30:00.000000Z"
}
```

Error if the project does not exist (`404 Not Found`):

```json
{
  "detail": "Project not found"
}
```

#### List Tasks

`GET /tasks`

| Query Parameter | Type   | Default | Constraints                                 |
|-----------------|--------|---------|---------------------------------------------|
| `status`        | string | --      | `todo`, `in_progress`, or `done`            |
| `priority`      | string | --      | `low`, `medium`, `high`, or `critical`      |
| `project_id`    | int    | --      | Filter by project                           |
| `page`          | int    | 1       | >= 1                                        |
| `per_page`      | int    | 20      | 1--100                                      |

All filter parameters are optional and can be combined.

```bash
# List all tasks
curl http://localhost:8000/tasks

# Filter: high-priority tasks that are still to-do
curl "http://localhost:8000/tasks?priority=high&status=todo"

# Filter: all tasks in project 1, page 2
curl "http://localhost:8000/tasks?project_id=1&page=2&per_page=5"
```

Response (`200 OK`):

```json
{
  "items": [
    {
      "id": 1,
      "project_id": 1,
      "title": "Design new landing page mockups",
      "description": "Create three design options for stakeholder review",
      "priority": "high",
      "status": "todo",
      "due_date": "2026-04-01",
      "assigned_to": "Alice Chen",
      "created_at": "2026-03-11T14:30:00.000000Z",
      "updated_at": "2026-03-11T14:30:00.000000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 20,
  "pages": 1
}
```

#### Get a Single Task

`GET /tasks/{task_id}`

```bash
curl http://localhost:8000/tasks/1
```

Response (`200 OK`):

```json
{
  "id": 1,
  "project_id": 1,
  "title": "Design new landing page mockups",
  "description": "Create three design options for stakeholder review",
  "priority": "high",
  "status": "todo",
  "due_date": "2026-04-01",
  "assigned_to": "Alice Chen",
  "created_at": "2026-03-11T14:30:00.000000Z",
  "updated_at": "2026-03-11T14:30:00.000000Z"
}
```

#### Update a Task

`PUT /tasks/{task_id}`

Send only the fields you want to change. All fields are optional.

| Field         | Type   | Constraints                                  |
|---------------|--------|----------------------------------------------|
| `project_id`  | int    | Must reference an existing project           |
| `title`       | string | 1--200 characters                            |
| `description` | string | max 1000 characters                          |
| `priority`    | string | `low`, `medium`, `high`, or `critical`       |
| `status`      | string | `todo`, `in_progress`, or `done`             |
| `due_date`    | string | ISO 8601 date                                |
| `assigned_to` | string | max 100 characters                           |

```bash
# Mark a task as in-progress and reassign it
curl -X PUT http://localhost:8000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "Bob Martinez"
  }'
```

Response (`200 OK`):

```json
{
  "id": 1,
  "project_id": 1,
  "title": "Design new landing page mockups",
  "description": "Create three design options for stakeholder review",
  "priority": "high",
  "status": "in_progress",
  "due_date": "2026-04-01",
  "assigned_to": "Bob Martinez",
  "created_at": "2026-03-11T14:30:00.000000Z",
  "updated_at": "2026-03-11T15:10:42.000000Z"
}
```

```bash
# Mark a task as done
curl -X PUT http://localhost:8000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

#### Delete a Task

`DELETE /tasks/{task_id}`

```bash
curl -X DELETE http://localhost:8000/tasks/1
```

Response: `204 No Content` (empty body)

---

### Statistics

#### Get Dashboard Statistics

`GET /stats`

Returns aggregate metrics across all projects and tasks.

```bash
curl http://localhost:8000/stats
```

Response (`200 OK`):

```json
{
  "total_tasks": 12,
  "tasks_by_status": {
    "todo": 5,
    "in_progress": 4,
    "done": 3
  },
  "tasks_by_priority": {
    "low": 2,
    "medium": 6,
    "high": 3,
    "critical": 1
  },
  "overdue_tasks": 2,
  "avg_tasks_per_project": 4.0,
  "busiest_project": {
    "id": 1,
    "name": "Website Redesign",
    "task_count": 7
  }
}
```

Fields explained:

| Field                  | Description                                                            |
|------------------------|------------------------------------------------------------------------|
| `total_tasks`          | Total number of tasks across all projects                              |
| `tasks_by_status`      | Count of tasks grouped by status (`todo`, `in_progress`, `done`)       |
| `tasks_by_priority`    | Count of tasks grouped by priority (`low`, `medium`, `high`, `critical`) |
| `overdue_tasks`        | Tasks with a `due_date` in the past that are not `done`                |
| `avg_tasks_per_project`| Average number of tasks per project (rounded to 2 decimal places)      |
| `busiest_project`      | The project with the most tasks, or `null` if there are no tasks       |

---

### Import/Export

#### Export Data as JSON

`GET /export?format=json`

Downloads all projects and tasks as a JSON file.

```bash
curl -o backup.json "http://localhost:8000/export?format=json"
```

The downloaded file (`backup.json`) will contain:

```json
{
  "projects": [
    {
      "id": 1,
      "name": "Website Redesign",
      "description": "Overhaul the marketing site with new branding",
      "created_at": "2026-03-11T14:22:08.123456Z"
    }
  ],
  "tasks": [
    {
      "id": 1,
      "project_id": 1,
      "title": "Design new landing page mockups",
      "description": "Create three design options for stakeholder review",
      "priority": "high",
      "status": "in_progress",
      "due_date": "2026-04-01",
      "assigned_to": "Bob Martinez",
      "created_at": "2026-03-11T14:30:00.000000Z",
      "updated_at": "2026-03-11T15:10:42.000000Z"
    }
  ]
}
```

#### Export Data as CSV

`GET /export?format=csv`

Downloads tasks as a CSV file. Each row includes the project name for easy spreadsheet use.

```bash
curl -o tasks.csv "http://localhost:8000/export?format=csv"
```

The CSV has these columns:

```
project_name,title,description,priority,status,due_date,assigned_to
Website Redesign,Design new landing page mockups,Create three design options for stakeholder review,high,in_progress,2026-04-01,Bob Martinez
Website Redesign,Set up analytics tracking,,medium,todo,,
Mobile App v2,Implement push notifications,Add Firebase Cloud Messaging,critical,todo,2026-03-20,Alice Chen
```

#### Import Data from JSON

`POST /import?format=json`

Upload a JSON file to import projects and tasks. The JSON structure must match the export format.

```bash
curl -X POST "http://localhost:8000/import?format=json" \
  -F "file=@backup.json"
```

Response (`200 OK`):

```json
{
  "imported_projects": 2,
  "imported_tasks": 5,
  "skipped_tasks": 1
}
```

Import behavior:

- **Projects**: If a project with the same name already exists, the existing project is reused (not duplicated). New projects are created for names that do not exist yet.
- **Tasks**: Duplicate detection is based on `project_id` + `title`. If a task with the same title already exists in the same project, it is skipped.
- **ID mapping**: The original project IDs in the file are mapped to the actual IDs in the database (existing or newly created).

#### Import Data from CSV

`POST /import?format=csv`

Upload a CSV file to import tasks. The CSV must have a header row with these columns: `project_name`, `title`, `description`, `priority`, `status`, `due_date`, `assigned_to`.

First, create a CSV file (`import-tasks.csv`):

```csv
project_name,title,description,priority,status,due_date,assigned_to
Backend Services,Set up CI/CD pipeline,Configure GitHub Actions for automated testing,high,todo,2026-04-10,Dev Team
Backend Services,Write API integration tests,,medium,todo,,Alice Chen
Data Pipeline,Migrate to new data warehouse,Move from Redshift to BigQuery,critical,in_progress,2026-03-25,Data Team
```

Then import it:

```bash
curl -X POST "http://localhost:8000/import?format=csv" \
  -F "file=@import-tasks.csv"
```

Response (`200 OK`):

```json
{
  "imported_projects": 2,
  "imported_tasks": 3,
  "skipped_tasks": 0
}
```

CSV import behavior:

- Rows with an empty `project_name` or `title` are silently skipped.
- Projects are created automatically if they do not already exist.
- Duplicate detection works the same as JSON import (matching on project + title).
- If `priority` is empty, it defaults to `medium`. If `status` is empty, it defaults to `todo`.

#### Round-Trip Backup and Restore

A typical backup and restore workflow:

```bash
# Back up everything to JSON
curl -o backup-2026-03-11.json "http://localhost:8000/export?format=json"

# Later, restore to a fresh instance
curl -X POST "http://localhost:8000/import?format=json" \
  -F "file=@backup-2026-03-11.json"
```

---

## CLI Reference

> **Coming soon.** A command-line client (`task_manager/cli.py`) is planned but not yet implemented. In the meantime, use the curl-based API examples above, or the interactive Swagger UI at `http://localhost:8000/docs`.

---

## Configuration

### Environment Variables

| Variable | Description                    | Default |
|----------|--------------------------------|---------|
| `PORT`   | Port the server listens on     | `8000`  |

To run on a different port:

```bash
uvicorn task_manager.app:app --port 3000
```

### Database

The application uses SQLite with the database file stored at `task_manager/tasks.db` (relative to the project root). The database and tables are created automatically on first startup.

To reset the database, stop the server and delete the file:

```bash
rm task_manager/tasks.db
```

The database will be recreated on the next startup.

### Running in Production

For production deployments, use multiple workers and bind to all interfaces:

```bash
uvicorn task_manager.app:app --host 0.0.0.0 --port 8000 --workers 4
```

> **Note**: Since SQLite does not handle concurrent writes well, a production deployment with multiple workers may experience write contention under heavy load. Consider switching to PostgreSQL for high-concurrency scenarios.
