"""Application Lifecycle Events: Startup Seeding and Graceful Shutdown."""

import logging
from sqlalchemy.orm import Session
from app.config import settings
from app.core.security import get_password_hash
from app.database import SessionLocal, init_db
from app.mcp.tool_registry import tool_registry
from app.models.policy import Policy, PolicyDecision
from app.models.tool import RiskLevel
from app.models.user import Role, User, UserRole

logger = logging.getLogger("agentguard.events")


def create_default_roles(db: Session) -> dict[str, Role]:
    """Ensure standard RBAC roles exist."""
    role_specs = [
        ("Administrator", "Unrestricted administrative governance access.", ["*"]),
        ("Developer", "Can invoke permitted tools and view personal telemetry.", ["tools:invoke", "audit:view"]),
        ("SecurityOfficer", "Can author policies, configure tools, and review audit chains.", ["policies:manage", "tools:manage", "audit:view"]),
        ("Approver", "Authorized to decide human-in-the-loop approval barriers.", ["approvals:decide", "approvals:view", "audit:view"]),
    ]

    roles_map: dict[str, Role] = {}
    for name, desc, perms in role_specs:
        role = db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(name=name, description=desc, permissions=perms)
            db.add(role)
            db.flush()
            logger.info("Initialized default role: %s", name)
        roles_map[name] = role

    db.commit()
    return roles_map


def create_first_admin(db: Session, roles_map: dict[str, Role]) -> User:
    """Bootstrap initial administrator account if no admin exists."""
    admin_email = settings.FIRST_ADMIN_EMAIL.strip().lower()
    user = db.query(User).filter(User.email == admin_email).first()

    if not user:
        user = User(
            email=admin_email,
            hashed_password=get_password_hash(settings.FIRST_ADMIN_PASSWORD),
            full_name=settings.FIRST_ADMIN_NAME,
            is_active=True,
            is_superuser=True,
        )
        db.add(user)
        db.flush()

        admin_role = roles_map.get("Administrator")
        if admin_role:
            ur = UserRole(user_id=user.id, role_id=admin_role.id)
            db.add(ur)

        db.commit()
        db.refresh(user)
        logger.info("Bootstrapped initial administrator account: %s", admin_email)

    return user


def create_default_policies(db: Session) -> None:
    """Provision baseline governance policy suite."""
    policy_specs = [
        # Filesystem
        ("Allow Filesystem List Files", "filesystem.list_files", None, RiskLevel.LOW, PolicyDecision.ALLOW, 10),
        ("Allow Filesystem Read File", "filesystem.read_file", None, RiskLevel.LOW, PolicyDecision.ALLOW, 10),
        ("Require Approval Filesystem Create", "filesystem.create_file", None, RiskLevel.MEDIUM, PolicyDecision.REQUIRE_APPROVAL, 20),
        ("Require Approval Filesystem Update", "filesystem.update_file", None, RiskLevel.MEDIUM, PolicyDecision.REQUIRE_APPROVAL, 20),
        ("Require Approval Filesystem Delete", "filesystem.delete_file", None, RiskLevel.HIGH, PolicyDecision.REQUIRE_APPROVAL, 30),

        # GitHub
        ("Allow GitHub List Repos", "github.list_repos", None, RiskLevel.LOW, PolicyDecision.ALLOW, 10),
        ("Allow GitHub Get Repo", "github.get_repo", None, RiskLevel.LOW, PolicyDecision.ALLOW, 10),
        ("Require Approval GitHub Create Issue", "github.create_issue", None, RiskLevel.MEDIUM, PolicyDecision.REQUIRE_APPROVAL, 20),
        ("Require Approval GitHub Create Branch", "github.create_branch", None, RiskLevel.MEDIUM, PolicyDecision.REQUIRE_APPROVAL, 20),
        ("Require Approval GitHub Update File", "github.update_file", None, RiskLevel.HIGH, PolicyDecision.REQUIRE_APPROVAL, 30),
        ("Require Approval GitHub Delete File", "github.delete_file", None, RiskLevel.HIGH, PolicyDecision.REQUIRE_APPROVAL, 30),

        # Database
        ("Allow Database Select", "database.execute_select", None, RiskLevel.LOW, PolicyDecision.ALLOW, 10),
        ("Require Approval Database Insert", "database.insert_record", None, RiskLevel.MEDIUM, PolicyDecision.REQUIRE_APPROVAL, 20),
        ("Require Approval Database Update", "database.update_record", None, RiskLevel.HIGH, PolicyDecision.REQUIRE_APPROVAL, 30),
        ("Require Approval Database Delete", "database.delete_record", None, RiskLevel.CRITICAL, PolicyDecision.REQUIRE_APPROVAL, 40),

        # Default Fail-Closed Fallback
        ("Default Catch-All Deny", "*", None, None, PolicyDecision.DENY, 9999),
    ]

    for name, pattern, op, risk, decision, prio in policy_specs:
        existing = db.query(Policy).filter(Policy.name == name).first()
        if not existing:
            pol = Policy(
                name=name,
                tool_name_pattern=pattern,
                operation=op,
                risk_level=risk,
                decision=decision,
                priority=prio,
                is_enabled=True,
                conditions={},
            )
            db.add(pol)

    db.commit()
    logger.info("Initialized baseline governance policy rules.")


def on_startup() -> None:
    """Execute startup procedures upon application initialization."""
    logger.info("Starting AgentGuard Gateway Backend initialization...")
    # 1. Initialize DB tables
    init_db()

    # 2. Synchronize tools to DB
    db = SessionLocal()
    try:
        tool_registry.sync_to_db(db)
        roles_map = create_default_roles(db)
        create_first_admin(db, roles_map)
        create_default_policies(db)
    finally:
        db.close()
    logger.info("AgentGuard Gateway Backend successfully initialized.")


def on_shutdown() -> None:
    """Clean up resources on application shutdown."""
    logger.info("AgentGuard Gateway Backend shutting down gracefully.")
