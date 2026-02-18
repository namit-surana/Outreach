import httpx
import json
import asyncio
from database import get_db

YC_API = "https://api.ycombinator.com/v0.1/companies"
YC_OSS_API = "https://yc-oss.github.io/api/batches/{batch}.json"
BATCHES = ["W23", "S23", "W24", "S24", "W25"]

async def fetch_yc_api(client: httpx.AsyncClient, batch: str) -> list[dict]:
    companies = []
    page = 0
    while True:
        try:
            resp = await client.get(YC_API, params={"batch": batch, "page": page}, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            items = data if isinstance(data, list) else data.get("companies", data.get("results", []))
            if not items:
                break
            companies.extend(items)
            page += 1
        except Exception as e:
            print(f"[scraper] YC API error batch={batch} page={page}: {e}")
            break
    print(f"[scraper] YC API: {batch} → {len(companies)} companies")
    return companies

async def fetch_oss_api(client: httpx.AsyncClient, batch: str) -> list[dict]:
    url = YC_OSS_API.format(batch=batch.lower())
    try:
        resp = await client.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data if isinstance(data, list) else data.get("companies", [])
        print(f"[scraper] OSS API: {batch} → {len(items)} companies")
        return items
    except Exception as e:
        print(f"[scraper] OSS API error batch={batch}: {e}")
        return []

def normalize_yc(c: dict, batch: str) -> dict:
    badges = c.get("badges", [])
    is_hiring = False
    if isinstance(badges, list):
        for b in badges:
            if isinstance(b, dict) and b.get("isHiring"):
                is_hiring = True
            elif isinstance(b, str) and "hiring" in b.lower():
                is_hiring = True
    return {
        "name": c.get("name", ""),
        "slug": c.get("slug", ""),
        "website": c.get("website", ""),
        "one_liner": c.get("oneLiner", ""),
        "long_description": c.get("longDescription", ""),
        "team_size": c.get("teamSize") or 0,
        "batch": c.get("batch", batch),
        "status": c.get("status", ""),
        "industries": json.dumps(c.get("industries", [])),
        "tags": json.dumps(c.get("tags", [])),
        "locations": json.dumps(c.get("locations", c.get("regions", []))),
        "is_hiring": 1 if is_hiring else 0,
        "logo_url": c.get("smallLogoUrl", ""),
        "yc_url": c.get("url", f"https://www.ycombinator.com/companies/{c.get('slug', '')}"),
    }

def normalize_oss(c: dict, batch: str) -> dict:
    return {
        "name": c.get("name", ""),
        "slug": c.get("slug", ""),
        "website": c.get("website", ""),
        "one_liner": c.get("one_liner", ""),
        "long_description": c.get("long_description", ""),
        "team_size": c.get("team_size") or 0,
        "batch": c.get("batch", batch),
        "status": c.get("status", ""),
        "industries": json.dumps(c.get("industries", [])),
        "tags": json.dumps(c.get("tags", [])),
        "locations": json.dumps(c.get("all_locations", c.get("regions", []))),
        "is_hiring": 1 if c.get("isHiring") else 0,
        "logo_url": c.get("small_logo_thumb_url", ""),
        "yc_url": c.get("url", f"https://www.ycombinator.com/companies/{c.get('slug', '')}"),
    }

async def scrape_all():
    merged = {}
    async with httpx.AsyncClient() as client:
        for batch in BATCHES:
            yc_companies, oss_companies = await asyncio.gather(
                fetch_yc_api(client, batch),
                fetch_oss_api(client, batch)
            )
            for c in oss_companies:
                slug = c.get("slug", "")
                if slug:
                    merged[slug] = normalize_oss(c, batch)
            for c in yc_companies:
                slug = c.get("slug", "")
                if slug:
                    existing = merged.get(slug, {})
                    normalized = normalize_yc(c, batch)
                    # YC API overwrites but keep longer descriptions
                    if existing.get("long_description") and not normalized["long_description"]:
                        normalized["long_description"] = existing["long_description"]
                    if existing.get("logo_url") and not normalized["logo_url"]:
                        normalized["logo_url"] = existing["logo_url"]
                    merged[slug] = normalized

    print(f"[scraper] Total unique companies: {len(merged)}")

    db = await get_db()
    await db.execute("DELETE FROM companies")
    for slug, c in merged.items():
        if not c["name"] or not c["slug"]:
            continue
        await db.execute("""
            INSERT OR REPLACE INTO companies 
            (name, slug, website, one_liner, long_description, team_size, batch, status, industries, tags, locations, is_hiring, logo_url, yc_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            c["name"], c["slug"], c["website"], c["one_liner"], c["long_description"],
            c["team_size"], c["batch"], c["status"], c["industries"], c["tags"],
            c["locations"], c["is_hiring"], c["logo_url"], c["yc_url"]
        ))
    await db.commit()
    await db.close()
    return len(merged)
