import json
import random
import re

NAMIT_BIO = {
    "name": "Namit",
    "university": "NYU",
    "degree": "MS in Computer Science",
    "graduation": "May 2026",
    "location": "New York City",
    "visa": "F-1 OPT",
    "skills": ["AI/ML", "full-stack development", "Python", "deep learning", "NLP", "computer vision", "distributed systems"],
    "interests": ["building AI-powered products", "developer tools", "infrastructure", "applied ML"],
}

def extract_keywords(text: str) -> list[str]:
    keywords = []
    ai_terms = ["ai", "machine learning", "ml", "deep learning", "nlp", "natural language", "computer vision",
                 "neural", "llm", "gpt", "model", "inference", "training", "data", "analytics",
                 "automation", "intelligent", "predictive", "generative"]
    infra_terms = ["api", "infrastructure", "platform", "cloud", "devops", "developer", "sdk", "tooling", "pipeline"]
    health_terms = ["health", "medical", "clinical", "patient", "biotech", "pharma", "diagnostic"]
    fin_terms = ["fintech", "payment", "banking", "financial", "trading", "insurance"]
    
    lower = text.lower()
    for t in ai_terms:
        if t in lower:
            keywords.append("AI/ML")
            break
    for t in infra_terms:
        if t in lower:
            keywords.append("infrastructure")
            break
    for t in health_terms:
        if t in lower:
            keywords.append("healthcare")
            break
    for t in fin_terms:
        if t in lower:
            keywords.append("fintech")
            break
    return keywords

def generate_skill_match(company_text: str) -> str:
    lower = company_text.lower()
    matches = []
    if any(t in lower for t in ["ai", "ml", "machine learning", "deep learning", "neural", "llm", "model", "generative"]):
        matches.append("my AI/ML research and engineering experience at NYU, including work with deep learning models and NLP systems")
    if any(t in lower for t in ["nlp", "natural language", "text", "language model", "llm", "gpt", "chat"]):
        matches.append("my hands-on experience building NLP pipelines and working with large language models")
    if any(t in lower for t in ["computer vision", "image", "video", "visual", "detection", "recognition"]):
        matches.append("my computer vision project experience, including object detection and image classification systems")
    if any(t in lower for t in ["api", "platform", "developer", "sdk", "infrastructure", "backend"]):
        matches.append("my full-stack engineering skills and experience building scalable APIs and backend systems")
    if any(t in lower for t in ["data", "analytics", "pipeline", "etl", "warehouse"]):
        matches.append("my experience building data pipelines and working with large-scale data processing systems")
    if any(t in lower for t in ["health", "medical", "clinical", "biotech"]):
        matches.append("my interest in applying AI to high-impact domains like healthcare, combined with my ML engineering skills")
    if any(t in lower for t in ["fintech", "financial", "payment", "trading"]):
        matches.append("my quantitative background and experience building reliable, high-performance systems")
    if not matches:
        matches.append("my software engineering background and passion for building products that solve real problems")
    return matches[0]

def generate_emails(company: dict) -> list[dict]:
    name = company.get("name", "your company")
    one_liner = company.get("one_liner", "")
    long_desc = company.get("long_description", "")
    batch = company.get("batch", "")
    team_size = company.get("team_size", 0)
    
    full_text = f"{one_liner} {long_desc}"
    skill_match = generate_skill_match(full_text)
    
    what_they_do = one_liner if one_liner else "what you're building"
    
    # Variant 1: Direct and enthusiastic
    v1_subject = f"NYU CS Grad Student × {name}"
    v1_body = f"""Hi there,

I'm Namit, an MS CS student at NYU (graduating May 2026), and I've been following {name}'s work on {what_they_do.rstrip('.')}. As a {batch} company, you're at an exciting stage, and I'd love to be part of the journey.

What caught my attention is {skill_match}, which I believe maps directly to the challenges you're tackling. I'm based in NYC and available for full-time roles starting summer 2026 (F-1 OPT authorized).

Would you be open to a quick chat about how I could contribute to {name}? I'm happy to share my portfolio or do a technical deep-dive on any relevant project.

Best,
Namit"""

    # Variant 2: Value-focused and specific
    v2_subject = f"Interested in engineering roles at {name}"
    v2_body = f"""Hi,

I came across {name} — {what_they_do.rstrip('.')} — and immediately saw a connection with {skill_match}.

A bit about me: I'm finishing my MS in Computer Science at NYU, focused on AI/ML and systems engineering. I've built projects spanning deep learning, NLP, and full-stack development, and I'm looking for a team where I can apply these skills to real-world products.

{"With a team of " + str(team_size) + ", every engineer has outsized impact — that's exactly the environment I thrive in. " if team_size and team_size <= 20 else ""}I'd love to learn more about your engineering challenges and explore if there's a fit.

Are you open to connecting? I'm in NYC and flexible on timing.

Best,
Namit
NYU MS CS '26"""

    # Variant 3: Casual and genuine
    v3_subject = f"Quick note from an NYU CS student re: {name}"
    v3_body = f"""Hey!

Not going to bury the lede — I think what {name} is building is genuinely cool. {one_liner if one_liner else ""} 

I'm Namit, wrapping up my MS in CS at NYU with a focus on AI/ML. I've spent the past year going deep on {skill_match.split(",")[0]}, and when I saw {name} in the {batch} batch, I knew I had to reach out.

I'm not looking for just any role — I'm looking for a team that's solving hard problems, and {name} fits that description. Would love to chat if you're open to it.

Cheers,
Namit
LinkedIn: [link] | GitHub: [link]"""

    return [
        {"variant": "Direct & Enthusiastic", "subject": v1_subject, "body": v1_body},
        {"variant": "Value-Focused", "subject": v2_subject, "body": v2_body},
        {"variant": "Casual & Genuine", "subject": v3_subject, "body": v3_body},
    ]
