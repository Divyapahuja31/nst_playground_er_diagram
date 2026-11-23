"""
sandbox — isolated in-memory SQLite sandbox environment for DDL & query validation.

Features:
  1. 100% isolated: uses in-memory SQLite (":memory:"), fully isolated from production DB.
  2. Enforces Foreign Key constraints (PRAGMA foreign_keys = ON;).
  3. Clean lifecycle management via Context Manager.
  4. Inspection methods for table definitions, columns, and foreign keys.
  5. Safe execution wrapping with descriptive error feedback.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, List, Optional, Tuple


class SandboxExecutionError(Exception):
    """Raised when DDL or SQL execution fails in the sandbox environment."""

    def __init__(self, message: str, sql: Optional[str] = None, original_error: Optional[Exception] = None):
        super().__init__(message)
        self.message = message
        self.sql = sql
        self.original_error = original_error


class SandboxDatabase:
    """
    An isolated in-memory SQLite sandbox instance.
    Enforces foreign keys and provides query execution and schema inspection.
    """

    def __init__(self, foreign_keys: bool = True):
        self._enforce_foreign_keys = foreign_keys
        self._conn: Optional[sqlite3.Connection] = None

    def __enter__(self) -> "SandboxDatabase":
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def open(self) -> None:
        """Opens the in-memory SQLite connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(":memory:")
            self._conn.row_factory = sqlite3.Row
            if self._enforce_foreign_keys:
                self._conn.execute("PRAGMA foreign_keys = ON;")

    def close(self) -> None:
        """Closes the connection and discards the in-memory database."""
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None

    @property
    def connection(self) -> sqlite3.Connection:
        if self._conn is None:
            self.open()
        assert self._conn is not None
        return self._conn

    def execute_ddl(self, ddl: str) -> None:
        """
        Executes a multi-statement DDL script inside the sandbox.
        Raises SandboxExecutionError on failure.
        """
        if not ddl.strip():
            return
        try:
            self.connection.executescript(ddl)
        except sqlite3.Error as e:
            raise SandboxExecutionError(
                message=f"DDL execution failed: {e}",
                sql=ddl,
                original_error=e,
            ) from e

    def execute_statement(self, sql: str, params: Tuple[Any, ...] = ()) -> int:
        """
        Executes a single DML statement (INSERT, UPDATE, DELETE).
        Returns the number of affected rows.
        """
        try:
            cursor = self.connection.execute(sql, params)
            self.connection.commit()
            return cursor.rowcount
        except sqlite3.Error as e:
            self.connection.rollback()
            raise SandboxExecutionError(
                message=f"Statement execution failed: {e}",
                sql=sql,
                original_error=e,
            ) from e

    def execute_query(self, sql: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
        """
        Executes a SELECT query and returns rows as dictionaries.
        """
        try:
            cursor = self.connection.execute(sql, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            raise SandboxExecutionError(
                message=f"Query execution failed: {e}",
                sql=sql,
                original_error=e,
            ) from e

    def get_tables(self) -> List[str]:
        """Returns the list of user tables created in the sandbox."""
        query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
        rows = self.execute_query(query)
        return [r["name"] for r in rows]

    def get_table_columns(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Inspects columns of a table via PRAGMA table_info.
        Returns list of dicts: [{'cid': 0, 'name': 'id', 'type': 'INTEGER', 'notnull': 1, 'dflt_value': None, 'pk': 1}, ...]
        """
        safe_name = table_name.replace('"', '""')
        return self.execute_query(f'PRAGMA table_info("{safe_name}");')

    def get_foreign_keys(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Inspects foreign keys of a table via PRAGMA foreign_key_list.
        Returns list of dicts: [{'id': 0, 'seq': 0, 'table': 'Student', 'from': 'student_id', 'to': 'student_id', ...}, ...]
        """
        safe_name = table_name.replace('"', '""')
        return self.execute_query(f'PRAGMA foreign_key_list("{safe_name}");')
