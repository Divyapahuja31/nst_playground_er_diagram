from dataclasses import dataclass, field
from abc import ABC, abstractmethod


class EngineError(RuntimeError):
    """Native binary missing, crashed, or produced unparseable output."""


@dataclass
class ColoredGraph:
    """Vertex-colored undirected graph with `length` vertices numbered 0..length-1."""
    length: int = 0
    colors: list = field(default_factory=list)
    edges: list = field(default_factory=list)

@dataclass
class EngineResult:
    isomorphic: bool
    engine_ms: float = 0.0
    generators: int = 0

class IsomorphismEngine(ABC):
    name = 'abstract'

    @abstractmethod
    def are_isomorphic(self, g1, g2) -> EngineResult:
        """Decide colored-graph isomorphism of two ColoredGraphs."""


def get_engine(name):
    key = (name or '').strip().lower()
    if key not in ENGINES:
        raise ValueError(
            f'unknown algorithm "{name}" — expected one of: {", ".join(sorted(ENGINES))}')
    return ENGINES[key]()

from .bliss_engine import BlissEngine   

ENGINES = {
    'bliss': BlissEngine,
}
