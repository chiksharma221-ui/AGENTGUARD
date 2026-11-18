# AgentGuard 🛡️
### Centralized AI Agent Governance & Secure Execution Gateway

AgentGuard is a production-grade **AI Agent Governance Platform** — a secure gateway between AI agents and company resources. It enforces authentication, authorization, risk-based policies, human approvals, and comprehensive auditing across all AI agent tool invocations.

---

## Architecture

```
AI Agent (LangGraph / Any MCP Client)
         │
         │  X-Agent-API-Key
         ▼
┌─────────────────────────────────────────┐
│          MCP Gateway (FastAPI)          │
│  ┌──────────┐  ┌────────────────────┐  │
│  │  Policy  │  │  Approval Service  │  │
│  │  Engine  │──│  (Human-in-Loop)   │  │
│  └──────────┘  └────────────────────┘  │
│  ┌──────────┐  ┌────────────────────┐  │
│  │  Exec    │  │   Audit Service    │  │
│  │  Engine  │  │  (Tamper-evident)  │  │
│  └──────────┘  └────────────────────┘  │
└─────────────────────────────────────────┘
         │
         ├── File System (sandboxed)
         ├── GitHub API (token-gated)
         └── PostgreSQL (parameterized)
```

## Quick Start

### 1. Prerequisites
- Docker and Docker Compose
- Python 3.12+
- Node.js 18+

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
# Set SECRET_KEY to a secure random string (min 32 chars)
# Optionally set GITHUB_TOKEN and OPENAI_API_KEY
```

### 3. Start with Docker Compose (Recommended)

```bash
docker compose up -d
```

This starts:
- PostgreSQL 16 (port 5432)
- Redis 7 (port 6379)
- AgentGuard Backend API (port 8000)
- AgentGuard Frontend (port 3000)
- Celery Worker (approval expiry)
- Celery Beat (scheduler)

### 4. Run Without Docker (Development)

```bash
# Start Postgres and Redis (via Docker or locally installed)
docker compose up -d postgres redis

# Backend
cd backend
pip install -r requirements.txt
python -m scripts.seed         # Create demo users, agents, policies
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                    # Runs at http://localhost:5173
```

### 5. Access the Dashboard

- **Frontend**: http://localhost:3000 (Docker) or http://localhost:5173 (dev)
- **API Docs**: http://localhost:8000/docs
- **Health**: http://localhost:8000/health

### 6. Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@agentguard.local | Admin@123! |
| Developer | dev@agentguard.local | Dev@123! |
| Approver | approver@agentguard.local | Approver@123! |
| Security Officer | security@agentguard.local | Security@123! |

### Role access

- **Administrator**: Full access, including agents, users, policies, approvals, and audit records.
- **Security Officer**: Policy management and organization-wide audit records.
- **Approver**: Approval queues and organization-wide audit records.
- **Developer**: Tool access and personal audit telemetry only; audit queries are scoped to that user.

---

## Running the Demo Scenarios

```bash
cd agent-client
pip install -r requirements.txt

# Set your agent API keys from seed output
export RESEARCH_AGENT_KEY=ag_xxxxxxxxxxxx
export DATA_AGENT_KEY=ag_xxxxxxxxxxxx

# Run all 8 governance scenarios
python simple_mcp_client.py

# Run the LangGraph agent (needs OPENAI_API_KEY)
python langgraph_agent.py
```

---

## The 8 Governance Scenarios

| # | Scenario | Expected Outcome |
|---|----------|-----------------|
| 1 | File read (LOW risk) | Automatically ALLOWED |
| 2 | File delete (HIGH risk) | PENDING_APPROVAL → human approves → EXECUTED |
| 3 | DB delete (CRITICAL) | PENDING_APPROVAL → human rejects → REJECTED |
| 4 | Path traversal attempt | DENIED (sandbox violation) |
| 5 | Argument tampering | INTEGRITY_ERROR — execution blocked |
| 6 | Approval expiry | Status → EXPIRED — no execution |
| 7 | Multi-agent governance | Each agent retains individual identity |
| 8 | Audit inspection | Full lifecycle visible to admin |

---

## Default Policy Table

| Tool | Risk | Decision |
|------|------|----------|
| filesystem.list_files | LOW | ALLOW |
| filesystem.read_file | LOW | ALLOW |
| filesystem.create_file | MEDIUM | REQUIRE_APPROVAL |
| filesystem.update_file | MEDIUM | REQUIRE_APPROVAL |
| filesystem.delete_file | HIGH | REQUIRE_APPROVAL |
| github.list_repos | LOW | ALLOW |
| github.get_repo | LOW | ALLOW |
| github.create_issue | MEDIUM | REQUIRE_APPROVAL |
| github.create_branch | MEDIUM | REQUIRE_APPROVAL |
| github.delete_file | HIGH | REQUIRE_APPROVAL |
| database.execute_select | LOW | ALLOW |
| database.insert_record | MEDIUM | REQUIRE_APPROVAL |
| database.update_record | HIGH | REQUIRE_APPROVAL |
| database.delete_record | CRITICAL | REQUIRE_APPROVAL |
| *(unknown)* | — | DENY (fail-closed) |

---

## API Reference

Full interactive docs at http://localhost:8000/docs

| Endpoint | Method | Description |
|----------|--------|-------------|
| /auth/login | POST | Obtain JWT tokens |
| /auth/refresh | POST | Refresh access token |
| /auth/me | GET | Current user info |
| /agents | GET/POST | List/register agents |
| /agents/{id}/toggle | POST | Enable/disable agent |
| /agents/{id}/credentials | POST | Generate new API key |
| /mcp/invoke | POST | **Main gateway endpoint** (agent auth) |
| /mcp/tools | GET | List registered MCP tools |
| /mcp/result/{id} | POST | Poll for approval result |
| /policies | GET/POST | List/create policies |
| /policies/evaluate | POST | Test policy evaluation |
| /approvals | GET | List approvals (pending/all) |
| /approvals/{id}/decide | POST | Approve or reject |
| /audit | GET | Query audit logs |
| /audit/export | GET | Export CSV |
| /audit/stats | GET | Telemetry statistics |
| /ws/approvals | WS | Real-time approval events |

---

## MCP Client Integration

```python
import httpx

# Any MCP-compatible client
response = httpx.post(
    "http://localhost:8000/mcp/invoke",
    headers={"X-Agent-API-Key": "ag_your_key_here"},
    json={
        "tool_name": "filesystem.read_file",
        "arguments": {"path": "report.txt"}
    }
)
# Returns: {"status": "SUCCESS"|"DENIED"|"PENDING_APPROVAL", ...}
```

---

## Security Architecture

| Control | Implementation |
|---------|---------------|
| Password hashing | bcrypt (passlib) |
| JWT tokens | python-jose, HS256, short-lived (30min access) |
| Agent API keys | SHA-256 hashed, never stored in plaintext |
| Argument integrity | SHA-256 canonical JSON hash bound to each approval |
| Replay protection | Single-use approvals with argument hash verification |
| Path traversal | Chroot prefix check on all file operations |
| SQL injection | SQLAlchemy parameterized queries + sqlparse SELECT validation |
| Rate limiting | slowapi (token bucket per IP + per agent) |
| Audit log | Append-only with SHA-256 hash chain (tamper-evident) |
| Fail-closed | No matching policy → DENY |
| Secret management | Environment variables only, never hardcoded |
| Error handling | Sanitized error messages — no internal detail leakage |

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt

# Unit tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=app --cov-report=html

# Specific test suites
pytest tests/test_policy_engine.py -v
pytest tests/test_approval_workflow.py -v
pytest tests/test_security.py -v
pytest tests/e2e/test_scenarios.py -v
```

---

## Project Structure

```
agentguard/
├── backend/            # FastAPI Python backend
│   ├── app/
│   │   ├── main.py     # FastAPI entrypoint
│   │   ├── config.py   # Settings
│   │   ├── models/     # SQLAlchemy models
│   │   ├── schemas/    # Pydantic schemas
│   │   ├── routers/    # API endpoints
│   │   ├── services/   # Business logic
│   │   ├── mcp/        # MCP gateway + handlers
│   │   ├── core/       # Security, exceptions, middleware
│   │   └── workers/    # Celery tasks
│   ├── alembic/        # Database migrations
│   ├── scripts/        # Seed script
│   └── tests/          # Test suite
├── frontend/           # React + Vite + Tailwind dashboard
│   └── src/
│       ├── pages/      # 7 dashboard pages
│       ├── components/ # UI components + charts
│       ├── services/   # API client
│       ├── store/      # Zustand auth state
│       └── hooks/      # useAuth, useWebSocket
├── agent-client/       # Demo AI agent clients
│   ├── simple_mcp_client.py  # 8 scenario tests
│   └── langgraph_agent.py    # LangGraph demo agent
└── docker-compose.yml
```

---

## GitHub Integration

Set `GITHUB_TOKEN` in `.env` to enable real GitHub operations.
Without it, all GitHub tools run in **LOCAL_MODE** (simulated responses, clearly labeled).

## OpenAI Integration

Set `OPENAI_API_KEY` in `.env` to enable the full LangGraph agent.
Without it, `langgraph_agent.py` runs in **direct API mode** (no LLM, tools called directly).

---

## License

MIT — built for demonstrating enterprise AI agent governance.
