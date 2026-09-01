# GARNET APPLE BATTLE Quiz Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A private 10-question timed quiz for live events. Admin controls quiz sessions and views results; participants join via QR code and receive a thank-you message after the quiz. Only the admin sees full results.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- event attendees
- admin/owner

## Success criteria

- Admin can start a quiz session and view results
- Participants can join via QR code and complete the quiz within time limits
- Quiz results are ranked and displayed to admin only

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **/start_quiz** (command, actor: admin, command: /start_quiz) — Admin-only command to start a new quiz session
- **/results** (command, actor: admin, command: /results) — Admin-only command to view quiz results
- **Join via QR Code** (button, actor: user, callback: join:qr) — Participant joins quiz session using a one-time QR code token

## Flows

### Quiz Session
_Trigger:_ /start_quiz

1. Admin starts quiz session
2. QR code token is activated
3. Participants join using QR code
4. Quiz questions are presented one by one with 15s countdown
5. Participants select answers
6. Quiz ends after 10 questions or timeouts
7. Participants receive thank-you message
8. Admin views results with /results

_Data touched:_ Quiz session, Participant, Admin

### Participant Join
_Trigger:_ join:qr

1. Participant scans QR code
2. Bot validates token and registers participant
3. Quiz questions are presented

_Data touched:_ Participant

### Admin Results
_Trigger:_ /results

1. Admin requests results
2. Bot displays sorted results table
3. Admin can request CSV export

_Data touched:_ Quiz session, Participant

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram user ID of the admin who controls the quiz and views results
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Quiz Session** _(retention: persistent)_ — A 10-question quiz with 15s per question, containing questions, options, and correct answers
  - fields: session_id, questions, start_time, end_time
- **Participant** _(retention: persistent)_ — Telegram user who joins the quiz via QR code
  - fields: telegram_id, display_name, score, total_response_time, answers
- **Admin** _(retention: persistent)_ — Telegram account with elevated commands to control quiz sessions and view results
  - fields: telegram_id, display_name

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- /start_quiz
- /results

## Notifications

- Admin receives quiz results on demand via /results
- Participants receive a thank-you message after quiz completion

## Permissions & privacy

- Participants' Telegram IDs and display names are stored only for quiz tracking and visible only to admin
- Quiz results are not shared with any third parties

## Edge cases

- Participant attempts to join without valid token
- Participant answers after time limit
- Admin tries to start quiz without preloaded questions
- Multiple participants join with same token
- Admin requests results before quiz starts

## Required tests

- Admin can start quiz session and view results
- Participant can join via QR code and complete quiz within time limits
- Quiz results are correctly ranked and displayed to admin only

## Assumptions

- Admin provides quiz content before event
- QR code is generated and displayed at venue
- Participants have Telegram installed and can scan QR code
- Admin has access to Telegram account for quiz control
