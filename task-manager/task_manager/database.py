"""SQLite database setup and CRUD functions."""

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(__file__).parent / "tasks.db"


def get_db_path() -> Path:
    return DB_PATH


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(str(get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist."""
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'todo',
                due_date TEXT,
                assigned_to TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)


# --- Project CRUD ---

def create_project(name: str, description: Optional[str] = None) -> dict:
    now = datetime.utcnow().isoformat() + "Z"
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO projects (name, description, created_at) VALUES (?, ?, ?)",
            (name, description, now),
        )
        return {
            "id": cursor.lastrowid,
            "name": name,
            "description": description,
            "created_at": now,
        }


def list_projects(page: int = 1, per_page: int = 20) -> tuple[list[dict], int]:
    with get_connection() as conn:
        total = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        offset = (page - 1) * per_page
        rows = conn.execute(
            "SELECT * FROM projects ORDER BY id LIMIT ? OFFSET ?",
            (per_page, offset),
        ).fetchall()
        return [dict(r) for r in rows], total


def get_project(project_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (project_id,)
        ).fetchone()
        return dict(row) if row else None


def delete_project(project_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        return cursor.rowcount > 0


def get_project_by_name(name: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE name = ?", (name,)
        ).fetchone()
        return dict(row) if row else None


# --- Task CRUD ---

def create_task(
    project_id: int,
    title: str,
    description: Optional[str] = None,
    priority: str = "medium",
    status: str = "todo",
    due_date: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> dict:
    now = datetime.utcnow().isoformat() + "Z"
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO tasks
               (project_id, title, description, priority, status, due_date, assigned_to, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, title, description, priority, status, due_date, assigned_to, now, now),
        )
        return {
            "id": cursor.lastrowid,
            "project_id": project_id,
            "title": title,
            "description": description,
            "priority": priority,
            "status": status,
            "due_date": due_date,
            "assigned_to": assigned_to,
            "created_at": now,
            "updated_at": now,
        }


def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    project_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    conditions = []
    params: list[Any] = []

    if status is not None:
        conditions.append("status = ?")
        params.append(status)
    if priority is not None:
        conditions.append("priority = ?")
        params.append(priority)
    if project_id is not None:
        conditions.append("project_id = ?")
        params.append(project_id)

    where = ""
    if conditions:
        where = "WHERE " + " AND ".join(conditions)

    with get_connection() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM tasks {where}", params
        ).fetchone()[0]

        offset = (page - 1) * per_page
        rows = conn.execute(
            f"SELECT * FROM tasks {where} ORDER BY id LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ).fetchall()
        return [dict(r) for r in rows], total


def get_task(task_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return dict(row) if row else None


def update_task(task_id: int, **fields) -> Optional[dict]:
    if not fields:
        return get_task(task_id)

    now = datetime.utcnow().isoformat() + "Z"
    fields["updated_at"] = now

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [task_id]

    with get_connection() as conn:
        cursor = conn.execute(
            f"UPDATE tasks SET {set_clause} WHERE id = ?", values
        )
        if cursor.rowcount == 0:
            return None
        # Read back within same connection so we see uncommitted changes
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return dict(row) if row else None


def delete_task(task_id: int) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return cursor.rowcount > 0


def get_task_by_project_and_title(project_id: int, title: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM tasks WHERE project_id = ? AND title = ?",
            (project_id, title),
        ).fetchone()
        return dict(row) if row else None


# --- Stats ---

def get_stats() -> dict:
    with get_connection() as conn:
        total_tasks = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]

        # tasks by status
        rows = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status"
        ).fetchall()
        tasks_by_status = {r["status"]: r["cnt"] for r in rows}

        # tasks by priority
        rows = conn.execute(
            "SELECT priority, COUNT(*) as cnt FROM tasks GROUP BY priority"
        ).fetchall()
        tasks_by_priority = {r["priority"]: r["cnt"] for r in rows}

        # overdue tasks
        today = date.today().isoformat()
        overdue = conn.execute(
            "SELECT COUNT(*) FROM tasks WHERE due_date < ? AND status != 'done'",
            (today,),
        ).fetchone()[0]

        # avg tasks per project
        project_count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        avg = total_tasks / project_count if project_count > 0 else 0.0

        # busiest project
        row = conn.execute("""
            SELECT p.id, p.name, COUNT(t.id) as task_count
            FROM projects p
            LEFT JOIN tasks t ON t.project_id = p.id
            GROUP BY p.id
            ORDER BY task_count DESC
            LIMIT 1
        """).fetchone()

        busiest = None
        if row and row["task_count"] > 0:
            busiest = {"id": row["id"], "name": row["name"], "task_count": row["task_count"]}

        return {
            "total_tasks": total_tasks,
            "tasks_by_status": tasks_by_status,
            "tasks_by_priority": tasks_by_priority,
            "overdue_tasks": overdue,
            "avg_tasks_per_project": round(avg, 2),
            "busiest_project": busiest,
        }


# --- Bulk operations for import ---

def get_all_projects() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY id").fetchall()
        return [dict(r) for r in rows]


def get_all_tasks() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM tasks ORDER BY id").fetchall()
        return [dict(r) for r in rows]
