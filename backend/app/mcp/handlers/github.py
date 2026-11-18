"""GitHub Tool Handlers with Production PyGithub and Local-Mode Emulation."""

from typing import Any
from app.config import settings


def _is_local_mode() -> bool:
    """Return True if no GitHub token is configured."""
    return not bool(settings.GITHUB_TOKEN and settings.GITHUB_TOKEN.strip())


async def handle_list_repos(arguments: dict[str, Any]) -> dict[str, Any]:
    """List accessible GitHub repositories."""
    if _is_local_mode():
        return {
            "mode": "LOCAL_SIMULATION",
            "message": "GITHUB_TOKEN not configured. Returning simulated repository list.",
            "repositories": [
                {
                    "name": "agentguard",
                    "full_name": "agentguard/agentguard",
                    "private": True,
                    "html_url": "https://github.com/agentguard/agentguard",
                    "description": "AI Agent Governance Gateway",
                },
                {
                    "name": "sample-agent-service",
                    "full_name": "agentguard/sample-agent-service",
                    "private": False,
                    "html_url": "https://github.com/agentguard/sample-agent-service",
                    "description": "Demo consumer of MCP gateway",
                },
            ],
        }

    from github import Github
    gh = Github(settings.GITHUB_TOKEN)
    user = gh.get_user()
    repos = []
    limit = int(arguments.get("limit", 10))
    for r in user.get_repos()[:limit]:
        repos.append({
            "name": r.name,
            "full_name": r.full_name,
            "private": r.private,
            "html_url": r.html_url,
            "description": r.description,
        })
    return {"mode": "LIVE_GITHUB", "total": len(repos), "repositories": repos}


async def handle_get_repo(arguments: dict[str, Any]) -> dict[str, Any]:
    """Fetch metadata for a specific repository."""
    repo_name = arguments.get("repo")
    if not repo_name:
        raise ValueError("Argument 'repo' is required (e.g. 'owner/repo').")

    if _is_local_mode():
        return {
            "mode": "LOCAL_SIMULATION",
            "message": "GITHUB_TOKEN not configured. Returning simulated repository info.",
            "repository": {
                "name": repo_name.split("/")[-1],
                "full_name": repo_name,
                "default_branch": "main",
                "open_issues_count": 0,
                "private": True,
            },
        }

    from github import Github
    gh = Github(settings.GITHUB_TOKEN)
    repo = gh.get_repo(repo_name)
    return {
        "mode": "LIVE_GITHUB",
        "repository": {
            "name": repo.name,
            "full_name": repo.full_name,
            "default_branch": repo.default_branch,
            "open_issues_count": repo.open_issues_count,
            "private": repo.private,
            "html_url": repo.html_url,
        },
    }


async def handle_create_issue(arguments: dict[str, Any]) -> dict[str, Any]:
    """Create an issue in a repository."""
    repo_name = arguments.get("repo")
    title = arguments.get("title")
    body = arguments.get("body", "")

    if not repo_name or not title:
        raise ValueError("Arguments 'repo' and 'title' are required.")

    if _is_local_mode():
        return {
            "mode": "LOCAL_SIMULATION",
            "message": "GITHUB_TOKEN not configured. Simulated issue creation.",
            "issue": {
                "number": 101,
                "title": title,
                "body": body,
                "state": "open",
                "html_url": f"https://github.com/{repo_name}/issues/101",
            },
        }

    from github import Github
    gh = Github(settings.GITHUB_TOKEN)
    repo = gh.get_repo(repo_name)
    issue = repo.create_issue(title=title, body=body)
    return {
        "mode": "LIVE_GITHUB",
        "issue": {
            "number": issue.number,
            "title": issue.title,
            "state": issue.state,
            "html_url": issue.html_url,
        },
    }


async def handle_create_branch(arguments: dict[str, Any]) -> dict[str, Any]:
    """Create a new git branch in a repository."""
    repo_name = arguments.get("repo")
    branch_name = arguments.get("branch")
    source_branch = arguments.get("source_branch", "main")

    if not repo_name or not branch_name:
        raise ValueError("Arguments 'repo' and 'branch' are required.")

    if _is_local_mode():
        return {
            "mode": "LOCAL_SIMULATION",
            "message": "GITHUB_TOKEN not configured. Simulated branch creation.",
            "branch": branch_name,
            "source_branch": source_branch,
            "ref": f"refs/heads/{branch_name}",
        }

    from github import Github
    gh = Github(settings.GITHUB_TOKEN)
    repo = gh.get_repo(repo_name)
    sb = repo.get_branch(source_branch)
    ref = repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=sb.commit.sha)
    return {
        "mode": "LIVE_GITHUB",
        "branch": branch_name,
        "ref": ref.ref,
        "sha": sb.commit.sha,
    }


async def handle_update_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """Commit an update to a file in a GitHub repository."""
    repo_name = arguments.get("repo")
    path = arguments.get("path")
    content = arguments.get("content", "")
    message = arguments.get("message", "Update file via AgentGuard")
    branch = arguments.get("branch", "main")

    if not repo_name or not path:
        raise ValueError("Arguments 'repo' and 'path' are required.")

    if _is_local_mode():
        return {
            "mode": "LOCAL_SIMULATION",
            "message": "GITHUB_TOKEN not configured. Simulated file commit.",
            "path": path,
            "branch": branch,
            "commit_sha": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
        }

    from github import Github
    gh = Github(settings.GITHUB_TOKEN)
    repo = gh.get_repo(repo_name)
    try:
        contents = repo.get_contents(path, ref=branch)
        result = repo.update_file(
            path=path,
            message=message,
            content=content,
            sha=contents.sha,
            branch=branch,
        )
    except Exception:
        result = repo.create_file(
            path=path,
            message=message,
            content=content,
            branch=branch,
        )

    return {
        "mode": "LIVE_GITHUB",
        "path": path,
        "branch": branch,
        "commit_sha": result["commit"].sha,
    }


async def handle_delete_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """Delete a file from a GitHub repository."""
    repo_name = arguments.get("repo")
    path = arguments.get("path")
    message = arguments.get("message", "Delete file via AgentGuard")
    branch = arguments.get("branch", "main")

    if not repo_name or not path:
        raise ValueError("Arguments 'repo' and 'path' are required.")

    if _is_local_mode():
        return {
            "mode": "LOCAL_SIMULATION",
            "message": "GITHUB_TOKEN not configured. Simulated file deletion.",
            "path": path,
            "branch": branch,
            "deleted": True,
        }

    from github import Github
    gh = Github(settings.GITHUB_TOKEN)
    repo = gh.get_repo(repo_name)
    contents = repo.get_contents(path, ref=branch)
    res = repo.delete_file(
        path=path,
        message=message,
        sha=contents.sha,
        branch=branch,
    )
    return {
        "mode": "LIVE_GITHUB",
        "path": path,
        "branch": branch,
        "commit_sha": res["commit"].sha,
        "deleted": True,
    }
