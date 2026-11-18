"""Filesystem Tool Handlers with Strict Sandbox Path Traversal Defense."""

import os
from pathlib import Path
from typing import Any
import aiofiles
import aiofiles.os
from app.config import settings
from app.core.exceptions import SandboxViolationError


def _get_sandbox_root() -> Path:
    """Resolve absolute sandbox directory path and ensure existence."""
    sandbox = Path(settings.FILE_SANDBOX_PATH).resolve()
    sandbox.mkdir(parents=True, exist_ok=True)
    return sandbox


def _validate_path(relative_path: str) -> Path:
    """Validate that target path resides strictly inside the configured sandbox root.
    
    Raises:
        SandboxViolationError: If path attempts directory traversal or escapes sandbox.
    """
    if not relative_path:
        raise SandboxViolationError("Path argument cannot be empty.")

    sandbox_root = _get_sandbox_root()
    # Normalize path and strip leading slashes/drive letters to treat as relative
    clean_rel = os.path.normpath(relative_path).lstrip("/\\")
    resolved = (sandbox_root / clean_rel).resolve()

    # Python 3.9+ is_relative_to
    try:
        is_safe = resolved.is_relative_to(sandbox_root)
    except AttributeError:
        # Fallback for older python or symlink edge-cases
        try:
            resolved.relative_to(sandbox_root)
            is_safe = True
        except ValueError:
            is_safe = False

    if not is_safe:
        raise SandboxViolationError(
            f"Access denied: path '{relative_path}' resolves outside allowed sandbox '{sandbox_root}'."
        )

    return resolved


async def handle_list_files(arguments: dict[str, Any]) -> dict[str, Any]:
    """List files and folders within a sandbox directory."""
    rel_path = arguments.get("path", "")
    target_dir = _validate_path(rel_path)

    if not target_dir.exists():
        return {
            "success": False,
            "error": f"Directory '{rel_path}' does not exist.",
            "entries": [],
        }

    if not target_dir.is_dir():
        return {
            "success": False,
            "error": f"Path '{rel_path}' is not a directory.",
            "entries": [],
        }

    entries = []
    for item in target_dir.iterdir():
        stat = item.stat()
        entries.append({
            "name": item.name,
            "is_directory": item.is_dir(),
            "size_bytes": stat.st_size if item.is_file() else None,
            "modified_at": stat.st_mtime,
        })

    return {
        "success": True,
        "path": rel_path,
        "total_entries": len(entries),
        "entries": entries,
    }


async def handle_read_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """Read textual content of a file located within sandbox."""
    rel_path = arguments.get("path")
    if not rel_path:
        raise ValueError("Argument 'path' is required.")

    target_file = _validate_path(rel_path)
    if not target_file.exists():
        return {"success": False, "error": f"File '{rel_path}' not found."}

    if not target_file.is_file():
        return {"success": False, "error": f"Path '{rel_path}' is a directory, not a file."}

    max_bytes = int(arguments.get("max_bytes", 1024 * 1024))  # 1MB limit by default
    async with aiofiles.open(target_file, mode="r", encoding="utf-8", errors="replace") as f:
        content = await f.read(max_bytes)

    return {
        "success": True,
        "path": rel_path,
        "size_bytes": target_file.stat().st_size,
        "content": content,
    }


async def handle_create_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """Create a new file in sandbox with specified content."""
    rel_path = arguments.get("path")
    if not rel_path:
        raise ValueError("Argument 'path' is required.")

    content = arguments.get("content", "")
    overwrite = bool(arguments.get("overwrite", False))

    target_file = _validate_path(rel_path)
    if target_file.exists() and not overwrite:
        return {
            "success": False,
            "error": f"File '{rel_path}' already exists and overwrite is False.",
        }

    target_file.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(target_file, mode="w", encoding="utf-8") as f:
        await f.write(content)

    return {
        "success": True,
        "path": rel_path,
        "bytes_written": len(content.encode("utf-8")),
    }


async def handle_update_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """Modify content of an existing file in sandbox."""
    rel_path = arguments.get("path")
    if not rel_path:
        raise ValueError("Argument 'path' is required.")

    content = arguments.get("content")
    if content is None:
        raise ValueError("Argument 'content' is required.")

    append_mode = bool(arguments.get("append", False))
    target_file = _validate_path(rel_path)

    if not target_file.exists():
        return {"success": False, "error": f"File '{rel_path}' does not exist."}

    mode = "a" if append_mode else "w"
    async with aiofiles.open(target_file, mode=mode, encoding="utf-8") as f:
        await f.write(content)

    return {
        "success": True,
        "path": rel_path,
        "append": append_mode,
        "size_bytes": target_file.stat().st_size,
    }


async def handle_delete_file(arguments: dict[str, Any]) -> dict[str, Any]:
    """Delete a file or directory from the sandbox."""
    rel_path = arguments.get("path")
    if not rel_path:
        raise ValueError("Argument 'path' is required.")

    target = _validate_path(rel_path)
    if not target.exists():
        return {"success": False, "error": f"Path '{rel_path}' does not exist."}

    if target.is_dir():
        import shutil
        shutil.rmtree(target)
    else:
        target.unlink()

    return {"success": True, "path": rel_path, "deleted": True}
