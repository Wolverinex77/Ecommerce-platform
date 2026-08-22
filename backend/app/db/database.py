import sqlalchemy
import sqlalchemy.orm
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

DATABASE_URL = settings.database_url
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
engine = sqlalchemy.create_engine(DATABASE_URL)
SessionLocal = sqlalchemy.orm.sessionmaker(bind=engine, autoflush=True, autocommit=False)

    

class Base(DeclarativeBase):
    pass    

def get_db():
    # db -> Session object
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
