"""Official Model Context Protocol (MCP) Server Implementation with SSE Transport."""

import json
import logging
from typing import Any
from app.mcp.gateway import mcp_gateway
from app.mcp.tool_registry import tool_registry
from app.database import SessionLocal
from app.models.agent import Agent

logger = logging.getLogger("agentguard.mcp.server")

try:
    from mcp.server.fastmcp import FastMCP
    HAS_FASTMCP = True
except ImportError:
    HAS_FASTMCP = False
    logger.warning("mcp Python SDK FastMCP not available; using native MCP dispatch adapter.")


def create_mcp_server() -> Any:
    """Create and configure MCP Server instance dynamically registering all registry tools."""
    if not HAS_FASTMCP:
        return None

    server = FastMCP("AgentGuard Gateway")

    # Register each tool from our registry to FastMCP
    for tool_def in tool_registry.list_all():
        tool_name = tool_def.name

        def make_handler(name: str):
            async def dynamic_mcp_tool_handler(**kwargs: Any) -> str:
                """Bridge MCP tool invocation into AgentGuard governance pipeline."""
                db = SessionLocal()
                try:
                    # Look up default internal agent for MCP direct callers if none provided
                    agent = db.query(Agent).filter(Agent.is_active == True).first()
                    if not agent:
                        return json.dumps({
                            "error": "No active AgentGuard agent found to authorize MCP invocation."
                        })

                    res = await mcp_gateway.invoke_tool(
                        tool_name=name,
                        arguments=kwargs,
                        agent=agent,
                        db=db,
                    )
                    return json.dumps(res, default=str)
                finally:
                    db.close()

            dynamic_mcp_tool_handler.__name__ = name.replace(".", "_")
            dynamic_mcp_tool_handler.__doc__ = tool_def.description
            return dynamic_mcp_tool_handler

        handler_fn = make_handler(tool_name)
        server.add_tool(handler_fn, name=tool_name, description=tool_def.description)

    return server


# Global MCP server instance
mcp_server_instance = create_mcp_server()
