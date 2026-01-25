# Architecture Abstract

This document defines the **architecture abstract** underlying Wapps.

It is not an architecture, framework, or methodology.
It does not prescribe implementation details or technologies.

Its purpose is to provide a **shared vocabulary and responsibility model**
that prevents category errors and accidental coupling.

---

## 1. Purpose

The architecture abstract exists to:

- make implicit structure explicit
- separate concerns before design decisions are made
- provide stable conceptual anchors
- allow domains to evolve without inheriting technical concerns

It defines **what concepts are**, not **how they are implemented**.

---

## 2. Foundational Principles

### 2.1 Separation of Existence and Meaning

Existence is not meaning.

The system distinguishes between:
- something existing
- something having business meaning

Existence is a technical concern.
Meaning is a domain concern.

---

### 2.2 Separation of Permission and Behavior

Permission is not behavior.

The system distinguishes between:
- whether an action is allowed
- what the action does

Authorization governs possibility.
Domains govern behavior.

---

### 2.3 Separation of Structure and Representation

Structure is not representation.

The system distinguishes between:
- structural facts
- how those facts are presented or queried

Read models never define truth.
They are derived and disposable.

---

## 3. Foundation Layer (Pre-Domain)

The foundation layer defines **structural primitives**.
It contains no business meaning.

### 3.1 Identity

**Identity** represents an actor.

- Answers: *who or what can act*
- Has:
  - global identity
  - kind (e.g. user, service, organization, bot, system)
  - lifecycle state

Identity does **not** contain:
- roles
- permissions
- business rules

Identity defines existence, not authority.

---

### 3.2 Authorization

**Authorization** governs permission.

- Answers: *who may perform which action on which resource*
- Evaluates policies
- Is centralized and explicit
- Is enforced consistently

Authorization does **not** define behavior or workflows.

Authorization governs possibility, not meaning.

---

### 3.3 Content Node

**ContentNode** represents the existence of content.

- Is content-agnostic
- Has no payload or schema
- Has global identity and lifecycle

ContentNode does **not** know:
- format
- representation
- storage
- business semantics

ContentNode answers: *something exists*.

---

### 3.4 Content Node Relation

**ContentNodeRelation** represents a structural fact.

- First-class entity
- Expressed as `(from → to, relationType)`
- Has no inherent semantics in the core

Meaning of relations is defined outside the foundation.

Relations are facts; structure emerges elsewhere.

---

## 4. Domain Layer

Domains express **business meaning**.

### 4.1 Domain

A **Domain**:

- owns business rules and invariants
- defines behavior and decisions
- assumes authorization has already been enforced
- assumes identity already exists

Domains do **not**:
- perform authorization
- manage identity
- handle persistence
- encode infrastructure concerns

Domains describe what happens.

---

### 4.2 Domain Model

A **Domain Model**:

- is behavior-centric
- expresses invariants and decisions
- uses verbs, not storage fields

A domain model is **not**:
- a database entity
- an ORM model
- a projection

If it maps 1:1 to a table, it is not a domain model.

---

## 5. Application Layer

The application layer coordinates work.

### 5.1 Application / Use Case

Application code:

- orchestrates authorization, domain behavior, and persistence
- defines workflows and sequencing
- contains no business rules

Application code decides *what to call*, not *what it means*.

---

## 6. Read Layer

### 6.1 Projection

A **Projection** is a derived read model.

- Built from structural facts and domain events
- Optimized for queries and UI
- Disposable and rebuildable
- Eventually consistent

Projections are views, not truth.

---

## 7. Policy Layer

### 7.1 Policy

A **Policy**:

- is declarative
- evaluates to allow or deny
- may include a reason

Policies do **not**:
- encode business logic
- define behavior
- replace domain rules

Policies decide who may act, not what happens.

---

## 8. Cross-Cutting Concerns

Some concerns apply everywhere but belong nowhere.

Examples:
- authorization enforcement
- logging
- observability
- validation

Definition of rules is foundational.
Enforcement of rules is cross-cutting.

---

## 9. Anti-Definitions

The following are intentionally excluded from the abstract:

- user-centric models
- permission flags on domain entities
- authorization inside domain logic
- 1:1 domain-to-database mapping
- hidden lifecycle rules

If these appear, responsibilities have leaked.

---

## 10. Summary

The architecture abstract separates:

- existence from meaning
- permission from behavior
- structure from representation

Foundations define what exists and what is allowed.
Domains define what happens.
Projections define how it is seen.

Nothing decides more than it owns.
