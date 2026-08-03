from dataclasses import dataclass, field


class SchemaError(ValueError):
    """Raised when an incoming diagram document is malformed."""

VALID_OPERATORS = {'=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN'}

@dataclass
class Field:
    id: int
    name: str
    type: str
    primary_key: bool
    not_null: bool
    unique: bool
    increment: bool
    default: str
    check_constraint: dict  # None or {"conditions": [...]}

@dataclass
class Table:
    id: int
    name: str
    fields: list


@dataclass
class Relationship:
    id: int
    cardinality: str
    start_table: int
    start_field: int
    end_table: int
    end_field: int


@dataclass
class Diagram:
    title: str
    tables: list = field(default_factory=list)
    relationships: list = field(default_factory=list)


def validate_check_constraint(check, field_name, all_field_names):
    """
    Validates a checkConstraint object structurally.
    Returns list of error strings (empty = valid).
    """
    if check is None:
        return []

    errors = []
    conditions = check.get('conditions', [])
    if not conditions:
        return []

    for i, item in enumerate(conditions):
        if 'connector' in item:
            if item['connector'] not in ('AND', 'OR'):
                errors.append(f"Field '{field_name}': invalid connector '{item['connector']}' at position {i}")
            continue

        left = item.get('left', '')
        operator = item.get('operator', '')
        right = str(item.get('right', ''))

        if not left:
            errors.append(f"Field '{field_name}': condition at position {i} missing left column")
        elif left not in all_field_names:
            errors.append(f"Field '{field_name}': referenced column '{left}' does not exist in this table")

        if operator not in VALID_OPERATORS:
            errors.append(f"Field '{field_name}': unsupported operator '{operator}' at position {i}")

        if not right:
            errors.append(f"Field '{field_name}': condition at position {i} missing right value")

    return errors


def parse_diagram(doc, who='diagram'):
    tables = []
    for table_idx, table in enumerate(doc['tables']):
        all_field_names = [str(f.get('name', '')) for f in table['fields']]
        fields = []
        for field_idx, f in enumerate(table['fields']):
            check = f.get('checkConstraint') or None
            fields.append(Field(
                id=f['id'],
                name=str(f.get('name', '')),
                type=f['type'].strip().upper(),
                primary_key=bool(f.get('primaryKey')),
                not_null=bool(f.get('notNull')),
                unique=bool(f.get('unique')),
                increment=bool(f.get('increment')),
                default=str(f.get('def', '')),
                check_constraint=check,
            ))
        tables.append(Table(id=table['id'], name=str(table.get('name', '')), fields=fields))

    relationships = []
    for relation_idx, relationship in enumerate(doc['relationships']):
        card = relationship.get('cardinality', 'many_to_one')
        
        if card == 'one_to_many':
            card = 'many_to_one'
            relationship = {**relationship, 'startTable': relationship['endTable'], 'startField': relationship['endField'],
                 'endTable': relationship['startTable'], 'endField': relationship['startField']}
        relationships.append(Relationship(
            id=relationship.get('id', relation_idx),
            cardinality=card,
            start_table=relationship['startTable'],
            start_field=relationship['startField'],
            end_table=relationship['endTable'],
            end_field=relationship['endField'],
        ))
    return Diagram(title=str(doc.get('title', '')), tables=tables, relationships=relationships)
