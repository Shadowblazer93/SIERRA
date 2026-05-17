# SIERRA Translate Feature - Comprehensive Implementation Guide

## Overview

The translate feature in SIERRA converts visual query graphs into Cypher queries that can be executed on Neo4j databases. This document outlines all supported features and how they're translated.

---

## Supported Features

### 1. **Basic Pattern Matching**

#### Single Nodes (Lone Queries)
- **Visual**: A node not connected to others
- **Cypher**: `(rep:Label)`
- **Return**: Included in RETURN if node is marked bold

#### Node Patterns
- **Visual**: Multiple nodes in a pattern
- **Cypher**: `(n1:Label1)--(n2:Label2)`
- **Supported**: Both directed (-->) and undirected (--) edges

---

### 2. **Hops & Variable Length Paths** 🔄

#### Exact Path Length
- **Visual**: Edge with cardinality min=max=X
- **Cypher**: `-[*X]->`
- **Example**: `(a:Person)-[*2]->(b:Person)` (exactly 2 hops)

#### Range of Path Lengths
- **Visual**: Edge with cardinality min=X, max=Y
- **Cypher**: `-[*X..Y]->`
- **Example**: `(a:Person)-[*2..5]->(b:Person)` (2-5 hops)

#### Predicates on Variable Length Paths
- **Visual**: Edge predicates + variable length
- **Cypher**: `ALL(rel in r WHERE rel.property = value)`
- **Generates**: WHERE clause with ALL() for relationship filtering
- **Use Case**: Filter relationships along the path

#### Implementation Details
```javascript
// In convertToQuery function
if (currEdge.data.cardinality) {
    const {min, max} = currEdge.data.cardinality;
    if (min !== 1 || max !== 1) {
        hops = `*${min}..${max}`; // or `*${max}` for exact
        isVarLength = true;
    }
}
// Use ALL() for predicates when isVarLength = true
```

---

### 3. **Joins** 🔗

#### Equi Join
- **Visual**: Predicate link with "Equi Join" type
- **Cypher**: `a.attr = b.attr`
- **Operators**: Always uses `=`

#### Theta Join
- **Visual**: Predicate link with "Theta Join" type + custom operator
- **Cypher**: `a.attr > b.attr` (or <, >=, <=, <>, !=)
- **Operators**: User-selected comparison operators

#### Integration
- Joins are added to WHERE clause predicates
- Work seamlessly with other predicates
- Combine with aggregations

#### Example Generated Queries

**Equi Join:**
```cypher
MATCH (customer:Customer), (order:Order)
WHERE customer.id = order.customerId
RETURN customer, order
```

**Theta Join:**
```cypher
MATCH (emp1:Employee), (emp2:Employee)
WHERE emp1.salary > emp2.salary
RETURN emp1, emp2
```

---

### 4. **OR Links** 🔀

#### Concept
- Connects predicates from same or different attributes with OR
- Uses union-find algorithm to group related predicates

#### Visual Representation
- Colored OR links in the visual editor
- Shows grouping in predicate display

#### Cypher Generation
- Multiple predicates combined with OR: `(pred1 OR pred2)`
- Properly parenthesized for clarity
- Works with ANDs to create complex boolean expressions

#### Example
```cypher
WHERE (a.status = 'active' OR a.status = 'pending') AND a.age > 25
```

#### Implementation
```javascript
// Union-find for OR grouping
const orParents = {};
if (state.orLinks && state.orLinks.length > 0) {
    state.orLinks.forEach(link => {
        unionOR(fromKey, toKey); // Groups predicates
    });
}
```

---

### 5. **Aggregations** 📊

#### Simple Aggregations
- **Visual**: Node with aggregation function (COUNT, SUM, AVG, MIN, MAX)
- **Cypher**: `COUNT(n.property) AS alias`
- **Return**: Aggregation result in RETURN clause

#### Conditional Aggregations (HAVING)
- **Visual**: Aggregation + condition (operator + value)
- **Cypher**: Uses WITH clause to filter aggregation results
- **Pattern**:
  ```cypher
  MATCH ...
  WITH COUNT(n) AS count
  WHERE count > 10
  RETURN count
  ```

#### Features
- Multiple aggregations per query
- Mix aggregations with regular returns
- Support for all common SQL-like functions
- Proper aliasing of results

#### Examples

**Simple Count:**
```cypher
MATCH (p:Product)
RETURN COUNT(p) AS total_products
```

**Conditional Aggregation:**
```cypher
MATCH (o:Order)
WITH COUNT(o) AS order_count
WHERE order_count > 5
RETURN order_count
```

**Multiple Aggregations:**
```cypher
MATCH (n:Sale)
RETURN COUNT(n) AS num_sales, SUM(n.amount) AS total, AVG(n.amount) AS avg_sale
```

---

### 6. **Complex/Nested Queries** 🏗️

#### Predicate Nesting
- **Concept**: Organize node predicates into levels with AND/OR connectors
- **Visual**: Nesting menu in Node Predicate Modal
- **Result**: Properly parenthesized expressions

#### Disjunctive Normal Form (DNF)
- **Support**: Complex boolean expressions with AND/OR
- **Use**: For sophisticated query constraints
- **Format**: OR groups with ANDs within each group

#### Nesting Levels
- Level 0: Outermost (lowest precedence)
- Level 1+: Nested deeper (higher precedence)
- Connector: AND or OR between levels

#### Example
Visual nesting:
```
Level 0: status (connector: AND)
  Level 1: active (OR)
  Level 1: pending (OR)
  Level 2: age > 25
```

Generates:
```cypher
WHERE ((status = 'active' OR status = 'pending') AND age > 25)
```

#### DNF Example
Input: `(a OR b) AND (c OR d)`
Output: `(a AND c) OR (a AND d) OR (b AND c) OR (b AND d)`

---

### 7. **Path Variables** 📍

#### Purpose
- Return entire path matched in query
- Useful for analyzing relationship sequences
- Access properties along the path

#### Visual
- Checkbox on edge to mark as "path"
- Variable named p0, p1, etc.

#### Cypher
```cypher
MATCH p0 = (a:Person)-[:KNOWS*2..4]->(b:Person)
RETURN a, b, p0
```

#### Usage
- Extract relationships in path
- Calculate path length with `length(p0)`
- Get nodes/relationships from path

---

## Query Construction Logic

### Step 1: Process Nodes
1. Assign representation IDs to nodes
2. Collect bold nodes as return variables
3. Process node predicates
4. Process node aggregations
5. Process DNF predicates

### Step 2: Handle OR Links
1. Use union-find to group related predicates
2. Create OR groups
3. Generate grouped expressions with proper parentheses

### Step 3: Process Edges
1. Determine cardinality (hops)
2. Build relationship pattern with type and cardinality
3. Add edge predicates
4. Handle cardinality properties
5. Track path variables

### Step 4: Process Joins
1. Find predicate links
2. Determine join type (Equi or Theta)
3. Add join conditions to WHERE clause

### Step 5: Build Final Query
- **Case 1**: Join nodes → Special OPTIONAL MATCH + COLLECT
- **Case 2**: Aggregations with conditions → WITH + WHERE
- **Case 3**: Simple aggregations → Direct RETURN
- **Case 4**: No aggregations → Standard MATCH WHERE RETURN

---

## Generated Query Patterns

### Pattern 1: Simple Pattern Match
```cypher
MATCH (n1:Label1), (n2:Label2)--(n3:Label3)
WHERE n1.prop = 'value' AND n2.prop > 10
RETURN n1, n2, n3
```

### Pattern 2: Variable Length with Predicates
```cypher
MATCH (a:Person)-[r*2..5:KNOWS]->(b:Person)
WHERE ALL(rel in r WHERE rel.confidence > 0.8)
RETURN a, b
```

### Pattern 3: Joins
```cypher
MATCH (n1:Node1), (n2:Node2)
WHERE n1.id = n2.id AND n1.status = 'active'
RETURN n1, n2
```

### Pattern 4: Aggregations
```cypher
MATCH (n:Item)
WITH COUNT(n) AS count, SUM(n.price) AS total
WHERE count > 5
RETURN count, total
```

### Pattern 5: Complex Nesting
```cypher
MATCH (n:Node)
WHERE ((n.a = 1 OR n.a = 2) AND (n.b > 10 OR n.b < 5))
RETURN n
```

---

## Code Comments in Implementation

The `convertToQuery` function in `neo4jApi.js` is heavily commented with:

- **========== FEATURE: X ==========** headers for each major feature
- Explanations of complex logic
- Edge cases handled
- Variable naming conventions

### Key Sections

1. **Node Processing** (lines 300-400)
   - Predicate extraction
   - Aggregation handling
   - DNF processing

2. **OR Link Handling** (lines 400-500)
   - Union-find algorithm
   - OR grouping
   - Nested expression building

3. **Edge Processing** (lines 500-650)
   - Cardinality/hops
   - Relationship types
   - Predicates
   - Path variables

4. **Join Handling** (lines 650-680)
   - Equi vs Theta joins
   - Operator selection

5. **Query Construction** (lines 680-750)
   - Case analysis
   - MATCH clause building
   - WHERE clause building
   - RETURN clause ordering

---

## Testing Guide

### Test Cases for Each Feature

#### Hops
- [ ] Single hop edge without type
- [ ] Multiple hops (exact): `*3`
- [ ] Range hops: `*2..5`
- [ ] With edge predicates
- [ ] With directed edge

#### Joins
- [ ] Equi join between two nodes
- [ ] Theta join with > operator
- [ ] Multiple joins
- [ ] With other predicates

#### OR Links
- [ ] Two predicates with OR
- [ ] Multiple OR groups
- [ ] Mixed AND/OR

#### Aggregations
- [ ] COUNT aggregation
- [ ] SUM aggregation
- [ ] Multiple aggregations
- [ ] With condition
- [ ] With joins

#### Complex Queries
- [ ] Nested predicates 3+ levels
- [ ] DNF conversion
- [ ] All features combined

---

## Common Issues & Solutions

### Issue: Duplicate Return Variables
**Solution**: Handled by Set deduplication before building RETURN clause

### Issue: ALL() not applied to variable length paths
**Solution**: Check `isVarLength` flag before generating predicates

### Issue: Join nodes conflicting with aggregations
**Solution**: Separate case handling for join nodes with aggregation integration

### Issue: Improper parenthesization in complex queries
**Solution**: Nesting levels and proper expression building

---

## API Reference

### convertToQuery(state)
```javascript
/**
 * Converts visual query graph state to Cypher query
 * @param {Object} state - Redux state with nodes, edges, orLinks, predicateLinks
 * @returns {String} Valid Cypher query string
 */
```

### Input Structure
```javascript
state = {
    nodes: [
        {
            id: "1",
            data: {
                rep: "a",
                label: "Person",
                predicates: {...},
                aggregations: [...],
                dnf: [...],
                predicateNesting: {...}
            },
            isBold: true
        }
    ],
    edges: [
        {
            source: "1",
            target: "2",
            data: {
                rs: "KNOWS",
                cardinality: {min: 2, max: 5},
                predicates: {...},
                isPath: true
            },
            arrowHeadType: "arrowclosed"
        }
    ],
    orLinks: [...],
    predicateLinks: [...]
}
```

---

## Performance Notes

- Union-find for OR grouping: O(n log n)
- Predicate deduplication: O(n)
- Overall complexity: O(n) where n = number of nodes + edges

---

## Future Enhancements

1. **Multiple Edge Types**: Support for multiple relationship types in single edge
2. **DISTINCT Keyword**: Option to add DISTINCT to RETURN
3. **ORDER BY**: Support for result ordering
4. **LIMIT/SKIP**: Pagination support
5. **WITH Clauses**: Complex multi-step queries
6. **GROUP BY**: Implicit grouping with aggregations
7. **OPTIONAL MATCH**: For optional pattern matching
8. **UNION**: Combining multiple patterns

---

## Related Files

- [neo4jApi.js](src/neo4jApi.js) - Contains convertToQuery
- [NodePredicateModal/index.js](src/components/NodePredicateModal/index.js) - UI for predicates
- [EdgeModal/index.js](src/components/EdgeModal/index.js) - UI for edges
- [JoinGraphView/index.js](src/components/JoinGraphView/index.js) - Join visualization
- [constants.js](src/constants.js) - Operator definitions
