"""Uvicorn entry point: python -m task_manager"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("task_manager.app:app", host="0.0.0.0", port=8000, reload=True)
