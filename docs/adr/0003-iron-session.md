# ADR 0003: iron-session

## Status

Accepted

## Context

`next-iron-session` is unmaintained.

## Decision

Use `iron-session` with cookie name `cmdesk-kite-session` (RFC 6265; no `/` in the name), `sameSite=lax`, `httpOnly`.

## Consequences

Existing cookies may be invalid once; users re-login (already required each morning).
