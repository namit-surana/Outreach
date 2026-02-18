import json
import re
import httpx
import asyncio
from datetime import datetime, timedelta
from urllib.parse import urlparse, quote
from database import get_db
from scraper import scrape_all


async def log_action(db, agent_name: str, action: str, details: str, company_id: int = None, status: str = "info"):
    await db.execute(
        "INSERT INTO agent_logs (agent_name, action, details, company_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (agent_name, action, details, company_id, status, datetime.utcnow().isoformat())
    )
    await db.commit()


class ScoutAgent:
    name = "scout"

    async def run(self) -> dict:
        db = await get_db()
        await log_action(db, self.name, "start", "Starting scout agent — scraping YC companies")

        try:
            count = await scrape_all()
            await log_action(db, self.name, "scrape_complete", f"Scraped {count} companies", status="success")
        except Exception as e:
            await log_action(db, self.name, "scrape_error", str(e), status="error")
            await db.close()
            return {"error": str(e), "scored": 0}

        # Re-open db since scrape_all closes it
        db = await get_db()

        # Score all companies
        cursor = await db.execute("SELECT id, name, industries, tags, locations, is_hiring, team_size, one_liner, long_description FROM companies")
        companies = [dict(r) for r in await cursor.fetchall()]

        scored = 0
        for c in companies:
            score = self._score(c)
            await db.execute("UPDATE companies SET relevance_score = ? WHERE id = ?", (score, c["id"]))
            scored += 1

        await db.commit()
        await log_action(db, self.name, "scoring_complete", f"Scored {scored} companies by relevance", status="success")
        await db.close()
        return {"scraped": count, "scored": scored}

    def _score(self, c: dict) -> int:
        score = 0
        text = " ".join([
            c.get("industries") or "",
            c.get("tags") or "",
            c.get("one_liner") or "",
            c.get("long_description") or "",
        ]).lower()

        # +30 AI/ML keywords
        ai_keywords = ["artificial intelligence", "machine learning", "deep learning", "nlp",
                        "natural language", "llm", "large language model", "computer vision",
                        "neural network", "generative ai", "\"ai\"", " ai ", " ai,", " ml ",
                        "ai-", "ml-", "ai/ml"]
        if any(k in text for k in ai_keywords):
            score += 30

        # +20 if hiring
        if c.get("is_hiring"):
            score += 20

        # +15 location
        locs = (c.get("locations") or "").lower()
        if any(k in locs for k in ["nyc", "new york", "remote"]):
            score += 15

        # +10 team size sweet spot
        ts = c.get("team_size") or 0
        if 2 <= ts <= 50:
            score += 10

        # +5 dev tools / infra / SaaS
        infra_keywords = ["developer tools", "devtools", "infrastructure", "saas", "platform",
                          "api", "sdk", "cloud", "dev tool"]
        if any(k in text for k in infra_keywords):
            score += 5

        return score


class ReconAgent:
    name = "recon"

    async def run(self) -> dict:
        db = await get_db()
        await log_action(db, self.name, "start", "Starting recon agent — enriching contacts via YC profiles, GitHub, email patterns, LinkedIn")

        # Get top companies by relevance_score, skip those with 2+ contacts already
        cursor = await db.execute("""
            SELECT c.id, c.name, c.website, c.slug, c.batch, c.yc_url,
                   (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) as contact_count
            FROM companies c
            WHERE c.relevance_score > 0
            ORDER BY c.relevance_score DESC
            LIMIT 100
        """)
        all_companies = [dict(r) for r in await cursor.fetchall()]

        # Filter out companies that already have 2+ contacts
        companies = [c for c in all_companies if c["contact_count"] < 2]

        if not companies:
            await log_action(db, self.name, "no_targets", "No companies to enrich (all have 2+ contacts or no scored companies)", status="info")
            await db.close()
            return {"enriched": 0, "new_contacts": 0}

        await log_action(db, self.name, "targets_found", f"Found {len(companies)} companies to enrich (of {len(all_companies)} top-scored)")

        enriched_count = 0
        total_new_contacts = 0
        github_request_count = 0
        MAX_GITHUB_REQUESTS = 50  # Stay well under 60/hr limit

        async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (compatible; YCOutreach/1.0)"}) as client:
            for c in companies:
                company_new_contacts = 0
                domain = self._extract_domain(c.get("website") or "")
                founders_found = []  # Track names found for email pattern generation

                # --- Source 1: YC Profile Scraping ---
                try:
                    yc_contacts = await self._scrape_yc_profile(client, c, db)
                    for contact in yc_contacts:
                        if await self._insert_contact_if_new(db, c["id"], contact):
                            company_new_contacts += 1
                            founders_found.append(contact)
                    if yc_contacts:
                        await log_action(db, self.name, "yc_profile", f"Found {len(yc_contacts)} contacts from YC profile for {c['name']}", c["id"], "success")
                    await asyncio.sleep(1.5)
                except Exception as e:
                    await log_action(db, self.name, "yc_profile_error", f"YC profile failed for {c['name']}: {str(e)[:200]}", c["id"], "error")

                # --- Source 2: GitHub Search ---
                if github_request_count < MAX_GITHUB_REQUESTS:
                    try:
                        gh_contacts, gh_reqs = await self._search_github(client, c, domain)
                        github_request_count += gh_reqs
                        for contact in gh_contacts:
                            if await self._insert_contact_if_new(db, c["id"], contact):
                                company_new_contacts += 1
                                founders_found.append(contact)
                        if gh_contacts:
                            await log_action(db, self.name, "github", f"Found {len(gh_contacts)} contacts from GitHub for {c['name']}", c["id"], "success")
                        await asyncio.sleep(1.5)
                    except Exception as e:
                        await log_action(db, self.name, "github_error", f"GitHub search failed for {c['name']}: {str(e)[:200]}", c["id"], "error")

                # --- Source 3: Email Pattern Generator ---
                if domain and founders_found:
                    try:
                        email_contacts = self._generate_email_patterns(founders_found, domain, c["name"])
                        for contact in email_contacts:
                            if await self._insert_contact_if_new(db, c["id"], contact):
                                company_new_contacts += 1
                        if email_contacts:
                            await log_action(db, self.name, "email_pattern", f"Generated {len(email_contacts)} email patterns for {c['name']}", c["id"], "success")
                    except Exception as e:
                        await log_action(db, self.name, "email_pattern_error", f"Email pattern failed for {c['name']}: {str(e)[:200]}", c["id"], "error")
                # No generic fallback — only generate patterns for known founders

                # --- Source 4: LinkedIn URL Generator ---
                try:
                    linkedin_contacts = self._generate_linkedin_urls(founders_found, c["name"], c.get("slug", ""))
                    for contact in linkedin_contacts:
                        if await self._insert_contact_if_new(db, c["id"], contact):
                            company_new_contacts += 1
                    if linkedin_contacts:
                        await log_action(db, self.name, "linkedin", f"Generated {len(linkedin_contacts)} LinkedIn URLs for {c['name']}", c["id"], "success")
                except Exception as e:
                    await log_action(db, self.name, "linkedin_error", f"LinkedIn URL gen failed for {c['name']}: {str(e)[:200]}", c["id"], "error")

                if company_new_contacts > 0:
                    enriched_count += 1
                    total_new_contacts += company_new_contacts
                    await db.commit()

        summary = f"Enriched {enriched_count} companies, found {total_new_contacts} new contacts (GitHub requests used: {github_request_count})"
        await log_action(db, self.name, "complete", summary, status="success")
        await db.close()
        return {"enriched": enriched_count, "new_contacts": total_new_contacts, "companies_checked": len(companies)}

    def _extract_domain(self, website: str) -> str:
        """Extract domain from a website URL."""
        if not website:
            return ""
        try:
            parsed = urlparse(website if "://" in website else f"https://{website}")
            domain = parsed.netloc or parsed.path.split("/")[0]
            domain = domain.replace("www.", "")
            return domain
        except Exception:
            return ""

    async def _scrape_yc_profile(self, client: httpx.AsyncClient, company: dict, db) -> list:
        """Source 1: Scrape YC profile page and yc-oss API for founder info."""
        contacts = []
        slug = company.get("slug", "")
        batch = (company.get("batch") or "").lower()

        if not slug:
            return contacts

        # Try yc-oss individual company API first
        if batch:
            try:
                oss_url = f"https://yc-oss.github.io/api/batches/{batch}/{slug}.json"
                resp = await client.get(oss_url)
                if resp.status_code == 200:
                    data = resp.json()
                    # Look for founders field
                    founders = data.get("founders", [])
                    if isinstance(founders, list):
                        for f in founders:
                            if isinstance(f, dict):
                                name = f.get("full_name") or f.get("name") or ""
                                if name:
                                    contacts.append({
                                        "name": name,
                                        "role": f.get("title") or f.get("role") or "Founder",
                                        "email": f.get("email") or "",
                                        "linkedin_url": f.get("linkedin_url") or f.get("linkedin") or "",
                                        "source": "yc_profile",
                                    })
                            elif isinstance(f, str) and len(f) > 2:
                                contacts.append({
                                    "name": f,
                                    "role": "Founder",
                                    "email": "",
                                    "linkedin_url": "",
                                    "source": "yc_profile",
                                })
                    # Also check top-level fields
                    for key in ["founder_names", "team"]:
                        val = data.get(key)
                        if isinstance(val, list):
                            for item in val:
                                if isinstance(item, str) and len(item) > 2:
                                    if not any(c["name"] == item for c in contacts):
                                        contacts.append({"name": item, "role": "Founder", "email": "", "linkedin_url": "", "source": "yc_profile"})
                                elif isinstance(item, dict):
                                    name = item.get("full_name") or item.get("name") or ""
                                    if name and not any(c["name"] == name for c in contacts):
                                        contacts.append({
                                            "name": name,
                                            "role": item.get("title") or item.get("role") or "Team Member",
                                            "email": item.get("email") or "",
                                            "linkedin_url": item.get("linkedin_url") or item.get("linkedin") or "",
                                            "source": "yc_profile",
                                        })
            except Exception:
                pass

            await asyncio.sleep(1.0)

        # Also try scraping the YC HTML page
        if not contacts:
            try:
                yc_url = f"https://www.ycombinator.com/companies/{slug}"
                resp = await client.get(yc_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
                if resp.status_code == 200:
                    html = resp.text[:100000]
                    # Look for founder names in structured data or common patterns
                    # YC pages often have JSON-LD or Next.js data
                    json_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
                    if json_match:
                        try:
                            next_data = json.loads(json_match.group(1))
                            # Navigate the Next.js data structure to find founders
                            props = next_data.get("props", {}).get("pageProps", {})
                            company_data = props.get("company", props)
                            founders = company_data.get("founders", [])
                            for f in founders:
                                if isinstance(f, dict):
                                    name = f.get("full_name") or f.get("name") or ""
                                    if name and not any(c["name"] == name for c in contacts):
                                        contacts.append({
                                            "name": name,
                                            "role": f.get("title") or "Founder",
                                            "email": "",
                                            "linkedin_url": f.get("linkedin_url") or "",
                                            "source": "yc_profile",
                                        })
                        except (json.JSONDecodeError, KeyError):
                            pass

                    # Fallback: regex patterns for founder names on the page
                    if not contacts:
                        founder_patterns = [
                            r'(?:Founder|Co-[Ff]ounder|CEO|CTO)[:\s,\-–]+([A-Z][a-z]+ [A-Z][a-z]+)',
                            r'([A-Z][a-z]+ [A-Z][a-z]+)[,\s\-–]+(?:Founder|Co-[Ff]ounder|CEO|CTO)',
                        ]
                        seen = set()
                        for pat in founder_patterns:
                            for m in re.finditer(pat, html):
                                name = m.group(1).strip()
                                if name not in seen and len(name) > 3 and len(name) < 40:
                                    seen.add(name)
                                    role_m = re.search(r'(CEO|CTO|Founder|Co-[Ff]ounder)', m.group(0))
                                    contacts.append({
                                        "name": name,
                                        "role": role_m.group(1) if role_m else "Founder",
                                        "email": "",
                                        "linkedin_url": "",
                                        "source": "yc_profile",
                                    })
            except Exception:
                pass

        return contacts[:5]

    async def _search_github(self, client: httpx.AsyncClient, company: dict, domain: str) -> tuple:
        """Source 2: Search GitHub for company members. Returns (contacts, request_count)."""
        contacts = []
        request_count = 0
        company_name = company.get("name", "")

        if not company_name:
            return contacts, request_count

        # Search by company name
        search_queries = [company_name]
        if domain:
            search_queries.append(domain)

        seen_usernames = set()
        for query in search_queries:
            try:
                resp = await client.get(
                    "https://api.github.com/search/users",
                    params={"q": f"{query} type:user", "per_page": 5},
                    headers={"Accept": "application/vnd.github.v3+json"},
                )
                request_count += 1

                if resp.status_code == 403:
                    # Rate limited
                    break
                if resp.status_code != 200:
                    continue

                data = resp.json()
                users = data.get("items", [])[:3]  # Limit to top 3 per query

                for user in users:
                    username = user.get("login", "")
                    if username in seen_usernames:
                        continue
                    seen_usernames.add(username)

                    await asyncio.sleep(1.5)

                    # Fetch user profile for more details
                    try:
                        profile_resp = await client.get(
                            f"https://api.github.com/users/{username}",
                            headers={"Accept": "application/vnd.github.v3+json"},
                        )
                        request_count += 1

                        if profile_resp.status_code == 403:
                            break
                        if profile_resp.status_code != 200:
                            continue

                        profile = profile_resp.json()
                        name = profile.get("name") or username
                        email = profile.get("email") or ""
                        bio = profile.get("bio") or ""
                        gh_company = profile.get("company") or ""

                        # Only include if the GitHub user seems related to this company
                        company_lower = company_name.lower()
                        if (company_lower in (gh_company or "").lower() or
                            company_lower in (bio or "").lower() or
                            (domain and domain in (email or "").lower())):
                            contacts.append({
                                "name": name,
                                "role": f"GitHub: {bio[:60]}" if bio else "GitHub Profile",
                                "email": email,
                                "linkedin_url": "",
                                "source": "github",
                            })
                    except Exception:
                        continue

                await asyncio.sleep(1.5)
            except Exception:
                continue

        return contacts[:5], request_count

    def _generate_email_patterns(self, founders: list, domain: str, company_name: str) -> list:
        """Source 3: Generate likely email patterns for known founders."""
        contacts = []

        for founder in founders:
            name = founder.get("name", "")
            if not name or len(name.split()) < 2:
                continue

            parts = name.strip().split()
            first = parts[0].lower()
            last = parts[-1].lower()
            first_initial = first[0] if first else ""

            # Skip if they already have an email from another source
            if founder.get("email") and "@" in founder.get("email", ""):
                continue

            patterns = [
                f"{first}@{domain}",
                f"{first}.{last}@{domain}",
                f"{first_initial}{last}@{domain}",
                f"{first}{last}@{domain}",
            ]

            for email in patterns:
                contacts.append({
                    "name": name,
                    "role": founder.get("role", ""),
                    "email": email,
                    "linkedin_url": "",
                    "source": "email_pattern",
                })

        return contacts

    def _generate_linkedin_urls(self, founders: list, company_name: str, company_slug: str) -> list:
        """Source 4: Generate LinkedIn search URLs."""
        contacts = []

        # Company LinkedIn search
        if company_slug:
            slug_clean = re.sub(r'[^a-z0-9-]', '', company_slug.lower())
            contacts.append({
                "name": f"{company_name} (Company Page)",
                "role": "Company LinkedIn",
                "email": "",
                "linkedin_url": f"https://www.linkedin.com/company/{slug_clean}",
                "source": "linkedin_search",
            })

        # Founder LinkedIn search URLs
        for founder in founders:
            name = founder.get("name", "")
            if not name:
                continue
            # Skip if they already have a LinkedIn URL from another source
            if founder.get("linkedin_url"):
                continue
            encoded = quote(f"{name} {company_name}")
            contacts.append({
                "name": name,
                "role": founder.get("role", ""),
                "email": "",
                "linkedin_url": f"https://www.linkedin.com/search/results/people/?keywords={encoded}",
                "source": "linkedin_search",
            })

        return contacts

    async def _insert_contact_if_new(self, db, company_id: int, contact: dict) -> bool:
        """Insert contact if not duplicate. Check by company_id + (email or name+source)."""
        email = contact.get("email", "").strip()
        name = contact.get("name", "").strip()
        source = contact.get("source", "")

        if not name:
            return False

        # Check for duplicate by email (if email exists)
        if email:
            cursor = await db.execute(
                "SELECT id FROM contacts WHERE company_id = ? AND email = ?",
                (company_id, email)
            )
            if await cursor.fetchone():
                return False

        # Check for duplicate by name + source
        cursor = await db.execute(
            "SELECT id FROM contacts WHERE company_id = ? AND name = ? AND source = ?",
            (company_id, name, source)
        )
        if await cursor.fetchone():
            return False

        await db.execute(
            "INSERT INTO contacts (company_id, name, role, email, linkedin_url, source) VALUES (?, ?, ?, ?, ?, ?)",
            (company_id, name, contact.get("role", ""), email, contact.get("linkedin_url", ""), source)
        )
        return True


class WriterAgent:
    name = "writer"

    async def run(self) -> dict:
        db = await get_db()
        await log_action(db, self.name, "skip", "Writer agent coming soon — email generation not yet implemented", status="info")
        await db.close()
        return {"drafted": 0, "message": "Writer agent coming soon"}


class TrackerAgent:
    name = "tracker"

    async def run(self) -> dict:
        db = await get_db()
        await log_action(db, self.name, "start", "Starting tracker agent — checking follow-ups")

        # Mark outreach needing follow-up (sent > 3 days ago, not yet flagged)
        cursor = await db.execute("""
            UPDATE outreach SET needs_followup = 1
            WHERE status = 'sent' AND sent_at IS NOT NULL
            AND datetime(sent_at) < datetime('now', '-3 days')
            AND needs_followup = 0
        """)
        await db.commit()
        flagged = cursor.rowcount

        # Summary stats
        cursor = await db.execute("SELECT COUNT(*) FROM outreach WHERE needs_followup = 1")
        total_followup = (await cursor.fetchone())[0]

        cursor = await db.execute("SELECT status, COUNT(*) as cnt FROM outreach GROUP BY status")
        by_status = {r["status"]: r["cnt"] for r in await cursor.fetchall()}

        summary = f"Flagged {flagged} new follow-ups. Total needing follow-up: {total_followup}. Pipeline: {json.dumps(by_status)}"
        await log_action(db, self.name, "complete", summary, status="success")
        await db.close()
        return {"newly_flagged": flagged, "total_followup": total_followup, "by_status": by_status}


class OrchestratorAgent:
    name = "orchestrator"

    async def run(self) -> dict:
        db = await get_db()
        await log_action(db, self.name, "pipeline_start", "Starting full agent pipeline")
        await db.close()

        results = {}
        agents = [
            ("scout", ScoutAgent()),
            ("recon", ReconAgent()),
            ("writer", WriterAgent()),
            ("tracker", TrackerAgent()),
        ]

        for name, agent in agents:
            try:
                results[name] = await agent.run()
            except Exception as e:
                results[name] = {"error": str(e)}

        db = await get_db()
        await log_action(db, self.name, "pipeline_complete", f"Pipeline finished: {json.dumps(results)}", status="success")
        await db.close()
        return results
