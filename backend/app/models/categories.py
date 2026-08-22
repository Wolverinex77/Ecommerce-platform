from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy import INTEGER,String,TIMESTAMP,text,func,ForeignKey
from datetime import datetime
from app.db.database import Base
class Category(Base):
    __tablename__='categories'
    id:Mapped[int]=mapped_column(INTEGER,primary_key=True,nullable=False)
    name:Mapped[str]=mapped_column(String,nullable=False,unique=True)
    created_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text('NOW()')
    )
    updated_at: Mapped[datetime] = mapped_column(
    TIMESTAMP(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id")
    )

    parent = relationship(
        "Category",
        remote_side=[id],
        back_populates="children"
    )

    children = relationship(
        "Category",
        back_populates="parent"
    )
    products=relationship("Product",back_populates="category") #1-M