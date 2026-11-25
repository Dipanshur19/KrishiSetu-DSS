"""
KrishiSetu DSS - Unified Application Launcher
Starts the FastAPI application (serving both REST API and built Next.js frontend)
Supports both Supabase PostgreSQL (DATABASE_URL) and local SQLite automatically.
"""

import os
import sys
import uvicorn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)

if __name__ == "__main__":
    from database import init_db, get_db_connection, DATABASE_URL
    import seed_data

    db_file = os.path.join(BACKEND_DIR, "krishisetu.db")
    if DATABASE_URL:
        init_db()
        conn = get_db_connection()
        cnt = conn.execute("SELECT COUNT(*) FROM users_and_roles").fetchone()[0]
        conn.close()
        if cnt == 0:
            print("Supabase PostgreSQL empty. Seeding initial 160 records...")
            seed_data.seed_database()
    elif not os.path.exists(db_file):
        print("Database not found. Initializing and seeding...")
        seed_data.seed_database()

    port = int(os.environ.get("PORT", 8000))
    print("\n========================================================")
    print("  KrishiSetu DSS - Computer Aided Decision System")
    print("  Course: DMS624 / IME624 • IIT Kanpur")
    print(f"  Server starting at: http://localhost:{port}")
    print("========================================================\n")

    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
