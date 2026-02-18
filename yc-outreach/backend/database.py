import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "yc_outreach.db")

async def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db

async def init_db():
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            website TEXT,
            one_liner TEXT,
            long_description TEXT,
            team_size INTEGER,
            batch TEXT,
            status TEXT,
            industries TEXT DEFAULT '[]',
            tags TEXT DEFAULT '[]',
            locations TEXT DEFAULT '[]',
            is_hiring INTEGER DEFAULT 0,
            logo_url TEXT,
            yc_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            role TEXT,
            email TEXT,
            linkedin_url TEXT,
            source TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS outreach (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            contact_id INTEGER,
            status TEXT DEFAULT 'new' CHECK(status IN ('new','drafted','sent','replied','interview')),
            email_draft TEXT,
            sent_at TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_companies_batch ON companies(batch);
        CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
        CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach(status);
        CREATE INDEX IF NOT EXISTS idx_outreach_company ON outreach(company_id);

        CREATE TABLE IF NOT EXISTS agent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_name TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            company_id INTEGER,
            status TEXT DEFAULT 'info' CHECK(status IN ('success','error','info')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_name);
    """)

    # Add columns if they don't exist (safe for existing DBs)
    for stmt in [
        "ALTER TABLE companies ADD COLUMN relevance_score INTEGER DEFAULT 0",
        "ALTER TABLE outreach ADD COLUMN needs_followup INTEGER DEFAULT 0",
    ]:
        try:
            await db.execute(stmt)
            await db.commit()
        except Exception:
            pass  # Column already exists
    await db.commit()
    await db.close()

async def is_db_empty():
    db = await get_db()
    cursor = await db.execute("SELECT COUNT(*) FROM companies")
    row = await cursor.fetchone()
    count = row[0]
    await db.close()
    return count == 0
