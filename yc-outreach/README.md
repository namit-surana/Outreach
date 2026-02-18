# YC Outreach - Job Hunt Project

A full-stack application for targeting YC startups in your job hunt, with intelligent company prioritization and outreach management.

## Project Overview

YC Outreach helps job seekers efficiently target Y Combinator startups by:
1. Discovering and scoring relevant companies
2. Finding contact information for key people
3. Managing outreach campaigns and follow-ups

## Tech Stack

### Frontend
- React with Vite
- TailwindCSS for styling
- React Router for navigation

### Backend
- Python FastAPI
- SQLite database
- Async architecture

## Core Features

### Intelligent Company Scoring
- Scrapes YC company data from multiple sources
- Scores companies based on relevance:
  - AI/ML focus (+30 points)
  - Hiring status (+20 points)
  - NYC/Remote location (+15 points)
  - Team size sweet spot (+10 points)
  - Dev tools/infrastructure focus (+5 points)

### Smart Contact Discovery
- YC profile scraping
- GitHub integration
- Email pattern generation
- LinkedIn URL generation

### Outreach Management
- Track communication status
- Email drafting assistance
- Follow-up reminders

### Agent System
- Scout Agent: Discovers and scores companies
- Recon Agent: Finds contact information
- Writer Agent: Helps draft personalized emails
- Tracker Agent: Manages follow-ups
- Orchestrator Agent: Coordinates the pipeline

## Getting Started

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

### Backend
- `main.py` - FastAPI application and endpoints
- `database.py` - Database setup and connections
- `scraper.py` - YC company data scraping
- `agents.py` - Autonomous agents for different tasks

### Frontend
- `src/App.jsx` - Main application component
- `src/pages/` - Individual page components
- `src/components/` - Reusable UI components

## Development Notes

This project was created by Namit as part of his job hunt targeting AI roles and SDE positions, with a focus on Y Combinator startups that match his interests in AI/ML and software engineering.