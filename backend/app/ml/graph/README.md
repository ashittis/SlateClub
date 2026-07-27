# ml/graph — the Neo4j taste graph

Graph-based recommendations and community detection over a Neo4j "taste graph" of users,
films, and their relationships. Optional — everything degrades gracefully when Neo4j is down
(`core.neo4j_client.neo4j_available`).

## Files
- **`taste_graph.py`** — reads/writes the taste graph: user↔film edges, film↔film
  similarity, and the queries other modules run against it.
- **`graph_recommend.py`** — graph-walk recommendations ("people with your taste also
  loved…"); one of the candidate generators for the pipeline.
- **`community.py`** — community detection: clusters users into **taste tribes**
  (used by `features/recommendation/tribes.py`).

## How it works
Actions elsewhere project into graph edges. `graph_recommend` traverses neighbours to find
films close in the graph, and `community` runs clustering to label tribes. Results feed the
candidate stage of the pipeline and the tribes endpoint.
