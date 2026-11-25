"""
KrishiSetu DSS - Unified Application Launcher
Starts the FastAPI application (serving both REST API and built React frontend)
Access at: http://localhost:8000
"""

import os
import sys
import uvicorn

# Ensure backend directory is in python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)

if __name__ == "__main__":
    # Ensure database is initialized and seeded
    from database import init_db
    import seed_data
    db_file = os.path.join(BACKEND_DIR, "krishisetu.db")
    if not os.path.exists(db_file):
        print("Database not found. Initializing and seeding...")
        seed_data.seed_database()
    
    port = int(os.environ.get("PORT", 8000))
    print(f"\n========================================================")
    print(f"  KrishiSetu DSS - Computer Aided Decision System")
    print(f"  Course: DMS624 / IME624 • IIT Kanpur")
    print(f"  Server starting at: http://localhost:{port}")
    print(f"========================================================\n")
    
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=False)
