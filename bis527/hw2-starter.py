"""BIS 527 Homework 2: starter and required generators (standard library only).

Rename hw2-yourlastname.py. Implement the three algorithm functions below.
Use the supplied generators unchanged, even if you write a separate driver.
The generators and timing helper do not implement the assigned algorithms.
Use your own correctness tests before running any timing experiment.
"""

from math import inf
from random import Random
from statistics import median
from time import perf_counter


def minimum_cost_routes(adj, source, counts=None):
    """adj[u] lists (v, nonnegative integer weight); vertices are 0,...,n-1.

    Return (distance, predecessor), two lists of length n.
    Infinity/None denotes an unreachable vertex; predecessor[source] is None.
    Scan all n positions in each selection pass, for at most n passes.
    Break distance ties by smallest vertex number; update predecessors only
    on a strict improvement and never update a finalized vertex.
    If counts is a dict, initialize and increment 'scans' once per position
    inspected, and 'edges' once per outgoing edge examined, including edges
    to finalized vertices. If counts is None, do not increment counters.
    """
    raise NotImplementedError("Write your design from Problem 1 here.")


def reconstruct_path(predecessor, distance, source, target):
    """Return a vertex list including both endpoints, or None if unreachable.

    The path from source to itself is [source].
    """
    raise NotImplementedError("Follow predecessors and reverse the result.")


def needleman_wunsch(x, y, counts=None):
    """Return (score, aligned_x, aligned_y), using '-' for gaps.

    Match +2, mismatch -1, each gap symbol -2. Use full score and traceback
    tables. At tied best scores choose diagonal, then up, then left.
    If counts is a dict, initialize and increment 'cells' once per interior
    cell computed and 'traceback' once per emitted alignment column.
    If counts is None, do not increment counters.
    Build reversed alignment lists with append; reverse/join once at the end.
    """
    raise NotImplementedError("Write your design from Problem 3 here.")


def toy_graph():
    """A,...,F correspond to 0,...,5; all unspecified edges are absent."""
    return [[(1, 4), (2, 1)], [(3, 1), (4, 1)],
            [(1, 2), (3, 3), (4, 5)], [(4, 0)], [(2, 1)], []]


def make_graph(n, family, seed=527):
    """Required synthetic graph generator. n >= 8, source 0.

    Sparse: u -> (u+k) mod n for k in (1,2,4), exactly 3n edges.
    Dense: every ordered pair of distinct vertices, exactly n(n-1) edges.
    Every edge has an independently generated integer weight from 0 to 9.
    Each call resets the seed; retain the supplied edge iteration order.
    The +1 ring makes every vertex reachable in both families.
    """
    if n < 8 or family not in {"sparse", "dense"}:
        raise ValueError("Use n >= 8 and family 'sparse' or 'dense'.")
    rng = Random(seed)
    adj = [[] for _ in range(n)]
    for u in range(n):
        neighbors = ((u + k) % n for k in (1, 2, 4)) if family == "sparse" else (
            v for v in range(n) if v != u)
        for v in neighbors:
            adj[u].append((v, rng.randrange(10)))
    return adj


def make_sequences(m, n, seed=527):
    """Reset the seed, then draw x followed by y, uniformly from ACGT."""
    rng = Random(seed)
    return ("".join(rng.choice("ACGT") for _ in range(m)),
            "".join(rng.choice("ACGT") for _ in range(n)))


def measure(call, repeats=5, batch=3):
    """Warm up once, return median seconds/call and all per-batch means.

    Each of repeats batches executes batch calls. Construct inputs beforehand.
    Reuse those fixed inputs for the warmup and every timed call.
    Use counts=None; leave generation, tests, plotting and printing outside.
    Pass e.g. lambda: minimum_cost_routes(adj, 0). This includes required outputs.
    Increase batch if values are unstable; report repeats and batch in PDF.
    """
    call()
    samples = []
    for _ in range(repeats):
        start = perf_counter()
        for _ in range(batch):
            call()
        samples.append((perf_counter() - start) / batch)
    return median(samples), samples


if __name__ == "__main__":
    print("Implement the functions, then add your tests and experiment driver.")
