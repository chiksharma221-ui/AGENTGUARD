"""Core Governance Policy Engine for AgentGuard."""

import fnmatch
from dataclasses import dataclass, field
from typing import Any
from sqlalchemy.orm import Session
from app.models.agent import Agent
from app.models.policy import Policy, PolicyDecision
from app.models.tool import Tool, RiskLevel
from app.models.user import User


@dataclass
class EvaluationContext:
    """Invocation context passed into the policy engine for evaluation."""

    tool_name: str
    operation: str = ""
    arguments: dict[str, Any] = field(default_factory=dict)
    agent: Agent | None = None
    user: User | None = None
    risk_level: str = RiskLevel.MEDIUM.value
    request_id: str = ""


@dataclass
class EvaluationResult:
    """Outcome and rationale produced by policy evaluation."""

    decision: PolicyDecision
    policy_id: str | None
    policy_name: str | None
    reason: str
    risk_level: str


class PolicyEngine:
    """Deterministic, fail-closed policy evaluation engine."""

    def evaluate(self, ctx: EvaluationContext, db: Session) -> EvaluationResult:
        """Evaluate invocation context against all active policies ordered by priority.
        
        Rules:
        1. Fetch all active policies ordered by priority ASC (1 is highest priority).
        2. Match policies against tool name pattern, operation, risk level, and JSON conditions.
        3. First matching policy wins.
        4. Default: If no policy matches, FAIL-CLOSED and return DENY.
        """
        # Resolve risk level if not explicitly provided
        if not ctx.risk_level or ctx.risk_level == RiskLevel.MEDIUM.value:
            ctx.risk_level = self.get_risk_level_for_tool(ctx.tool_name, db)

        policies = (
            db.query(Policy)
            .filter(Policy.is_enabled == True)
            .order_by(Policy.priority.asc(), Policy.created_at.asc())
            .all()
        )

        for policy in policies:
            if self._match_policy(policy, ctx):
                return EvaluationResult(
                    decision=policy.decision,
                    policy_id=str(policy.id),
                    policy_name=policy.name,
                    reason=f"Matched policy '{policy.name}' (priority {policy.priority})",
                    risk_level=ctx.risk_level,
                )

        # Default fail-closed rule
        return EvaluationResult(
            decision=PolicyDecision.DENY,
            policy_id=None,
            policy_name="DEFAULT_DENY_FALLBACK",
            reason="No matching governance policy allowed this action (Fail-Closed default).",
            risk_level=ctx.risk_level,
        )

    def _match_policy(self, policy: Policy, ctx: EvaluationContext) -> bool:
        """Determine whether a specific policy applies to the invocation context."""
        # 1. Tool name pattern match (supports wildcards, e.g. "filesystem.*", "*")
        pattern = policy.tool_name_pattern or "*"
        if not fnmatch.fnmatchcase(ctx.tool_name, pattern):
            return False

        # 2. Specific tool ID match if specified on policy
        if policy.tool_id is not None:
            # If policy is attached to a specific tool, tool name must match
            if policy.tool and policy.tool.name != ctx.tool_name:
                return False

        # 3. Operation match if specified
        if policy.operation:
            if ctx.operation and ctx.operation != policy.operation:
                return False

        # 4. Risk level match if specified on policy
        if policy.risk_level:
            policy_risk = (
                policy.risk_level.value
                if hasattr(policy.risk_level, "value")
                else str(policy.risk_level)
            )
            if ctx.risk_level != policy_risk:
                return False

        # 5. Evaluate fine-grained JSON conditions
        if policy.conditions and isinstance(policy.conditions, dict):
            if not self._evaluate_conditions(policy.conditions, ctx):
                return False

        return True

    def _evaluate_conditions(
        self,
        conditions: dict[str, Any],
        ctx: EvaluationContext,
    ) -> bool:
        """Evaluate nested condition rules against arguments and agent identity."""
        # Agent allowlist condition
        if "allowed_agents" in conditions:
            allowed = conditions["allowed_agents"]
            if ctx.agent and str(ctx.agent.id) not in allowed and ctx.agent.name not in allowed:
                return False

        # Agent denylist condition
        if "denied_agents" in conditions:
            denied = conditions["denied_agents"]
            if ctx.agent and (str(ctx.agent.id) in denied or ctx.agent.name in denied):
                return False

        # Required arguments condition
        if "required_arguments" in conditions:
            req_args = conditions["required_arguments"]
            for req in req_args:
                if req not in ctx.arguments:
                    return False

        # Forbidden argument values or patterns
        if "forbidden_patterns" in conditions:
            forbidden = conditions["forbidden_patterns"]
            for arg_key, pattern in forbidden.items():
                val = str(ctx.arguments.get(arg_key, ""))
                if fnmatch.fnmatchcase(val, pattern):
                    return False

        return True

    def get_risk_level_for_tool(self, tool_name: str, db: Session) -> str:
        """Resolve the registered risk level for a tool or default to HIGH."""
        tool = db.query(Tool).filter(Tool.name == tool_name).first()
        if tool and tool.risk_level:
            return (
                tool.risk_level.value
                if hasattr(tool.risk_level, "value")
                else str(tool.risk_level)
            )
        return RiskLevel.HIGH.value


# Global policy engine instance
policy_engine = PolicyEngine()
