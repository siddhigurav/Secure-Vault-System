from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text('SELECT name FROM sqlite_master WHERE type="table";'))
    tables = [row[0] for row in result]
    print("Tables:", tables)