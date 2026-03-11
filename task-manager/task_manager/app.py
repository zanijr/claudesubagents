"""FastAPI application."""

from fastapi import FastAPI
from .database import init_db
from .routes import projects, tasks, stats
from .import_export import router as import_export_router

app = FastAPI(title="Task Manager API", version="0.1.0")

# Include routers
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(stats.router)
app.include_router(import_export_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {"message": "Task Manager API", "version": "0.1.0"}
