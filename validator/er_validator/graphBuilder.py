from dataclasses import dataclass, field
from itertools import combinations

@dataclass
class ColoredGraph:
    length: int = 0
    edges: list = field(default_factory=list)  
    colors: list = field(default_factory=list) 
    labels: list = field(default_factory=list) 

class ColorTable:
    def __init__(self):
        # Maps a set of properties (e.g. ('FIELD', 'INT', True)) to a unique number to identify different vertex types.
        self._signature_ids = {}
        self._signatures = []

    def intern(self, key):
        if key not in self._signature_ids:
            self._signature_ids[key] = len(self._signatures)
            self._signatures.append(key)
        return self._signature_ids[key]

    def key_of(self, color_id):
        return self._signatures[color_id]

    @staticmethod
    def describe(key):
        """Human-readable form of a color key for mismatch messages."""
        attribute_kind = key[0]
        if attribute_kind == 'FIELD':
            _, datatype, primary_key, not_null, unique, auto_increment = key
            traits = [t for t, on in (
                ('PRIMARY KEY', primary_key), ('NOT NULL', not_null), ('UNIQUE', unique), ('AUTO_INCREMENT', auto_increment),
            ) if on]
            return datatype + (f' [{", ".join(traits)}]' if traits else '')
        if attribute_kind in ('FK_SOURCE', 'FK_DESTINATION'):
            return f'{attribute_kind} ({key[1]})'
        return str(key)

def field_color_key(field):
    if field.primary_key:
        return ('FIELD', field.type, True, True, False, field.increment)
    return ('FIELD', field.type, False, field.not_null, field.unique, field.increment)

def build_graph(diagram, color_table):
    graph = ColoredGraph()
    vertex_ids = {} 

    def add_vertex(color_key, label):
        vertex_id = graph.length
        graph.length += 1
        graph.colors.append(color_table.intern(color_key))
        graph.labels.append(label)
        return vertex_id

    for table in diagram.tables:
        for field in table.fields:
            vertex_ids[field.id] = add_vertex(field_color_key(field), f'{table.name}.{field.name}')
        for first, second in combinations(table.fields, 2):
            graph.edges.append((vertex_ids[first.id], vertex_ids[second.id]))

    for relationship in diagram.relationships:
        # one_to_one has no direction ('1' on both ends) — give both markers the
        # same color so A->B and B->A produce isomorphic encodings. one_to_many
        # was already normalized into many_to_one by the parser.
        if relationship.cardinality == 'one_to_one':
            source_color = destination_color = ('FK', 'one_to_one')
        else:
            source_color, destination_color = ('FK_SOURCE', relationship.cardinality), ('FK_DESTINATION', relationship.cardinality)
        
        source_marker = add_vertex(source_color, f'fk{relationship.id}:source')
        destination_marker = add_vertex(destination_color, f'fk{relationship.id}:destination')
        
        graph.edges.append((vertex_ids[relationship.start_field], source_marker))
        graph.edges.append((source_marker, destination_marker))
        graph.edges.append((destination_marker, vertex_ids[relationship.end_field]))

    return graph
            
