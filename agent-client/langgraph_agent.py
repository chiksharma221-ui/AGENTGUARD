#!/usr/bin/env python3
"""
AgentGuard LangGraph Agent Demo
A LangGraph-based AI agent that uses the AgentGuard MCP Gateway for all tool access.
"""

import os
import sys
import asyncio
import httpx
import json
from typing import Annotated, TypedDict, Optional, Any
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown

load_dotenv()

# Optional LangGraph import — graceful fallback if not installed
try:
    from langgraph.graph import StateGraph, END
    from langgraph.graph.message import add_messages
    from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
    from langchain_openai import ChatOpenAI
    from langchain_core.tools import tool
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False

console = Console()

GATEWAY_URL = os.getenv("AGENTGUARD_URL", "http://localhost:8000")
AGENT_API_KEY = os.getenv("RESEARCH_AGENT_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


# ─────────────────────────────────────────────────────────────────────────────
# AgentGuard MCP Gateway Tool Wrapper
# All tool calls go through the AgentGuard gateway — never direct
# ─────────────────────────────────────────────────────────────────────────────

class AgentGuardToolClient:
    """Wraps the AgentGuard MCP Gateway as LangChain-compatible tools."""

    def __init__(self, api_key: str, gateway_url: str):
        self.api_key = api_key
        self.gateway_url = gateway_url
        self._pending: dict[str, str] = {}  # tool_call_id -> request_id

    def _make_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.gateway_url,
            headers={"X-Agent-API-Key": self.api_key},
            timeout=30.0,
        )

    async def invoke(self, tool_name: str, arguments: dict) -> dict:
        """Invoke a tool through AgentGuard. Returns gateway response."""
        async with self._make_client() as client:
            resp = await client.post(
                "/mcp/invoke",
                json={"tool_name": tool_name, "arguments": arguments},
            )
            return resp.json()

    async def poll_result(self, request_id: str, max_wait: int = 120) -> dict:
        """Poll for result of a pending approval."""
        import time
        deadline = time.time() + max_wait
        async with self._make_client() as client:
            while time.time() < deadline:
                resp = await client.post(f"/mcp/result/{request_id}")
                data = resp.json()
                if data.get("status") in ("EXECUTED", "REJECTED", "EXPIRED", "FAILED"):
                    return data
                console.print(f"  [dim]⏳ Waiting for human approval (status={data.get('status')})...[/dim]")
                await asyncio.sleep(5)
        return {"status": "TIMEOUT", "error": "Max wait exceeded"}


gateway_client = AgentGuardToolClient(AGENT_API_KEY, GATEWAY_URL)


# ─────────────────────────────────────────────────────────────────────────────
# LangChain Tool Definitions (each calls AgentGuard gateway)
# ─────────────────────────────────────────────────────────────────────────────

async def agentguard_tool_call(tool_name: str, **kwargs) -> str:
    """Generic tool invocation through AgentGuard."""
    result = await gateway_client.invoke(tool_name, kwargs)
    status = result.get("status")

    if status == "EXECUTED":
        return json.dumps({
            "status": "success",
            "result": result.get("result", {}),
            "request_id": result.get("request_id"),
        })
    elif status == "PENDING_APPROVAL":
        request_id = result.get("request_id")
        console.print(
            f"\n  [yellow]⏸ Human approval required[/yellow] for [bold]{tool_name}[/bold]"
        )
        console.print(f"  Request ID: [cyan]{request_id}[/cyan]")
        console.print("  [dim]Waiting for approver to decide in the dashboard...[/dim]")

        # Wait for human decision
        final = await gateway_client.poll_result(request_id)
        if final.get("status") == "EXECUTED":
            return json.dumps({
                "status": "success",
                "result": final.get("result", {}),
                "note": "Executed after human approval",
                "request_id": request_id,
            })
        else:
            return json.dumps({
                "status": "blocked",
                "reason": f"Request {final.get('status').lower()}",
                "request_id": request_id,
            })
    elif status == "DENIED":
        return json.dumps({
            "status": "denied",
            "reason": result.get("reason", "Policy denied this operation"),
        })
    else:
        return json.dumps({"status": status, "details": result})


def make_langgraph_agent():
    """Build a LangGraph agent connected to AgentGuard."""
    if not LANGGRAPH_AVAILABLE:
        return None

    if not OPENAI_API_KEY:
        console.print("[yellow]⚠ OPENAI_API_KEY not set — using mock LLM mode[/yellow]")
        return None

    # Define tools as LangChain tools
    @tool
    async def list_files(directory: str = ".") -> str:
        """List files in a directory. All requests go through AgentGuard."""
        return await agentguard_tool_call("filesystem.list_files", path=directory)

    @tool
    async def read_file(path: str) -> str:
        """Read the contents of a file. All requests go through AgentGuard."""
        return await agentguard_tool_call("filesystem.read_file", path=path)

    @tool
    async def create_file(path: str, content: str) -> str:
        """Create a new file. Requires human approval via AgentGuard."""
        return await agentguard_tool_call("filesystem.create_file", path=path, content=content)

    @tool
    async def delete_file(path: str) -> str:
        """Delete a file. Requires human approval via AgentGuard."""
        return await agentguard_tool_call("filesystem.delete_file", path=path)

    @tool
    async def execute_query(query: str) -> str:
        """Execute a database SELECT query. Goes through AgentGuard."""
        return await agentguard_tool_call("database.execute_select", query=query)

    @tool
    async def list_repositories(username: str = "") -> str:
        """List GitHub repositories. Goes through AgentGuard."""
        return await agentguard_tool_call("github.list_repos", username=username)

    tools = [list_files, read_file, create_file, delete_file, execute_query, list_repositories]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    llm_with_tools = llm.bind_tools(tools)

    # Build LangGraph state machine
    class AgentState(TypedDict):
        messages: Annotated[list, add_messages]

    tools_by_name = {t.name: t for t in tools}

    async def agent_node(state: AgentState):
        """LLM decides what tool to call."""
        response = await llm_with_tools.ainvoke(state["messages"])
        return {"messages": [response]}

    async def tool_node(state: AgentState):
        """Execute tool calls through AgentGuard gateway."""
        last_message = state["messages"][-1]
        results = []
        for tool_call in last_message.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call["args"]
            console.print(f"\n  [cyan]🔧 Agent calling tool:[/cyan] [bold]{tool_name}[/bold]")
            console.print(f"  Args: {json.dumps(tool_args, indent=2)}")

            if tool_name in tools_by_name:
                result = await tools_by_name[tool_name].ainvoke(tool_args)
            else:
                result = json.dumps({"error": f"Unknown tool: {tool_name}"})

            results.append(ToolMessage(
                content=result,
                tool_call_id=tool_call["id"],
            ))
        return {"messages": results}

    def should_continue(state: AgentState):
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


async def run_langgraph_demo():
    """Run the LangGraph agent with example instructions."""
    console.print(Panel(
        "[bold white]AgentGuard[/bold white] × [bold cyan]LangGraph Agent[/bold cyan]\n"
        "[dim]AI agent using AgentGuard MCP Gateway for secure tool access[/dim]",
        border_style="blue",
        padding=(1, 4),
    ))

    if not AGENT_API_KEY:
        console.print("[red]ERROR[/red]: RESEARCH_AGENT_KEY not set in .env")
        console.print("Run: python backend/scripts/seed.py first")
        sys.exit(1)

    agent = make_langgraph_agent()

    # Demo instructions to send to the agent
    instructions = [
        "List the files in the sandbox directory.",
        "Read the contents of hello.txt",
        "Create a new file called agent_report.txt with content 'This report was generated by ResearchAgent on behalf of AgentGuard.'",
    ]

    if agent is None:
        console.print("\n[yellow]ℹ Running in direct API mode (no LLM).[/yellow]")
        console.print("[dim]Set OPENAI_API_KEY to enable full LangGraph agent.[/dim]\n")

        for instruction in instructions:
            console.print(f"\n[bold]User:[/bold] {instruction}")
            # Map instruction to tool call directly
            if "list" in instruction.lower():
                result = await gateway_client.invoke("filesystem.list_files", {"path": "."})
            elif "read" in instruction.lower():
                result = await gateway_client.invoke("filesystem.read_file", {"path": "hello.txt"})
            elif "create" in instruction.lower():
                result = await gateway_client.invoke(
                    "filesystem.create_file",
                    {"path": "agent_report.txt", "content": "This report was generated by ResearchAgent."},
                )
            else:
                result = {"status": "unknown"}

            status = result.get("status", "")
            console.print(f"[bold]AgentGuard Gateway:[/bold] [cyan]{status}[/cyan]")

            if status == "PENDING_APPROVAL":
                console.print(f"  [yellow]Approval required. Request ID: {result.get('request_id')}[/yellow]")
                console.print("  [dim]Approve in the dashboard at http://localhost:3000/approvals[/dim]")
                final = await gateway_client.poll_result(result["request_id"])
                console.print(f"  [bold]Final:[/bold] {final.get('status')}")
            elif status == "EXECUTED":
                console.print(f"  [green]✓ Executed successfully.[/green]")
                res_data = result.get("result", {})
                if res_data:
                    console.print(f"  Result: {json.dumps(res_data, indent=2)[:300]}")
            elif status == "DENIED":
                console.print(f"  [red]✗ Denied:[/red] {result.get('reason')}")
        return

    # Run with actual LangGraph
    system_prompt = """You are ResearchAgent, an AI assistant operating through AgentGuard.
AgentGuard is a security gateway that controls all your tool access.
Some operations require human approval — if a tool returns 'pending approval', inform the user and wait.
Never attempt to bypass AgentGuard or access resources directly.
Always explain what you are doing and why."""

    for instruction in instructions:
        console.print(f"\n[bold]User:[/bold] {instruction}\n")
        final_state = await agent.ainvoke({
            "messages": [
                SystemMessage(content=system_prompt),
                HumanMessage(content=instruction),
            ]
        })
        last_message = final_state["messages"][-1]
        console.print(f"[bold]Agent:[/bold] {last_message.content}\n")
        console.print("─" * 60)


async def main():
    await run_langgraph_demo()


if __name__ == "__main__":
    asyncio.run(main())
