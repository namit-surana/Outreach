import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from database import init_db, get_db, is_db_empty
from scraper import scrape_all
from email_generator import generate_emails
from agents import ScoutAgent, ReconAgent, WriterAgent, TrackerAgent, OrchestratorAgent

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if await is_db_empty():
        print("[startup] DB empty, running initial scrape...")
        count = await scrape_all()
        print(f"[startup] Scraped {count} companies")
    yield

app = FastAPI(title="YC Outreach API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])

# --- Models ---
class ContactCreate(BaseModel):
    company_id: int
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: Optional[str] = None

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: Optional[str] = None

class OutreachCreate(BaseModel):
    company_id: int
    contact_id: Optional[int] = None
    status: str = "new"
    email_draft: Optional[str] = None
    notes: Optional[str] = None

class OutreachUpdate(BaseModel):
    status: Optional[str] = None
    contact_id: Optional[int] = None
    email_draft: Optional[str] = None
    notes: Optional[str] = None
    sent_at: Optional[str] = None

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

# --- Companies ---
@app.get("/api/companies")
async def list_companies(
    batch: Optional[str] = None,
    industry: Optional[str] = None,
    tag: Optional[str] = None,
    is_hiring: Optional[bool] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
):
    db = await get_db()
    conditions = []
    params = []

    if batch:
        batches = [b.strip() for b in batch.split(",")]
        placeholders = ",".join("?" * len(batches))
        conditions.append(f"c.batch IN ({placeholders})")
        params.extend(batches)
    if industry:
        conditions.append("c.industries LIKE ?")
        params.append(f"%{industry}%")
    if tag:
        conditions.append("c.tags LIKE ?")
        params.append(f"%{tag}%")
    if is_hiring is not None:
        conditions.append("c.is_hiring = ?")
        params.append(1 if is_hiring else 0)
    if search:
        conditions.append("(c.name LIKE ? OR c.one_liner LIKE ? OR c.long_description LIKE ?)")
        s = f"%{search}%"
        params.extend([s, s, s])
    
    join_clause = ""
    if status:
        join_clause = "INNER JOIN outreach o ON o.company_id = c.id"
        conditions.append("o.status = ?")
        params.append(status)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    
    count_sql = f"SELECT COUNT(DISTINCT c.id) FROM companies c {join_clause} {where}"
    cursor = await db.execute(count_sql, params)
    total = (await cursor.fetchone())[0]

    offset = (page - 1) * per_page
    data_sql = f"""
        SELECT DISTINCT c.*, 
            (SELECT o2.status FROM outreach o2 WHERE o2.company_id = c.id ORDER BY o2.updated_at DESC LIMIT 1) as outreach_status,
            (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) as contact_count
        FROM companies c {join_clause} {where}
        ORDER BY {"c.relevance_score DESC," if sort_by == "relevance" else ""} c.is_hiring DESC, c.name ASC
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(data_sql, params + [per_page, offset])
    rows = await cursor.fetchall()
    companies = [dict(r) for r in rows]
    
    for co in companies:
        for field in ["industries", "tags", "locations"]:
            try:
                co[field] = json.loads(co[field]) if co[field] else []
            except:
                co[field] = []

    await db.close()
    return {"companies": companies, "total": total, "page": page, "per_page": per_page, "pages": (total + per_page - 1) // per_page}

@app.get("/api/companies/{company_id}")
async def get_company(company_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM companies WHERE id = ?", (company_id,))
    company = row_to_dict(await cursor.fetchone())
    if not company:
        await db.close()
        raise HTTPException(404, "Company not found")
    
    for field in ["industries", "tags", "locations"]:
        try:
            company[field] = json.loads(company[field]) if company[field] else []
        except:
            company[field] = []

    cursor = await db.execute("SELECT * FROM contacts WHERE company_id = ? ORDER BY created_at DESC", (company_id,))
    company["contacts"] = [dict(r) for r in await cursor.fetchall()]
    
    cursor = await db.execute("SELECT * FROM outreach WHERE company_id = ? ORDER BY updated_at DESC", (company_id,))
    company["outreach"] = [dict(r) for r in await cursor.fetchall()]
    
    await db.close()
    return company

# --- Contacts ---
@app.get("/api/contacts")
async def list_contacts(
    company_id: Optional[int] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
):
    db = await get_db()
    conditions = []
    params = []

    if company_id is not None:
        conditions.append("c.company_id = ?")
        params.append(company_id)
    if source:
        conditions.append("c.source = ?")
        params.append(source)
    if search:
        conditions.append("(c.name LIKE ? OR c.email LIKE ? OR c.role LIKE ?)")
        s = f"%{search}%"
        params.extend([s, s, s])
    
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    
    count_sql = f"SELECT COUNT(*) FROM contacts c {where}"
    cursor = await db.execute(count_sql, params)
    total = (await cursor.fetchone())[0]

    offset = (page - 1) * per_page
    data_sql = f"""
        SELECT c.*, co.name as company_name 
        FROM contacts c 
        JOIN companies co ON c.company_id = co.id
        {where}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
    """
    cursor = await db.execute(data_sql, params + [per_page, offset])
    rows = await cursor.fetchall()
    contacts = [dict(r) for r in rows]
    
    await db.close()
    return {"contacts": contacts, "total": total, "page": page, "per_page": per_page, "pages": (total + per_page - 1) // per_page}

@app.post("/api/contacts")
async def create_contact(data: ContactCreate):
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO contacts (company_id, name, role, email, linkedin_url, source) VALUES (?, ?, ?, ?, ?, ?)",
        (data.company_id, data.name, data.role, data.email, data.linkedin_url, data.source)
    )
    await db.commit()
    contact_id = cursor.lastrowid
    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    result = dict(await cursor.fetchone())
    await db.close()
    return result

@app.put("/api/contacts/{contact_id}")
async def update_contact(contact_id: int, data: ContactUpdate):
    db = await get_db()
    fields, values = [], []
    for k, v in data.model_dump(exclude_none=True).items():
        fields.append(f"{k} = ?")
        values.append(v)
    if not fields:
        await db.close()
        raise HTTPException(400, "No fields to update")
    values.append(contact_id)
    await db.execute(f"UPDATE contacts SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()
    cursor = await db.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
    result = row_to_dict(await cursor.fetchone())
    await db.close()
    if not result:
        raise HTTPException(404)
    return result

@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: int):
    db = await get_db()
    await db.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
    await db.commit()
    await db.close()
    return {"ok": True}

# --- Email Generator ---
@app.post("/api/companies/{company_id}/generate-email")
async def gen_email(company_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM companies WHERE id = ?", (company_id,))
    company = row_to_dict(await cursor.fetchone())
    await db.close()
    if not company:
        raise HTTPException(404)
    return {"emails": generate_emails(company)}

# --- Outreach ---
@app.post("/api/outreach")
async def create_outreach(data: OutreachCreate):
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO outreach (company_id, contact_id, status, email_draft, notes) VALUES (?, ?, ?, ?, ?)",
        (data.company_id, data.contact_id, data.status, data.email_draft, data.notes)
    )
    await db.commit()
    oid = cursor.lastrowid
    cursor = await db.execute("SELECT * FROM outreach WHERE id = ?", (oid,))
    result = dict(await cursor.fetchone())
    await db.close()
    return result

@app.patch("/api/outreach/{outreach_id}")
async def update_outreach(outreach_id: int, data: OutreachUpdate):
    db = await get_db()
    fields, values = ["updated_at = CURRENT_TIMESTAMP"], []
    for k, v in data.model_dump(exclude_none=True).items():
        fields.append(f"{k} = ?")
        values.append(v)
    values.append(outreach_id)
    await db.execute(f"UPDATE outreach SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()
    cursor = await db.execute("SELECT * FROM outreach WHERE id = ?", (outreach_id,))
    result = row_to_dict(await cursor.fetchone())
    await db.close()
    if not result:
        raise HTTPException(404)
    return result

@app.delete("/api/outreach/{outreach_id}")
async def delete_outreach(outreach_id: int):
    db = await get_db()
    await db.execute("DELETE FROM outreach WHERE id = ?", (outreach_id,))
    await db.commit()
    await db.close()
    return {"ok": True}

# --- Stats ---
@app.get("/api/stats")
async def get_stats():
    db = await get_db()
    
    cursor = await db.execute("SELECT COUNT(*) FROM companies")
    total = (await cursor.fetchone())[0]
    
    cursor = await db.execute("SELECT batch, COUNT(*) as count FROM companies GROUP BY batch ORDER BY batch")
    by_batch = {r["batch"]: r["count"] for r in await cursor.fetchall()}
    
    cursor = await db.execute("SELECT COUNT(*) FROM companies WHERE industries LIKE '%AI%' OR industries LIKE '%Machine Learning%' OR tags LIKE '%AI%' OR one_liner LIKE '%AI %' OR one_liner LIKE '%machine learning%'")
    ai_count = (await cursor.fetchone())[0]
    
    cursor = await db.execute("SELECT status, COUNT(*) as count FROM outreach GROUP BY status")
    outreach_by_status = {r["status"]: r["count"] for r in await cursor.fetchall()}
    
    total_outreach = sum(outreach_by_status.values())
    replied = outreach_by_status.get("replied", 0) + outreach_by_status.get("interview", 0)
    sent = outreach_by_status.get("sent", 0) + replied
    response_rate = round((replied / sent * 100), 1) if sent > 0 else 0
    
    cursor = await db.execute("""
        SELECT o.*, c.name as company_name, c.batch as company_batch 
        FROM outreach o JOIN companies c ON c.id = o.company_id 
        ORDER BY o.updated_at DESC LIMIT 10
    """)
    recent = [dict(r) for r in await cursor.fetchall()]
    
    cursor = await db.execute("""
        SELECT o.*, c.name as company_name, c.batch as company_batch
        FROM outreach o JOIN companies c ON c.id = o.company_id
        WHERE o.status = 'sent' AND o.sent_at IS NOT NULL 
        AND datetime(o.sent_at) < datetime('now', '-3 days')
        ORDER BY o.sent_at ASC LIMIT 10
    """)
    follow_ups = [dict(r) for r in await cursor.fetchall()]
    
    cursor = await db.execute("SELECT COUNT(*) FROM companies WHERE is_hiring = 1")
    hiring_count = (await cursor.fetchone())[0]
    
    # Agent stats
    cursor = await db.execute("SELECT COUNT(*) FROM companies WHERE relevance_score > 0")
    scored_count = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM contacts WHERE source = 'recon_agent'")
    recon_contacts = (await cursor.fetchone())[0]

    # Top matches by relevance
    cursor = await db.execute("""
        SELECT id, name, slug, one_liner, batch, relevance_score, is_hiring, logo_url, industries, locations
        FROM companies WHERE relevance_score > 0
        ORDER BY relevance_score DESC LIMIT 10
    """)
    top_matches = []
    for r in await cursor.fetchall():
        d = dict(r)
        for field in ["industries", "locations"]:
            try:
                d[field] = json.loads(d[field]) if d[field] else []
            except:
                d[field] = []
        top_matches.append(d)

    cursor = await db.execute("SELECT created_at FROM agent_logs ORDER BY created_at DESC LIMIT 1")
    last_agent_row = await cursor.fetchone()
    last_agent_run = last_agent_row["created_at"] if last_agent_row else None

    await db.close()
    # Contact sources breakdown
    cursor = await db.execute("SELECT source, COUNT(*) as count FROM contacts GROUP BY source")
    contacts_by_source = {r["source"]: r["count"] for r in await cursor.fetchall()}
    
    # Total contacts
    cursor = await db.execute("SELECT COUNT(*) FROM contacts")
    total_contacts = (await cursor.fetchone())[0]
    
    return {
        "total_companies": total,
        "ai_companies": ai_count,
        "hiring_companies": hiring_count,
        "by_batch": by_batch,
        "outreach_by_status": outreach_by_status,
        "total_outreach": total_outreach,
        "response_rate": response_rate,
        "recent_activity": recent,
        "needs_follow_up": follow_ups,
        "companies_scored": scored_count,
        "recon_contacts": recon_contacts,
        "top_matches": top_matches,
        "last_agent_run": last_agent_run,
        "contacts_by_source": contacts_by_source,
        "total_contacts": total_contacts
    }

# --- Scrape ---
@app.post("/api/scrape")
async def trigger_scrape():
    count = await scrape_all()
    return {"scraped": count}

# --- Agents ---
AGENT_MAP = {
    "scout": ScoutAgent,
    "recon": ReconAgent,
    "writer": WriterAgent,
    "tracker": TrackerAgent,
}

@app.post("/api/agents/run")
async def run_all_agents():
    orchestrator = OrchestratorAgent()
    results = await orchestrator.run()
    return results

@app.post("/api/agents/run/{agent_name}")
async def run_single_agent(agent_name: str):
    cls = AGENT_MAP.get(agent_name)
    if not cls:
        raise HTTPException(400, f"Unknown agent: {agent_name}")
    agent = cls()
    result = await agent.run()
    return result

@app.get("/api/agents/logs")
async def get_agent_logs(
    agent_name: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    db = await get_db()
    conditions = []
    params = []
    if agent_name:
        conditions.append("agent_name = ?")
        params.append(agent_name)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    cursor = await db.execute(f"SELECT COUNT(*) FROM agent_logs {where}", params)
    total = (await cursor.fetchone())[0]
    cursor = await db.execute(
        f"SELECT * FROM agent_logs {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset]
    )
    logs = [dict(r) for r in await cursor.fetchall()]
    await db.close()
    return {"logs": logs, "total": total}

@app.get("/api/agents/status")
async def get_agent_status():
    db = await get_db()
    agents = ["scout", "recon", "writer", "tracker", "orchestrator"]
    status = {}
    for a in agents:
        cursor = await db.execute(
            "SELECT created_at FROM agent_logs WHERE agent_name = ? ORDER BY created_at DESC LIMIT 1", (a,)
        )
        row = await cursor.fetchone()
        status[a] = {"last_run": row["created_at"] if row else None}

    # Summary stats
    cursor = await db.execute("SELECT COUNT(*) FROM agent_logs")
    total_runs = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM companies WHERE relevance_score > 0")
    scored = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM contacts")
    recon_contacts = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT source, COUNT(*) as cnt FROM contacts GROUP BY source")
    contacts_by_source = {r["source"]: r["cnt"] for r in await cursor.fetchall()}

    cursor = await db.execute("""
        SELECT COUNT(DISTINCT company_id) FROM contacts 
        WHERE source IN ('yc_profile', 'github', 'email_pattern', 'linkedin_search')
    """)
    companies_enriched = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM outreach WHERE needs_followup = 1")
    followups = (await cursor.fetchone())[0]

    await db.close()
    return {
        "agents": status,
        "total_log_entries": total_runs,
        "companies_scored": scored,
        "recon_contacts": recon_contacts,
        "contacts_by_source": contacts_by_source,
        "companies_enriched": companies_enriched,
        "needs_followup": followups,
    }

# --- Shutdown ---
@app.post("/api/shutdown")
async def shutdown():
    import os, signal
    os.kill(os.getpid(), signal.SIGTERM)
    return {"status": "shutting down"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
