from fastapi import APIRouter

router = APIRouter()


@router.get('/reviews')
def list_reviews():
    return []
