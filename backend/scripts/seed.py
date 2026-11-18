"""Database Seeding Script for Initial Bootstrap and Local Development."""

import json
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.core.events import (
    create_default_policies,
    create_default_roles,
    create_first_admin,
)
from app.core.security import get_password_hash
from app.database import SessionLocal, init_db
from app.mcp.tool_registry import tool_registry
from app.models.agent import Agent
from app.models.user import Role, User, UserRole
from app.schemas.agent import AgentCreate
from app.services.agent_service import AgentService


def seed_sandbox_directory() -> None:
    """Populate initial files inside the sandbox directory for filesystem tool testing."""
    sandbox = Path(settings.FILE_SANDBOX_PATH).resolve()
    sandbox.mkdir(parents=True, exist_ok=True)

    readme_path = sandbox / "readme.txt"
    if not readme_path.exists():
        readme_path.write_text(
            "Welcome to the AgentGuard Execution Sandbox.\n"
            "This folder is strictly isolated. Filesystem tools can safely read, create, and modify files here.\n",
            encoding="utf-8",
        )

    sample_json = sandbox / "sample_data.json"
    if not sample_json.exists():
        sample_json.write_text(
            json.dumps(
                {
                    "project": "AgentGuard",
                    "status": "ready",
                    "version": "1.0.0",
                    "supported_tools": ["filesystem", "github", "database"],
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    system_md = sandbox / "system_info.md"
    if not system_md.exists():
        system_md.write_text(
            "# System Info\n"
            "- Architecture: Dual-custody MCP Gateway\n"
            "- Security Model: Fail-closed deterministic policy engine\n"
            "- Storage: PostgreSQL with SHA-256 hash chaining\n",
            encoding="utf-8",
        )

    print(f"[*] Seeded sandbox files at: {sandbox}")


def seed_users(db) -> dict[str, str]:
    """Create demo accounts for all standard operational personas."""
    roles = create_default_roles(db)
    create_first_admin(db, roles)

    demo_users = [
        ("dev@agentguard.local", "Dev@123!", "Alex Developer", "Developer"),
        ("approver@agentguard.local", "Approver@123!", "Morgan Approver", "Approver"),
        ("security@agentguard.local", "Security@123!", "Sam Security Officer", "SecurityOfficer"),
    ]

    for email, password, full_name, role_name in demo_users:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                full_name=full_name,
                is_active=True,
                is_superuser=False,
            )
            db.add(user)
            db.flush()

            role = roles.get(role_name)
            if role:
                ur = UserRole(user_id=user.id, role_id=role.id)
                db.add(ur)

            db.commit()
            print(f"[+] Created user: {email} ({role_name})")
        else:
            print(f"[-] User already exists: {email}")

    return {
        "admin": f"{settings.FIRST_ADMIN_EMAIL} / {settings.FIRST_ADMIN_PASSWORD}",
        "developer": "dev@agentguard.local / Dev@123!",
        "approver": "approver@agentguard.local / Approver@123!",
        "security": "security@agentguard.local / Security@123!",
    }


def seed_agents(db) -> dict[str, str]:
    """Register demo AI agents and output their API keys."""
    demo_agents = [
        (
            AgentCreate(
                name="ResearchAgent",
                description="Autonomous research and documentation agent.",
                metadata={"department": "AI Research", "environment": "staging"},
            ),
            "ResearchAgent Primary Key",
        ),
        (
            AgentCreate(
                name="DataAgent",
                description="Analytical agent performing database querying and ETL verification.",
                metadata={"department": "Data Engineering", "environment": "production"},
            ),
            "DataAgent Primary Key",
        ),
    ]

    agent_keys: dict[str, str] = {}
    for agent_create, label in demo_agents:
        existing = db.query(Agent).filter(Agent.name == agent_create.name).first()
        if not existing:
            agent, raw_key = AgentService.create_agent(db, agent_create, label=label)
            agent_keys[agent.name] = raw_key
            print(f"[+] Created agent: {agent.name}")
            print(f"    API Key: {raw_key}")
        else:
            print(f"[-] Agent already exists: {existing.name}")

    return agent_keys


def main() -> None:
    """Run full seed script."""
    print("=" * 60)
    print(" AgentGuard Backend Database & Environment Seeder")
    print("=" * 60)

    # 1. Initialize schema
    init_db()

    # 2. Seed sandbox files
    seed_sandbox_directory()

    db = SessionLocal()
    try:
        # 3. Synchronize registered tools to database
        tool_registry.sync_to_db(db)
        print(f"[*] Synchronized {len(tool_registry.list_all())} tools to database.")

        # 4. Provision default policies
        create_default_policies(db)
        print("[*] Synchronized baseline governance policies.")

        # 5. Seed user accounts
        credentials = seed_users(db)

        # 6. Seed demo agents
        agent_keys = seed_agents(db)

        print("\n" + "=" * 60)
        print(" SEEDING SUMMARY")
        print("=" * 60)
        print("User Accounts:")
        for role, cred in credentials.items():
            print(f"  - {role.capitalize()}: {cred}")

        if agent_keys:
            print("\nProvisioned Agent API Keys:")
            for agent_name, key in agent_keys.items():
                print(f"  - {agent_name}: {key}")
        print("=" * 60)
        print("Done!\n")

    finally:
        db.close()


if __name__ == "__main__":
    main()
