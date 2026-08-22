from datetime import datetime

from pydantic import BaseModel, Field,ConfigDict
from typing import Optional, List

class CategoryCreate(BaseModel):
    name: str = Field(max_length=50)
    parent_id: Optional[int] = None
class CategoryBulk(BaseModel):
    categories:list[CategoryCreate]

class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    parent_id: int | None = None

class CategoryResponse(BaseModel):
    id: int
    name: str
    children: list["CategoryResponse"] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)
    updated_at:datetime
    created_at:datetime
class CategorySummary(BaseModel):
    id: int
    name: str
