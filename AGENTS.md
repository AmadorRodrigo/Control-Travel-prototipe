# AGENTS.md

This file defines the mandatory instructions for AI coding agents working in this repository.

Before analyzing, creating, modifying, refactoring, or removing code, read and follow these instructions.

The goal is not only to produce working code, but to produce changes that are **safe, simple, testable, maintainable, consistent with the existing architecture, and ready for code review**.

Priority order:

1. Correctness
2. Security
3. Simplicity
4. Maintainability
5. Testability
6. Consistency with the existing codebase
7. Performance, when relevant

Do not introduce unnecessary complexity.

---

# 1. Understand the Repository Before Making Changes

Before implementing any change:

1. Inspect the project structure.
2. Identify the language, framework, architecture, and tools being used.
3. Locate the files related to the requested task.
4. Understand the current execution flow.
5. Identify existing conventions and patterns.
6. Check for tests covering the affected behavior.
7. Check relevant configuration, dependencies, and environment variables.

Always prefer following the existing conventions of the repository instead of introducing new patterns.

Do not modify unrelated files.

Do not refactor surrounding code simply because it could be improved.

If unrelated improvements are discovered, mention them separately as:

**Suggested future improvement**

Keep them outside the current change unless they are required to complete the task safely.

---

# 2. Implementation Strategy

Before making significant changes, determine:

- what the actual problem is;
- what the likely root cause is;
- which files need to change;
- what the smallest safe change is;
- what side effects may occur;
- how the change will be validated.

For bugs, identify and fix the **root cause** instead of masking symptoms.

For new features, first understand how the feature fits into the existing architecture.

Avoid speculative changes.

Prefer incremental and reversible modifications.

---

# 3. Scope Discipline

Implement only what is necessary to satisfy the requested task.

Do not turn a small fix into a large refactor.

Do not change the following unless directly required:

- architecture;
- directory structure;
- global naming conventions;
- public APIs;
- database schemas;
- dependencies;
- infrastructure;
- authentication or authorization behavior.

If a larger change is required, explain why before proceeding.

Keep each task focused on one logical concern whenever possible.

---

# 4. Code Quality

Follow Clean Code principles, SOLID principles when appropriate, and idiomatic practices for the language being used.

## Responsibilities

Functions, methods, classes, handlers, services, repositories, and modules should have clear responsibilities.

Avoid excessively large functions or modules with multiple unrelated responsibilities.

## Naming

Use clear and descriptive names.

Avoid vague names such as:

```text
data
obj
temp
foo
bar
x
```

when a more meaningful name is available.

## Simplicity

Prefer the simplest solution that correctly satisfies the requirements.

Avoid:

- premature abstractions;
- unnecessary interfaces;
- unnecessary wrappers;
- speculative generalization;
- excessive indirection;
- design patterns without a concrete need;
- new dependencies when the existing stack already solves the problem.

Do not overengineer.

---

# 5. Error Handling

Never silently ignore errors.

Use the idiomatic error-handling mechanism of the language.

Examples:

- Go → explicit `error` handling;
- Python → specific exceptions;
- JavaScript/TypeScript → proper Promise rejection handling and `try/catch` where appropriate;
- Java → appropriate exception handling.

Do not catch generic errors unless necessary.

When wrapping or returning errors, preserve enough context for debugging.

Do not expose sensitive implementation details to API consumers.

Do not use `panic`, `throw`, `exit`, or equivalent mechanisms for normal control flow when a proper error-handling alternative exists.

---

# 6. Security

Treat security as part of the implementation, not as an optional improvement.

Never:

- hardcode passwords;
- hardcode tokens;
- hardcode API keys;
- expose secrets;
- commit credentials;
- log sensitive information;
- trust user-controlled input without validation.

Use environment variables or the secret-management mechanism already used by the project.

When relevant, consider:

- input validation;
- authentication;
- authorization;
- access control;
- SQL injection;
- XSS;
- CSRF;
- SSRF;
- path traversal;
- rate limiting;
- sensitive-data exposure;
- secure session handling;
- secure token handling.

Do not implement custom cryptography or custom authentication mechanisms when established and appropriate solutions already exist.

---

# 7. Database Changes

When working with databases:

- use parameterized queries or prepared statements;
- prevent SQL injection;
- use transactions when atomicity is required;
- avoid unnecessary queries;
- consider N+1 query problems;
- consider indexes when relevant;
- preserve data integrity;
- preserve backward compatibility when possible.

Use the migration system already present in the repository.

Do not manually modify production data.

Do not perform destructive database operations unless explicitly requested.

Any destructive migration must be clearly identified before execution.

---

# 8. API Design

When creating or modifying APIs:

- maintain consistent contracts;
- use appropriate HTTP methods;
- use appropriate HTTP status codes;
- validate request payloads;
- return predictable errors;
- follow existing response conventions;
- preserve backward compatibility when possible.

General HTTP status guidance:

```text
200 - Successful request
201 - Resource created
204 - Successful request with no response body
400 - Invalid request
401 - Missing or invalid authentication
403 - Authenticated but not authorized
404 - Resource not found
409 - Resource conflict
422 - Validation error when appropriate
500 - Unexpected internal server error
```

Do not change existing public API contracts unless explicitly required.

If a contract must change, clearly identify the breaking change.

---

# 9. Tests and Validation

Every change must be validated.

Whenever possible:

1. run existing relevant tests;
2. add or update tests when behavior changes;
3. run the formatter;
4. run the linter;
5. run the type checker when available;
6. run the build when relevant.

For bug fixes, prefer creating a regression test that:

1. reproduces the bug;
2. fails before the fix;
3. passes after the fix.

Do not claim that tests passed unless they were actually executed.

If a validation step cannot be executed, explicitly report it as not run and explain why when relevant.

Never hide failing tests.

---

# 10. Dependencies

Do not introduce new dependencies without a concrete reason.

Before adding a dependency:

1. check whether the repository already has an equivalent solution;
2. determine whether the requirement can be implemented safely with the existing stack;
3. consider maintenance and security impact;
4. prefer established and actively maintained packages.

If a new dependency is required, briefly explain why.

Do not update unrelated dependencies as part of another task.

---

# 11. Comments and Documentation

Avoid comments that merely restate the code.

Bad example:

```go
// Increment counter
counter++
```

Comments should primarily explain:

- architectural decisions;
- non-obvious business rules;
- important trade-offs;
- unusual constraints;
- behavior that may otherwise appear incorrect.

Prefer self-explanatory code.

Update documentation when a change affects:

- public behavior;
- setup instructions;
- environment variables;
- API contracts;
- deployment;
- configuration;
- development workflow.

---

# 12. Git Workflow

Use a simplified Git workflow with isolated branches.

Recommended branch naming:

```text
feature/<feature-name>
bugfix/<bug-name>
refactor/<refactor-name>
chore/<task-name>
```

Examples:

```text
feature/jwt-authentication
bugfix/product-id-validation
refactor/user-service
chore/update-docker-config
```

Keep branches focused on one logical change.

Do not mix unrelated changes into the same task.

Do not create branches unless requested or required by the current workflow.

---

# 13. Conventional Commits

When completing a change, propose a commit message using Conventional Commits.

Format:

```text
<type>(<scope>): <short description>
```

Allowed types:

- `feat` — new functionality;
- `fix` — bug fix;
- `docs` — documentation changes;
- `style` — formatting changes without behavior changes;
- `refactor` — internal code changes without fixing a bug or adding functionality;
- `test` — adding or modifying tests;
- `chore` — maintenance, tooling, or configuration;
- `perf` — performance improvements;
- `build` — build system or dependency changes;
- `ci` — CI/CD changes.

Examples:

```text
feat(auth): add jwt token validation
fix(products): handle invalid product identifier
refactor(users): separate authentication logic from handler
test(auth): add expired token tests
chore(docker): update postgres configuration
```

Commit descriptions must be concise, descriptive, and lowercase.

Do not include emojis in commit messages unless explicitly requested.

If the task contains multiple independent changes that should logically be separate commits, suggest separate commit messages instead of combining everything into one commit.

---

# 14. Pull Requests

For significant tasks, provide a Pull Request summary.

Use the following structure:

## What Changed

Briefly describe the implemented changes.

## Why

Explain the technical reason or problem that motivated the change.

## How to Test

Provide reproducible steps for validating the implementation.

## Impact

Mention relevant changes involving:

- APIs;
- database;
- migrations;
- environment variables;
- dependencies;
- compatibility;
- infrastructure.

If there are no relevant impacts, state:

```text
No additional impact identified.
```

---

# 15. Dangerous or Destructive Operations

Ask for confirmation before executing potentially destructive or difficult-to-reverse operations.

Examples include:

- deleting important files;
- deleting data;
- destructive migrations;
- resetting databases;
- major architecture changes;
- removing existing functionality;
- introducing breaking API changes;
- modifying or deleting critical configuration;
- modifying secrets;
- destructive Git operations.

Never execute commands such as:

```bash
git reset --hard
git clean -fd
git push --force
git branch -D
```

without explicit authorization.

Prefer reversible operations.

---

# 16. Do Not Invent Information

Never assume that:

- a file exists;
- an endpoint exists;
- a dependency is installed;
- a test passed;
- a command succeeded;
- an environment variable exists;
- a service is running;
- a configuration is enabled.

Verify first.

If something cannot be verified, explicitly identify it as an assumption.

Never fabricate command output, test results, logs, files, APIs, or project structure.

---

# 17. When to Ask Questions

Do not interrupt implementation with unnecessary questions.

Make reasonable technical decisions when:

- the expected behavior is clear;
- the decision can be inferred from the existing architecture;
- existing project conventions provide the answer;
- the change is small and easily reversible.

Ask before proceeding when there is meaningful ambiguity involving:

- business rules;
- expected behavior;
- public contracts;
- security;
- architecture;
- data loss;
- backward compatibility;
- destructive operations;
- multiple approaches with significantly different consequences.

When asking a question, explain what decision depends on the answer.

---

# 18. Working With Existing Code

Preserve existing behavior unless the task explicitly requires changing it.

Do not rewrite working code unnecessarily.

When editing an existing implementation:

1. understand why it currently exists;
2. identify its callers and dependencies;
3. evaluate possible regressions;
4. make the smallest appropriate change;
5. validate affected behavior.

Respect established boundaries between layers such as:

```text
handler/controller
service/use case
repository/data access
domain/model
infrastructure
```

when those boundaries already exist in the project.

Do not bypass an architectural layer simply because it is faster to implement.

---

# 19. Refactoring

Refactor only when:

- explicitly requested;
- necessary to safely implement the task;
- necessary to remove duplication introduced by the change;
- necessary to make the affected code testable.

Refactoring must preserve observable behavior unless a behavior change is explicitly part of the task.

Avoid combining large refactors with feature development or bug fixes.

---

# 20. Agent Autonomy

Operate autonomously for normal engineering decisions.

You may:

- inspect repository files;
- search the codebase;
- trace references;
- inspect tests;
- inspect configuration;
- run safe development commands;
- run tests;
- run formatters;
- run linters;
- run builds;
- make small implementation decisions consistent with the existing project.

Do not ask for permission for routine, reversible development actions.

However, autonomy does not override the restrictions regarding destructive operations, security-sensitive changes, breaking changes, or unclear business requirements.

---

# 21. Response Format

For development tasks, prefer the following final response structure.

## Analysis

Briefly explain the identified problem and the approach taken.

## Changes

List the files changed and explain the purpose of each change.

## Validation

Report exactly what was executed:

```text
Tests: passed / failed / not run
Lint: passed / failed / not run
Build: passed / failed / not run
```

Do not report a validation step as passed unless it was actually executed successfully.

Include relevant commands when useful.

## Suggested Commit

```text
type(scope): short description
```

## Pull Request

For tasks significant enough to justify a Pull Request:

**What changed:**  
...

**Why:**  
...

**How to test:**  
...

**Impact:**  
...

Keep the final response concise unless additional explanation is necessary.

---

# 22. Core Rules

Before writing code, **understand the existing code**.

Before adding complexity, **look for a simpler solution**.

Before creating something new, **check whether the repository already has an equivalent solution**.

Before changing architecture, **verify that the task actually requires it**.

Before claiming something works, **validate it**.

Before performing destructive operations, **ask for confirmation**.

Always prefer the **smallest safe change that correctly solves the problem**.