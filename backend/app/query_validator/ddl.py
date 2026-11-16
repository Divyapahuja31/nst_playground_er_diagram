"""
ddl — SQL DDL Generator for RelationalSchema.

Responsibilities:
  1. Generate database-specific DDL (SQLite & standard ANSI SQL) from RelationalSchema.
  2. Produce safe identifier quoting ("identifier") to avoid keyword collisions or injection.
  3. Emit CREATE TABLE statements with:
     - Columns, data types, nullability, defaults, column-level checks.
     - Single-column and composite PRIMARY KEY constraints.
     - FOREIGN KEY constraints with parent table and column references.
     - UNIQUE constraints (column and table level).
     - Table-level CHECK constraints.
  4. Topologically sort tables so referenced parent tables are created before child tables.
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set

from app.query_validator.converter import Column, ForeignKey, RelationalSchema, Table


def quote_identifier(name: str, dialect: str = "sqlite") -> str:
    """
    Safely quote a SQL identifier.
    Uses standard double-quotes with internal quotes escaped.
    """
    escaped = name.replace('"', '""')
    return f'"{escaped}"'


def format_default_value(val: Optional[str]) -> Optional[str]:
    """
    Formats a default value string for a SQL column definition.
    Preserves SQL keywords / function calls like CURRENT_TIMESTAMP, NULL, TRUE, FALSE.
    Quotes raw string literals appropriately.
    """
    if val is None:
        return None
    val_str = str(val).strip()
    if not val_str:
        return None

    # Check for SQL keywords / function calls / numeric literals
    upper = val_str.upper()
    if upper in ("CURRENT_TIMESTAMP", "CURRENT_DATE", "CURRENT_TIME", "NULL", "TRUE", "FALSE"):
        return upper
    if val_str.isdigit() or (val_str.startswith("-") and val_str[1:].isdigit()):
        return val_str
    if val_str.replace(".", "", 1).isdigit() and val_str.count(".") == 1:
        return val_str
    if (val_str.startswith("'") and val_str.endswith("'")) or (val_str.startswith('"') and val_str.endswith('"')):
        return val_str

    # Wrap raw string literal in single quotes with escaped internal quotes
    escaped = val_str.replace("'", "''")
    return f"'{escaped}'"


def sort_tables_topologically(tables: List[Table]) -> List[Table]:
    """
    Sorts tables so parent tables (those referenced by foreign keys)
    appear before child tables (those containing foreign keys).
    Handles potential cycles or self-references gracefully.
    """
    table_map = {t.name.lower(): t for t in tables}
    in_degree: Dict[str, int] = {t.name.lower(): 0 for t in tables}
    adj_list: Dict[str, Set[str]] = defaultdict(set)

    for t in tables:
        t_key = t.name.lower()
        for fk in t.foreign_keys:
            parent_key = fk.ref_table.lower()
            # If referencing another table that exists in this schema
            if parent_key in table_map and parent_key != t_key:
                if t_key not in adj_list[parent_key]:
                    adj_list[parent_key].add(t_key)
                    in_degree[t_key] += 1

    queue = deque([t_key for t_key, deg in in_degree.items() if deg == 0])
    sorted_keys: List[str] = []

    while queue:
        curr = queue.popleft()
        sorted_keys.append(curr)
        for neighbor in adj_list[curr]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # If there are circular dependencies, append remaining tables
    for t in tables:
        t_key = t.name.lower()
        if t_key not in sorted_keys:
            sorted_keys.append(t_key)

    return [table_map[k] for k in sorted_keys]


def generate_column_def(col: Column, is_composite_pk: bool = False, dialect: str = "sqlite") -> str:
    """
    Generates a single column definition:
    e.g. "student_id" INTEGER NOT NULL
    """
    q_name = quote_identifier(col.name, dialect)
    parts = [q_name, col.data_type]

    # Primary key (if single-column PK, can be inline; if composite, handled at table level)
    if col.is_primary_key and not is_composite_pk:
        parts.append("PRIMARY KEY")
        if col.is_auto_increment and dialect == "sqlite":
            parts.append("AUTOINCREMENT")

    if col.is_not_null and not (col.is_primary_key and not is_composite_pk):
        parts.append("NOT NULL")

    if col.is_unique and not col.is_primary_key:
        parts.append("UNIQUE")

    formatted_default = format_default_value(col.default_value)
    if formatted_default is not None:
        parts.append(f"DEFAULT {formatted_default}")

    if col.check_expr:
        parts.append(f"CHECK ({col.check_expr})")

    return " ".join(parts)


def generate_create_table_sql(table: Table, dialect: str = "sqlite") -> str:
    """
    Generates a CREATE TABLE statement for a single Table.
    Includes columns, primary key, foreign keys, uniqueness, and check constraints.
    """
    q_table_name = quote_identifier(table.name, dialect)
    lines: List[str] = []

    is_composite_pk = len(table.primary_key) > 1

    # 1. Column definitions
    for col in table.columns:
        lines.append(f"    {generate_column_def(col, is_composite_pk=is_composite_pk, dialect=dialect)}")

    # 2. Table-level Primary Key (used for composite PKs or when preferred)
    if is_composite_pk:
        q_pk_cols = ", ".join(quote_identifier(c, dialect) for c in table.primary_key)
        lines.append(f"    PRIMARY KEY ({q_pk_cols})")

    # 3. Foreign Key constraints
    for fk in table.foreign_keys:
        q_child_cols = ", ".join(quote_identifier(c, dialect) for c in fk.columns)
        q_parent_table = quote_identifier(fk.ref_table, dialect)
        q_parent_cols = ", ".join(quote_identifier(c, dialect) for c in fk.ref_columns)

        fk_clause = f"FOREIGN KEY ({q_child_cols}) REFERENCES {q_parent_table} ({q_parent_cols})"
        if fk.on_delete:
            fk_clause += f" ON DELETE {fk.on_delete.upper()}"
        if fk.on_update:
            fk_clause += f" ON UPDATE {fk.on_update.upper()}"

        if fk.constraint_name:
            q_cname = quote_identifier(fk.constraint_name, dialect)
            lines.append(f"    CONSTRAINT {q_cname} {fk_clause}")
        else:
            lines.append(f"    {fk_clause}")

    # 4. Table-level Unique constraints
    for uq_cols in table.unique_constraints:
        # Skip single-column uniqueness if already defined at column level
        if len(uq_cols) == 1 and table.get_column(uq_cols[0]) and table.get_column(uq_cols[0]).is_unique:
            continue
        q_cols = ", ".join(quote_identifier(c, dialect) for c in uq_cols)
        lines.append(f"    UNIQUE ({q_cols})")

    # 5. Table-level Check constraints
    for chk in table.check_constraints:
        lines.append(f"    CHECK ({chk})")

    body = ",\n".join(lines)
    return f"CREATE TABLE {q_table_name} (\n{body}\n);"


def generate_schema_ddl(
    schema: RelationalSchema,
    dialect: str = "sqlite",
    sort_tables: bool = True,
) -> str:
    """
    Generates complete DDL for all tables in a RelationalSchema.
    Tables are ordered topologically so referenced parent tables are created first.
    """
    tables = sort_tables_topologically(schema.tables) if sort_tables else schema.tables
    statements = [generate_create_table_sql(t, dialect=dialect) for t in tables]
    return "\n\n".join(statements)
