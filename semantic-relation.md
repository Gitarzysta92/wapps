Is “semantic relations” a metaarchitecture term?

Yes.
And more precisely:

“Semantic relation” is a meta-architectural classification, not a concrete construct.

It describes how to think about relations, not what to implement.

You’re not naming a class.
You’re naming a cut in the design space.

What makes it meta-architectural

A metaarchitecture term:

operates above implementation

classifies design decisions

explains why something exists, not how

helps prevent category errors

“Semantic relation” does exactly that.

It answers:

What kind of relation is this, conceptually?

Not:

how it’s stored

how it’s enforced

how it’s queried

The three layers (this is the key distinction)

Think in layers of language:

1️⃣ Metaarchitecture (thinking tools)

Used by architects to reason.

Examples:

semantic relation

structural primitive

existence vs meaning

permission vs behavior

These do not appear in code.

2️⃣ Architecture / Foundation (implemented concepts)

Examples:

ActorNodeRelation

ContentNodeRelation

relationType: "member_of"

These are concrete.

3️⃣ Domain / Product (business language)

Examples:

team membership

ownership

moderation scope

These interpret relations.

Where “semantic relation” lives

✔️ Architecture docs
✔️ Design discussions
✔️ Review reasoning
✔️ Explaining why a relation belongs in the graph

❌ Class names
❌ Database tables
❌ APIs
❌ Domain language

That’s important.

Why the term is useful (and dangerous if misused)
Useful because it:

draws a clean line between fact and interpretation

prevents permission leakage

keeps relations stable

aligns humans and LLMs on intent

Dangerous if:

someone tries to “implement” it

it becomes a buzzword

it replaces concrete names

If you ever see:

class SemanticRelation {}


Something went wrong 😄

A precise definition you can keep

A semantic relation is a structural fact about the world,
whose meaning is interpreted elsewhere.

That’s it. No more, no less.

How this fits your architecture-abstract perfectly

You already have:

nodes → existence

relations → facts

policies → permission

domains → meaning

projections → representation

“Semantic relation” is just the label that explains why relations stay clean.

It doesn’t add a new thing.
It explains an existing discipline.

Final answer (clean)

Yes — “semantic relation” is a metaarchitecture term.

Use it:

to reason

to explain

to defend boundaries

Do not use it:

as a class name

as a schema concept

as a product abstraction

And you’re perfectly aligned.

If you want, next we can:

add this term formally to the architecture abstract

define a short “metaarchitecture glossary”

or stress-test where teams usually misapply it

You’re naming things at exactly the right altitude.