"""
converter — converts ER diagram JSON documents into an intermediate RelationalSchema.

Responsibilities:
  1. Validate diagram structure (table naming, column definitions, relationship endpoints).
  2. Map visual entities (tables) and attributes (fields) to relational Tables and Columns.
  3. Map primary keys (single-column and composite).
  4. Map relationships to ForeignKeys based on cardinality:
     - many_to_one: child (many) table gets FK referencing parent (one) table.
     - one_to_many: child (many) table gets FK referencing parent (one) table.
     - one_to_one: child table gets FK with UNIQUE constraint referencing parent.
     - many_to_many: if drawn directly between two entities without an intermediate
       table, synthesizes the junction table with composite PK and dual FKs.
  5. Translate field check constraints to SQL CHECK expressions.
  6. Sanitize and validate SQL identifiers against SQL injection or invalid characters.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

# Valid identifier: starts with letter or underscore, followed by letters/digits/underscores
IDENTIFIER_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

# Common SQL reserved keywords that need careful handling or quoting
SQL_RESERVED = {
    "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "TABLE", "ALTER",
    "FROM", "WHERE", "JOIN", "ON", "GROUP", "BY", "ORDER", "HAVING", "LIMIT",
    "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CHECK", "UNIQUE", "NOT", "NULL",
    "DEFAULT", "INDEX", "CONSTRAINT", "UNION", "ALL", "AND", "OR", "IN",
}

# Supported SQL operators in check constraints
VALID_OPERATORS = {"=", "!=", "<", "<=", ">", ">=", "IN", "NOT IN", "LIKE"}

# Standard SQL data type normalization map
DATA_TYPE_MAP = {
    "INT": "INTEGER",
    "INTEGER": "INTEGER",
    "BIGINT": "BIGINT",
    "SMALLINT": "SMALLINT",
    "VARCHAR": "VARCHAR(255)",
    "TEXT": "TEXT",
    "CHAR": "CHAR(1)",
    "BOOLEAN": "BOOLEAN",
    "BOOL": "BOOLEAN",
    "DATE": "DATE",
    "DATETIME": "TIMESTAMP",
    "TIMESTAMP": "TIMESTAMP",
    "FLOAT": "REAL",
    "REAL": "REAL",
    "DOUBLE": "REAL",
    "DECIMAL": "NUMERIC",
    "NUMERIC": "NUMERIC",
    "BLOB": "BLOB",
}


class DiagramValidationError(ValueError):
    """Raised when an ER diagram cannot be converted due to structural errors."""

    def __init__(self, errors: List[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


# ══════════════════════════════════════════════════════════════════════════════
#  Intermediate Relational Schema Dataclasses
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class Column:
    """Relational table column definition."""
    name: str
    data_type: str
    is_primary_key: bool = False
    is_not_null: bool = False
    is_unique: bool = False
    is_auto_increment: bool = False
    default_value: Optional[str] = None
    check_expr: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "data_type": self.data_type,
            "is_primary_key": self.is_primary_key,
            "is_not_null": self.is_not_null,
            "is_unique": self.is_unique,
            "is_auto_increment": self.is_auto_increment,
            "default_value": self.default_value,
            "check_expr": self.check_expr,
        }


@dataclass
class ForeignKey:
    """Foreign key constraint from child table columns to parent table columns."""
    columns: List[str]
    ref_table: str
    ref_columns: List[str]
    on_delete: Optional[str] = None
    on_update: Optional[str] = None
    constraint_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "columns": self.columns,
            "ref_table": self.ref_table,
            "ref_columns": self.ref_columns,
            "on_delete": self.on_delete,
            "on_update": self.on_update,
            "constraint_name": self.constraint_name,
        }


@dataclass
class Table:
    """Relational table definition."""
    name: str
    columns: List[Column] = field(default_factory=list)
    primary_key: List[str] = field(default_factory=list)
    foreign_keys: List[ForeignKey] = field(default_factory=list)
    unique_constraints: List[List[str]] = field(default_factory=list)
    check_constraints: List[str] = field(default_factory=list)
    is_synthetic: bool = False

    def column_names(self) -> List[str]:
        return [c.name for c in self.columns]

    def get_column(self, name: str) -> Optional[Column]:
        for c in self.columns:
            if c.name.lower() == name.lower():
                return c
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "columns": [c.to_dict() for c in self.columns],
            "primary_key": self.primary_key,
            "foreign_keys": [fk.to_dict() for fk in self.foreign_keys],
            "unique_constraints": self.unique_constraints,
            "check_constraints": self.check_constraints,
            "is_synthetic": self.is_synthetic,
        }


@dataclass
class RelationalSchema:
    """Complete relational schema containing all tables and constraints."""
    tables: List[Table] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def table_names(self) -> List[str]:
        return [t.name for t in self.tables]

    def get_table(self, name: str) -> Optional[Table]:
        for t in self.tables:
            if t.name.lower() == name.lower():
                return t
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tables": [t.to_dict() for t in self.tables],
            "warnings": self.warnings,
        }


# ══════════════════════════════════════════════════════════════════════════════
#  Identifier & Check Constraint Helpers
# ══════════════════════════════════════════════════════════════════════════════

def is_valid_identifier(name: str) -> bool:
    """Check if name is a safe, valid SQL identifier."""
    return bool(IDENTIFIER_PATTERN.match(name))


def sanitize_identifier(name: str) -> str:
    """
    Sanitize an identifier by replacing spaces/hyphens with underscores.
    Strips dangerous characters (quotes, semicolons, comments) and cleans edges.
    """
    cleaned = re.sub(r"[\s\-]+", "_", name.strip())
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "", cleaned)
    cleaned = cleaned.strip("_")
    if not cleaned:
        cleaned = "ident"
    elif not cleaned[0].isalpha() and cleaned[0] != "_":
        cleaned = "_" + cleaned
    return cleaned


def normalize_data_type(raw_type: str) -> str:
    """Normalizes visual diagram type strings into standard SQL data types."""
    upper = raw_type.strip().upper()
    return DATA_TYPE_MAP.get(upper, upper or "TEXT")


def build_check_expression(check_obj: Optional[Dict[str, Any]], table_col_names: Set[str]) -> Optional[str]:
    """
    Translates a frontend checkConstraint object:
      {"conditions": [{"left": "age", "operator": ">=", "right": "18"}, {"connector": "AND"}, ...]}
    into a valid SQL CHECK condition string:
      "age >= 18"
    """
    if not check_obj or not isinstance(check_obj, dict):
        return None
    conditions = check_obj.get("conditions", [])
    if not conditions:
        return None

    parts: List[str] = []
    for item in conditions:
        if not isinstance(item, dict):
            continue
        if "connector" in item:
            conn = str(item["connector"]).strip().upper()
            if conn in ("AND", "OR"):
                parts.append(conn)
            continue

        left = str(item.get("left", "")).strip()
        op = str(item.get("operator", "")).strip().upper()
        right = str(item.get("right", "")).strip()

        if not left or op not in VALID_OPERATORS or not right:
            continue

        # Format right side: numeric if digits, else quoted string
        if right.isdigit() or (right.startswith("-") and right[1:].isdigit()):
            right_val = right
        elif right.replace(".", "", 1).isdigit() and right.count(".") == 1:
            right_val = right
        elif right.startswith("(") and right.endswith(")"):
            right_val = right
        elif (right.startswith("'") and right.endswith("'")) or (right.startswith('"') and right.endswith('"')):
            right_val = right
        else:
            # Quote raw string safely
            safe_right = right.replace("'", "''")
            right_val = f"'{safe_right}'"

        parts.append(f"{left} {op} {right_val}")

    if not parts:
        return None
    return " ".join(parts)


# ══════════════════════════════════════════════════════════════════════════════
#  Structural Validation
# ══════════════════════════════════════════════════════════════════════════════

def validate_diagram_structure(doc: Dict[str, Any]) -> List[str]:
    """
    Validates the structure of a submitted diagram JSON document.
    Returns a list of error messages (empty if valid).
    """
    errors: List[str] = []

    if not isinstance(doc, dict):
        return ["Diagram document must be a JSON object."]

    tables = doc.get("tables")
    if not isinstance(tables, list):
        return ["Diagram missing 'tables' array."]
    if len(tables) == 0:
        return ["Diagram must contain at least one table."]

    table_ids: Set[Any] = set()
    table_names: Set[str] = set()
    all_fields_by_table: Dict[Any, Dict[Any, Dict[str, Any]]] = {}

    for t_idx, t in enumerate(tables):
        if not isinstance(t, dict):
            errors.append(f"Table at index {t_idx} is not an object.")
            continue

        t_id = t.get("id")
        if t_id is None:
            errors.append(f"Table at index {t_idx} is missing an 'id'.")
        elif t_id in table_ids:
            errors.append(f"Duplicate table id '{t_id}'.")
        else:
            table_ids.add(t_id)

        raw_name = str(t.get("name", "")).strip()
        if not raw_name:
            errors.append(f"Table at index {t_idx} (id: {t_id}) has an empty name.")
        else:
            sanitized = sanitize_identifier(raw_name)
            if not is_valid_identifier(sanitized):
                errors.append(f"Table name '{raw_name}' is not a valid SQL identifier.")
            if raw_name.lower() in table_names:
                errors.append(f"Duplicate table name '{raw_name}'.")
            else:
                table_names.add(raw_name.lower())

        # Validate fields
        fields_list = t.get("fields")
        if not isinstance(fields_list, list):
            errors.append(f"Table '{raw_name or t_id}' missing 'fields' array.")
            continue
        if len(fields_list) == 0:
            errors.append(f"Table '{raw_name or t_id}' has no fields/columns.")
            continue

        field_ids: Set[Any] = set()
        field_names: Set[str] = set()
        table_fields_dict: Dict[Any, Dict[str, Any]] = {}
        has_pk = False

        for f_idx, f in enumerate(fields_list):
            if not isinstance(f, dict):
                errors.append(f"Field at index {f_idx} in table '{raw_name}' is not an object.")
                continue

            f_id = f.get("id")
            if f_id is None:
                errors.append(f"Field at index {f_idx} in table '{raw_name}' is missing an 'id'.")
            elif f_id in field_ids:
                errors.append(f"Duplicate field id '{f_id}' in table '{raw_name}'.")
            else:
                field_ids.add(f_id)

            f_name = str(f.get("name", "")).strip()
            if not f_name:
                errors.append(f"Field at index {f_idx} in table '{raw_name}' has an empty name.")
            else:
                sanitized_f = sanitize_identifier(f_name)
                if not is_valid_identifier(sanitized_f):
                    errors.append(f"Field name '{f_name}' in table '{raw_name}' is not a valid SQL identifier.")
                if f_name.lower() in field_names:
                    errors.append(f"Duplicate field '{f_name}' in table '{raw_name}'.")
                else:
                    field_names.add(f_name.lower())

            if bool(f.get("primaryKey")):
                has_pk = True

            table_fields_dict[f_id] = f

        all_fields_by_table[t_id] = table_fields_dict

    # Validate relationships
    relationships = doc.get("relationships", [])
    if relationships is not None:
        if not isinstance(relationships, list):
            errors.append("'relationships' must be an array.")
        else:
            valid_cardinalities = {"one_to_one", "one_to_many", "many_to_one", "many_to_many"}
            for r_idx, r in enumerate(relationships):
                if not isinstance(r, dict):
                    errors.append(f"Relationship at index {r_idx} is not an object.")
                    continue

                card = r.get("cardinality", "many_to_one")
                if card not in valid_cardinalities:
                    errors.append(f"Relationship at index {r_idx} has invalid cardinality '{card}'.")

                st = r.get("startTable")
                sf = r.get("startField")
                et = r.get("endTable")
                ef = r.get("endField")

                if st not in all_fields_by_table:
                    errors.append(f"Relationship {r.get('id', r_idx)} references non-existent startTable '{st}'.")
                elif sf is not None and sf not in all_fields_by_table[st]:
                    errors.append(f"Relationship {r.get('id', r_idx)} references non-existent startField '{sf}' in table '{st}'.")

                if et not in all_fields_by_table:
                    errors.append(f"Relationship {r.get('id', r_idx)} references non-existent endTable '{et}'.")
                elif ef is not None and ef not in all_fields_by_table[et]:
                    errors.append(f"Relationship {r.get('id', r_idx)} references non-existent endField '{ef}' in table '{et}'.")

    return errors


# ══════════════════════════════════════════════════════════════════════════════
#  Conversion Logic: Diagram JSON → RelationalSchema
# ══════════════════════════════════════════════════════════════════════════════

def convert_diagram_to_relational(
    doc: Dict[str, Any],
    synthesize_m2m_junctions: bool = True,
) -> RelationalSchema:
    """
    Converts a validated diagram JSON into a RelationalSchema.
    
    Args:
        doc: Diagram JSON document with 'tables' and 'relationships'.
        synthesize_m2m_junctions: If True, direct many-to-many relationships
          between two tables will synthesize a junction table.
          
    Returns:
        RelationalSchema instance.
        
    Raises:
        DiagramValidationError: If fatal structural errors exist in the document.
    """
    errors = validate_diagram_structure(doc)
    if errors:
        raise DiagramValidationError(errors)

    warnings: List[str] = []
    tables_map: Dict[Any, Table] = {}
    table_id_to_name: Dict[Any, str] = {}
    field_id_to_col: Dict[Any, Tuple[str, str]] = {}  # field_id -> (table_name, col_name)
    table_id_to_table_obj: Dict[Any, Table] = {}

    # 1. Process Tables and Columns
    for t_data in doc["tables"]:
        t_id = t_data["id"]
        t_name = sanitize_identifier(str(t_data.get("name", "")).strip())
        table_id_to_name[t_id] = t_name

        columns: List[Column] = []
        pk_cols: List[str] = []
        unique_constraints: List[List[str]] = []
        table_col_names: Set[str] = {
            sanitize_identifier(str(f.get("name", "")).strip())
            for f in t_data.get("fields", [])
        }

        for f_data in t_data.get("fields", []):
            f_id = f_data["id"]
            f_name = sanitize_identifier(str(f_data.get("name", "")).strip())
            field_id_to_col[f_id] = (t_name, f_name)

            data_type = normalize_data_type(str(f_data.get("type", "TEXT")))
            is_pk = bool(f_data.get("primaryKey"))
            is_nn = bool(f_data.get("notNull")) or is_pk
            is_uq = bool(f_data.get("unique"))
            is_ai = bool(f_data.get("increment"))
            default_val = str(f_data.get("def", "")).strip() or None

            # Parse check constraint
            raw_check = f_data.get("checkConstraint")
            check_expr = build_check_expression(raw_check, table_col_names)

            if is_pk:
                pk_cols.append(f_name)

            col = Column(
                name=f_name,
                data_type=data_type,
                is_primary_key=is_pk,
                is_not_null=is_nn,
                is_unique=is_uq,
                is_auto_increment=is_ai,
                default_value=default_val,
                check_expr=check_expr,
            )
            columns.append(col)

        table_obj = Table(
            name=t_name,
            columns=columns,
            primary_key=pk_cols,
            unique_constraints=unique_constraints,
        )
        tables_map[t_id] = table_obj
        table_id_to_table_obj[t_id] = table_obj

    # 2. Process Relationships into Foreign Keys
    relationships = doc.get("relationships", []) or []
    direct_m2m_relationships: List[Dict[str, Any]] = []

    for r in relationships:
        card = r.get("cardinality", "many_to_one")
        st_id = r.get("startTable")
        sf_id = r.get("startField")
        et_id = r.get("endTable")
        ef_id = r.get("endField")

        start_table = table_id_to_table_obj.get(st_id)
        end_table = table_id_to_table_obj.get(et_id)

        if not start_table or not end_table:
            continue

        if card == "many_to_many":
            direct_m2m_relationships.append(r)
            continue

        # In standard ER diagram modeling:
        # 'many_to_one': startTable (many) has FK pointing to endTable (one).
        # 'one_to_many': endTable (many) has FK pointing to startTable (one).
        # 'one_to_one': startTable has FK pointing to endTable with UNIQUE.
        if card == "many_to_one":
            child_table = start_table
            parent_table = end_table
            child_field_id = sf_id
            parent_field_id = ef_id
            is_unique_fk = False
        elif card == "one_to_many":
            child_table = end_table
            parent_table = start_table
            child_field_id = ef_id
            parent_field_id = sf_id
            is_unique_fk = False
        elif card == "one_to_one":
            child_table = start_table
            parent_table = end_table
            child_field_id = sf_id
            parent_field_id = ef_id
            is_unique_fk = True
        else:
            continue

        # Resolve column names
        child_col_info = field_id_to_col.get(child_field_id)
        parent_col_info = field_id_to_col.get(parent_field_id)

        child_col = child_col_info[1] if child_col_info else None
        parent_col = parent_col_info[1] if parent_col_info else None

        # Fallback if field was not explicitly targeted: use parent PK
        if not parent_col and parent_table.primary_key:
            parent_col = parent_table.primary_key[0]

        if child_col and parent_col:
            # Check if this FK already exists to avoid duplicates
            already_exists = any(
                fk.ref_table == parent_table.name
                and fk.columns == [child_col]
                and fk.ref_columns == [parent_col]
                for fk in child_table.foreign_keys
            )
            if not already_exists:
                fk_name = f"fk_{child_table.name}_{parent_table.name}_{child_col}"
                child_table.foreign_keys.append(
                    ForeignKey(
                        columns=[child_col],
                        ref_table=parent_table.name,
                        ref_columns=[parent_col],
                        constraint_name=fk_name,
                    )
                )

            # If 1:1, ensure child column has a UNIQUE constraint
            if is_unique_fk:
                target_col = child_table.get_column(child_col)
                if target_col:
                    target_col.is_unique = True
                if [child_col] not in child_table.unique_constraints:
                    child_table.unique_constraints.append([child_col])

    # 3. Handle Direct Many-to-Many Relationships
    existing_table_names_lower = {t.name.lower() for t in tables_map.values()}

    for r in direct_m2m_relationships:
        st_id = r.get("startTable")
        et_id = r.get("endTable")
        start_table = table_id_to_table_obj[st_id]
        end_table = table_id_to_table_obj[et_id]

        if synthesize_m2m_junctions:
            # Check if student already explicitly created an intermediate table
            # e.g. "Student_Course" or "Course_Student"
            synth_name_1 = f"{start_table.name}_{end_table.name}"
            synth_name_2 = f"{end_table.name}_{start_table.name}"

            if synth_name_1.lower() in existing_table_names_lower or synth_name_2.lower() in existing_table_names_lower:
                # Student already created the junction table explicitly
                warnings.append(
                    f"Direct M:N relationship between '{start_table.name}' and '{end_table.name}' "
                    f"skipped because explicit junction table already exists."
                )
                continue

            # Determine parent PKs
            pk1 = start_table.primary_key[0] if start_table.primary_key else f"{start_table.name.lower()}_id"
            pk2 = end_table.primary_key[0] if end_table.primary_key else f"{end_table.name.lower()}_id"

            col1_name = pk1 if pk1 != pk2 else f"{start_table.name.lower()}_{pk1}"
            col2_name = pk2 if pk1 != pk2 else f"{end_table.name.lower()}_{pk2}"

            # Get types from parent tables
            c1_type = start_table.get_column(pk1).data_type if start_table.get_column(pk1) else "INTEGER"
            c2_type = end_table.get_column(pk2).data_type if end_table.get_column(pk2) else "INTEGER"

            synth_table = Table(
                name=synth_name_1,
                columns=[
                    Column(name=col1_name, data_type=c1_type, is_primary_key=True, is_not_null=True),
                    Column(name=col2_name, data_type=c2_type, is_primary_key=True, is_not_null=True),
                ],
                primary_key=[col1_name, col2_name],
                foreign_keys=[
                    ForeignKey(
                        columns=[col1_name],
                        ref_table=start_table.name,
                        ref_columns=[pk1],
                        constraint_name=f"fk_{synth_name_1}_{start_table.name}",
                    ),
                    ForeignKey(
                        columns=[col2_name],
                        ref_table=end_table.name,
                        ref_columns=[pk2],
                        constraint_name=f"fk_{synth_name_1}_{end_table.name}",
                    ),
                ],
                is_synthetic=True,
            )
            tables_map[f"synth_{synth_name_1}"] = synth_table
            existing_table_names_lower.add(synth_name_1.lower())
            warnings.append(
                f"Synthesized relational junction table '{synth_name_1}' from direct M:N relationship."
            )

    return RelationalSchema(
        tables=list(tables_map.values()),
        warnings=warnings,
    )


# ══════════════════════════════════════════════════════════════════════════════
#  Serialization Helpers
# ══════════════════════════════════════════════════════════════════════════════

def schema_to_dict(schema: RelationalSchema) -> Dict[str, Any]:
    """Serialize RelationalSchema to a plain JSON-serializable dictionary."""
    return schema.to_dict()


def schema_from_dict(d: Dict[str, Any]) -> RelationalSchema:
    """Deserialize a dictionary back into a RelationalSchema instance."""
    tables: List[Table] = []
    for t_data in d.get("tables", []):
        columns = [
            Column(
                name=c["name"],
                data_type=c["data_type"],
                is_primary_key=c.get("is_primary_key", False),
                is_not_null=c.get("is_not_null", False),
                is_unique=c.get("is_unique", False),
                is_auto_increment=c.get("is_auto_increment", False),
                default_value=c.get("default_value"),
                check_expr=c.get("check_expr"),
            )
            for c in t_data.get("columns", [])
        ]
        fks = [
            ForeignKey(
                columns=fk["columns"],
                ref_table=fk["ref_table"],
                ref_columns=fk["ref_columns"],
                on_delete=fk.get("on_delete"),
                on_update=fk.get("on_update"),
                constraint_name=fk.get("constraint_name"),
            )
            for fk in t_data.get("foreign_keys", [])
        ]
        tables.append(
            Table(
                name=t_data["name"],
                columns=columns,
                primary_key=t_data.get("primary_key", []),
                foreign_keys=fks,
                unique_constraints=t_data.get("unique_constraints", []),
                check_constraints=t_data.get("check_constraints", []),
                is_synthetic=t_data.get("is_synthetic", False),
            )
        )
    return RelationalSchema(tables=tables, warnings=d.get("warnings", []))
