from dataclasses import dataclass, field

class SchemaError(ValueError):
    """Raised when an incoming diagram document is malformed."""

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


def parse_diagram(doc, who='diagram'):
    tables = []
    for table_idx, table in enumerate(doc['tables']):
        fields = []
        for field_idx, field in enumerate(table['fields']):
            fields.append(Field(
                id=field['id'],
                name=str(field.get('name', '')),
                type=field['type'].strip().upper(),
                primary_key=bool(field.get('primaryKey')),
                not_null=bool(field.get('notNull')),
                unique=bool(field.get('unique')),
                increment=bool(field.get('increment')),
                default=str(field.get('def', '')),
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