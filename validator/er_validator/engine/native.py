import json
import os
import re
import subprocess
import tempfile
import time
from collections import Counter
from pathlib import Path

from .base import ColoredGraph, EngineError, EngineResult, IsomorphismEngine

VENDOR_DIR = Path(__file__).resolve().parents[2] / 'vendor'
_CYCLE_RE = re.compile(r'\(([^()]+)\)')


def resolve_binary(env_var, paths_key, fallback):
    """Env var > vendor/paths.json > conventional vendor path."""
    base_path = os.environ.get(env_var)
    if not base_path:
        try:
            base_path = json.loads((VENDOR_DIR / 'paths.json').read_text()).get(paths_key)
        except (OSError, ValueError):
            base_path = None
    base_path = Path(base_path) if base_path else VENDOR_DIR / fallback
    if not base_path.is_file():
        raise EngineError(
            f'{paths_key} binary not found at {base_path} — run validator/setup.sh '
            f'(or set ${env_var})')
    return str(base_path)


def build_apex_union(first_graph, second_graph):
    """Disjoint union of g1 and g2 plus the two apex vertices. Returns (H, apex1, apex2)."""
    offset = first_graph.length
    colored_graph = ColoredGraph()
    apex_color = max(first_graph.colors + second_graph.colors, default=-1) + 1
    colored_graph.length = first_graph.length + second_graph.length + 2
    colored_graph.colors = list(first_graph.colors) + list(second_graph.colors) + [apex_color, apex_color]
    apex1, apex2 = first_graph.length + second_graph.length, first_graph.length + second_graph.length + 1
    colored_graph.edges = list(first_graph.edges)
    colored_graph.edges += [(u + offset, v + offset) for u, v in second_graph.edges]
    colored_graph.edges += [(apex1, v) for v in range(first_graph.length)]
    colored_graph.edges += [(apex2, offset + v) for v in range(second_graph.length)]
    return colored_graph, apex1, apex2

class UnionFind:
    def __init__(self, length):
        self.parent = list(range(length))

    def find(self, current):
        while self.parent[current] != current:
            self.parent[current] = self.parent[self.parent[current]]
            current = self.parent[current]
        return current

    def union(self, first_node, second_node):
        first_node_root, second_node_root = self.find(first_node), self.find(second_node)
        if first_node_root != second_node_root:
            self.parent[first_node_root] = second_node_root
            
_NUMERIC_CYCLE = re.compile(r'^[\d,\s]+$')

def parse_generator_cycles(text, base):
    """Yield cycles (lists of 0-based ints) from cycle notation anywhere in the
    output — 'Generator: (1,3)(2,4)' (bliss). Orbit
    union-find doesn't need cycles grouped per generator, so parsing the whole
    text also survives tools wrapping long permutations across lines. Cycles
    containing anything non-numeric (prose in parentheses) are ignored."""
    for body in _CYCLE_RE.findall(text):
        if not _NUMERIC_CYCLE.match(body):
            continue
        elems = [int(string_node_rep) - base for string_node_rep in re.split(r'[,\s]+', body.strip()) if string_node_rep]
        if len(elems) >= 2:
            yield elems

class NativeGroupEngine(IsomorphismEngine):
    cycle_base = 0
    timeout_s = 60
    input_suffix = '.txt'

    def binary(self):          # pragma: no cover - overridden
        raise NotImplementedError

    def write_input(self, graph, path):
        """Write `graph` in the tool's input format. May return a vertex
        renumbering map new_id[old_id] (or None if numbering is unchanged)."""
        raise NotImplementedError

    def are_isomorphic(self, first_graph, second_graph):
        start_time = time.perf_counter()

        if first_graph.length != second_graph.length or len(first_graph.edges) != len(second_graph.edges) or \
           Counter(first_graph.colors) != Counter(second_graph.colors):
            return EngineResult(False, (time.perf_counter() - start_time) * 1000)
        if first_graph.length == 0:
            return EngineResult(True, (time.perf_counter() - start_time) * 1000)

        colored_graph, apex1, apex2 = build_apex_union(first_graph, second_graph)

        with tempfile.NamedTemporaryFile(
                'w', suffix=self.input_suffix, prefix='er_iso_', delete=False) as tmp:
            path = tmp.name
        try:
            renum = self.write_input(colored_graph, path)
            if renum:
                apex1, apex2 = renum[apex1], renum[apex2]
            out = self._run(path)
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

        union_find = UnionFind(colored_graph.length)
        generators_count = 0
        for cycle in parse_generator_cycles(out, self.cycle_base):
            generators_count += 1
            for a, b in zip(cycle, cycle[1:]):
                if not (0 <= a < colored_graph.length and 0 <= b < colored_graph.length):
                    raise EngineError(f'{self.name}: generator vertex out of range')
                union_find.union(a, b)

        is_isomorphic = union_find.find(apex1) == union_find.find(apex2)
        return EngineResult(is_isomorphic, (time.perf_counter() - start_time) * 1000, generators=generators_count)


    def _run(self, path):
        cmd = [self.binary(), path]
        try:
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=self.timeout_s)
        except subprocess.TimeoutExpired:
            raise EngineError(f'{self.name}: timed out after {self.timeout_s}s')
        except OSError as e:
            raise EngineError(f'{self.name}: failed to execute {cmd[0]}: {e}')
        if proc.returncode != 0:
            raise EngineError(
                f'{self.name}: exited with code {proc.returncode}: '
                f'{(proc.stderr or proc.stdout).strip()[:400]}')
        return proc.stdout
