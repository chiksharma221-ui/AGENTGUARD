"""Database Tool Handlers with SQL Parsing and Injection Defense."""

import re
from typing import Any
import sqlparse
from sqlalchemy import text, inspect
from app.database import engine


def _validate_table_name(table_name: str) -> str:
    """Ensure table name consists only of valid alphanumeric/underscore identifiers."""
    clean = table_name.strip()
    if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", clean):
        raise ValueError(f"Invalid table identifier '{table_name}'.")
    return clean


async def handle_execute_select(arguments: dict[str, Any]) -> dict[str, Any]:
    """Execute a read-only SELECT query with parameter binding and sqlparse validation."""
    query = arguments.get("query", "").strip()
    params = arguments.get("params", {})

    if not query:
        raise ValueError("Argument 'query' is required.")

    # 1. Parse SQL and reject multi-statement injection attempts
    parsed = sqlparse.parse(query)
    if not parsed:
        raise ValueError("Invalid SQL statement syntax.")
    if len(parsed) > 1:
        raise ValueError("Execution of multiple chained SQL statements is strictly prohibited.")

    statement = parsed[0]
    stmt_type = statement.get_type()
    if stmt_type != "SELECT":
        raise ValueError(
            f"Only read-only SELECT statements are permitted. Detected statement type: {stmt_type}"
        )

    # 2. Additional defense-in-depth keyword check
    raw_upper = query.upper()
    destructive_keywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "INSERT", "UPDATE", "GRANT", "REVOKE"]
    for kw in destructive_keywords:
        # Check as isolated token
        if re.search(rf"\b{kw}\b", raw_upper):
            raise ValueError(f"Destructive keyword '{kw}' is prohibited in SELECT handler.")

    # 3. Execute parameterized query
    with engine.connect() as conn:
        result = conn.execute(text(query), params)
        keys = list(result.keys())
        rows = [dict(zip(keys, row)) for row in result.fetchmany(100)]

    return {
        "success": True,
        "row_count": len(rows),
        "columns": keys,
        "rows": rows,
    }


async def handle_insert_record(arguments: dict[str, Any]) -> dict[str, Any]:
    """Insert a record into a table using parameterized columns."""
    table = _validate_table_name(arguments.get("table", ""))
    data = arguments.get("data")
    if not data or not isinstance(data, dict):
        raise ValueError("Argument 'data' must be a non-empty dictionary.")

    columns = [_validate_table_name(c) for c in data.keys()]
    placeholders = [f":{c}" for c in columns]

    col_str = ", ".join(columns)
    val_str = ", ".join(placeholders)
    query_str = f"INSERT INTO {table} ({col_str}) VALUES ({val_str})"

    with engine.begin() as conn:
        conn.execute(text(query_str), data)

    return {
        "success": True,
        "table": table,
        "inserted_columns": columns,
    }


async def handle_update_record(arguments: dict[str, Any]) -> dict[str, Any]:
    """Update records matching condition parameters."""
    table = _validate_table_name(arguments.get("table", ""))
    data = arguments.get("data")
    where_clause = arguments.get("where")
    params = arguments.get("params", {})

    if not data or not isinstance(data, dict):
        raise ValueError("Argument 'data' must be a non-empty dictionary.")
    if not where_clause:
        raise ValueError("Argument 'where' condition is required to prevent accidental full-table overwrite.")

    set_parts = []
    bind_data = dict(params)
    for col, val in data.items():
        clean_col = _validate_table_name(col)
        bind_key = f"set_{clean_col}"
        set_parts.append(f"{clean_col} = :{bind_key}")
        bind_data[bind_key] = val

    set_str = ", ".join(set_parts)
    query_str = f"UPDATE {table} SET {set_str} WHERE {where_clause}"

    with engine.begin() as conn:
        res = conn.execute(text(query_str), bind_data)
        rows_affected = res.rowcount

    return {
        "success": True,
        "table": table,
        "rows_affected": rows_affected,
    }


async def handle_delete_record(arguments: dict[str, Any]) -> dict[str, Any]:
    """Delete records matching condition parameters."""
    table = _validate_table_name(arguments.get("table", ""))
    where_clause = arguments.get("where")
    params = arguments.get("params", {})

    if not where_clause:
        raise ValueError("Argument 'where' condition is required for DELETE operations.")

    query_str = f"DELETE FROM {table} WHERE {where_clause}"

    with engine.begin() as conn:
        res = conn.execute(text(query_str), params)
        rows_affected = res.rowcount

    return {
        "success": True,
        "table": table,
        "rows_deleted": rows_affected,
    }


async def handle_inspect_schema(arguments: dict[str, Any]) -> dict[str, Any]:
    """Inspect database tables, column types, and foreign keys."""
    table_filter = arguments.get("table")
    inspector = inspect(engine)
    all_tables = inspector.get_table_names()

    if table_filter:
        clean_target = _validate_table_name(table_filter)
        tables = [clean_target] if clean_target in all_tables else []
    else:
        tables = all_tables

    schema_info = {}
    for tbl in tables:
        columns = inspector.get_columns(tbl)
        pk_constraint = inspector.get_pk_constraint(tbl)
        schema_info[tbl] = {
            "columns": [
                {
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col.get("nullable", True),
                    "default": str(col.get("default", "")),
                }
                for col in columns
            ],
            "primary_key": pk_constraint.get("constrained_columns", []),
        }

    return {
        "success": True,
        "tables_inspected": len(schema_info),
        "schema": schema_info,
    }
