import asyncio
import json
from database import init_db, get_db

async def add_test_companies():
    print("Initializing database...")
    await init_db()
    
    db = await get_db()
    
    print("Adding test companies...")
    # Check if we already have test data
    cursor = await db.execute("SELECT COUNT(*) FROM companies")
    count = (await cursor.fetchone())[0]
    
    if count > 0:
        print(f"Database already has {count} companies. Skipping test data.")
        await db.close()
        return
    
    # Add some test companies
    test_companies = [
        {
            "name": "TestAI",
            "slug": "testai",
            "website": "https://testai.com",
            "one_liner": "AI-powered testing platform",
            "long_description": "TestAI helps developers automate testing using artificial intelligence.",
            "team_size": 15,
            "batch": "W24",
            "status": "Active",
            "industries": json.dumps(["AI", "Developer Tools"]),
            "tags": json.dumps(["testing", "automation"]),
            "locations": json.dumps(["New York", "Remote"]),
            "is_hiring": 1,
            "relevance_score": 65,
        },
        {
            "name": "DataFlow",
            "slug": "dataflow",
            "website": "https://dataflow.io",
            "one_liner": "ML data pipeline optimization",
            "long_description": "DataFlow streamlines machine learning data pipelines for faster training and inference.",
            "team_size": 8,
            "batch": "S24",
            "status": "Active",
            "industries": json.dumps(["Machine Learning", "Data Infrastructure"]),
            "tags": json.dumps(["data", "ML", "pipelines"]),
            "locations": json.dumps(["San Francisco", "Remote"]),
            "is_hiring": 1,
            "relevance_score": 70,
        },
        {
            "name": "CodeAssist",
            "slug": "codeassist",
            "website": "https://codeassist.dev",
            "one_liner": "AI pair programmer for Python",
            "long_description": "CodeAssist uses LLMs to help Python developers write better code faster.",
            "team_size": 4,
            "batch": "W25",
            "status": "Active",
            "industries": json.dumps(["AI", "Developer Tools"]),
            "tags": json.dumps(["coding", "productivity", "Python"]),
            "locations": json.dumps(["New York", "Remote"]),
            "is_hiring": 1,
            "relevance_score": 80,
        }
    ]
    
    for company in test_companies:
        await db.execute("""
            INSERT INTO companies 
            (name, slug, website, one_liner, long_description, team_size, batch, status, industries, tags, locations, is_hiring, relevance_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            company["name"], company["slug"], company["website"], company["one_liner"], company["long_description"],
            company["team_size"], company["batch"], company["status"], company["industries"], company["tags"],
            company["locations"], company["is_hiring"], company["relevance_score"]
        ))
    
    # Add some test contacts
    test_contacts = [
        {
            "company_slug": "testai",
            "name": "Jane Smith",
            "role": "CEO & Co-founder",
            "email": "jane@testai.com",
            "source": "yc_profile"
        },
        {
            "company_slug": "dataflow",
            "name": "Michael Chen",
            "role": "CTO & Co-founder",
            "email": "michael@dataflow.io",
            "source": "github"
        }
    ]
    
    for contact in test_contacts:
        # Get company ID
        cursor = await db.execute("SELECT id FROM companies WHERE slug = ?", (contact["company_slug"],))
        company = await cursor.fetchone()
        if company:
            company_id = company["id"]
            await db.execute(
                "INSERT INTO contacts (company_id, name, role, email, source) VALUES (?, ?, ?, ?, ?)",
                (company_id, contact["name"], contact["role"], contact["email"], contact["source"])
            )
    
    await db.commit()
    await db.close()
    print("Added 3 test companies and 2 contacts to the database.")

if __name__ == "__main__":
    asyncio.run(add_test_companies())
    print("Done! You can now start the application to see test data.")