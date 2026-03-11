"""Statistics endpoint."""

from fastapi import APIRouter
from ..models import StatsResponse
from .. import database as db

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
def get_stats():
    return db.get_stats()
