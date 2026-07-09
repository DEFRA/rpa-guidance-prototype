# Guidance viewer templates

This folder holds **viewer templates** — different ways of presenting a piece of
guidance to a reader. The goal is to let you try out and compare presentations
without touching any Hapi/Node routing or controllers.

Start at **`/guidance/viewer`**: choose a guide to open it, then use the **Switch
template** control at the top of the page to flip the same guide between viewers
and compare them. Each switch is a normal page load — the chosen template renders
as the whole page.

## The two things you can add

1. **A viewer** — a template in this folder (`viewers/`).
2. **A guidance document** — a Markdown file in the sibling `content/` folder.

Add either and it shows up on the next page load. In development the server does
**not** need restarting.

### Two ways to create a viewer

- **In the browser** — go to `/guidance/viewer/templates` → **Create new
  template**. Give it a name, choose Nunjucks or plain HTML, write the template,
  and save. It is written into this folder and is immediately selectable. You can
  edit or delete existing templates there too.
- **On disk** — add or edit a file in this folder directly, as described below.

Both do the same thing; the editor is just this folder, surfaced in the UI.

## Writing a viewer

A viewer is one file, either:

- **`.njk`** — Nunjucks. Use `{{ variables }}`, `{% for %}` loops and `{% if %}`.
- **`.html`** — plain HTML. Still supports `{{ tokens }}`, but you can ignore the
  rest of Nunjucks and just write HTML (see `plain-example.html`).

Both are compiled the same way, so pick whichever you are comfortable with.

Two starting points:

- **Extend the shared layout** to get the standard page header/footer:
  ```njk
  {% extends "guidance/viewers/_viewer-layout.njk" %}
  {% block viewer %}
    <h1 class="govuk-heading-l">{{ guide.title }}</h1>
    {{ bodyHtml | safe }}
  {% endblock %}
  ```
- **Go fully custom** — write a standalone HTML file with your own markup and
  styling, like `plain-example.html`.

> Note: `{{ ... | safe }}` tells the template the value is already safe HTML — use
> it on `bodyHtml`, `step.html`, `lead` and `section.html`. Files starting with
> `_` (like `_viewer-layout.njk`) are treated as partials and don't appear in the
> picker.

### Inline CSS and JavaScript

- **Inline CSS is allowed** — put a `<style>` block or `style="..."` attributes
  straight in your template.
- **Inline JavaScript is blocked** by the prototype's security policy. Build
  interactions with native HTML (`<details>`, links) or the server-driven step
  model below.

## The data a viewer receives

Every viewer is handed the same context, whatever the document:

| Variable | What it is |
| --- | --- |
| `guide` | Document metadata: `title`, `type`, `summary`, plus **any** frontmatter field you add |
| `bodyHtml` | The whole document rendered to HTML (title removed — render `guide.title` yourself) |
| `lead` | The intro text above the first heading, rendered to HTML (may be empty) |
| `sections` | Array of `{ heading, level, id, html, subHeadings }` — for accordions and side-navs |
| `contents` | Array of `{ text, level, href }` — a ready-made contents list linking to `bodyHtml` headings |
| `steps` | Array of `{ index, title, level, html }` — the document split into steps |
| `step` | The current step plus `stepIndex`, `totalSteps`, `isFirst`, `isLast`, `prevHref`, `nextHref` |

Use whichever you need — `bodyHtml` for a single page, `sections`/`contents` for
navigation, `step`/`steps` for click-through.

## Click-through (steps)

Steps are **server-driven**: the current step comes from a `?step=N` query
parameter, and `step.prevHref` / `step.nextHref` are pre-built links. No
JavaScript needed. See `task-stepper.njk`.

How a document splits into steps is controlled by the document's frontmatter:

- `steps: section` (default) — each top-level heading becomes a step.
- `steps: single` — the whole document is one step.

## Writing a guidance document (`content/`)

A `.md` file with an optional frontmatter block at the top:

```markdown
---
id: my-guide
title: My guidance title
type: task
summary: One line describing the guide.
steps: section
defaultViewer: task-stepper
---

# My guidance title

## First heading
...
```

| Field | Purpose |
| --- | --- |
| `id` | URL id (defaults to the filename) |
| `title` | Shown as the heading and in the picker |
| `type` | Free label, e.g. `task`, `reference`, `decision-tree` |
| `summary` | One-line description in the picker |
| `steps` | `section` or `single` (see above) |
| `defaultViewer` | The viewer highlighted as "Suggested" in the picker |

Any other field you add is available to templates as `guide.<field>`, so you can
pass per-document configuration to your own viewer.

## The viewers shipped as examples

| File | Presentation | Suits |
| --- | --- | --- |
| `single-page.njk` | Whole guide on one page | Any type (baseline) |
| `contents-nav.njk` | Side contents + body | Reference / policy manuals |
| `sections-preview.njk` | Sticky, collapsible contents nav + scrollable preview panel (the same pattern as the `guidance/sections` editor's preview) | Long or deeply-nested guides |
| `task-stepper.njk` | One step per screen, Previous/Next | Step-by-step tasks |
| `decision-branches.njk` | Collapsible section panels | Decision-tree / branching |
| `plain-example.html` | Standalone HTML + inline CSS | Any type (plain-HTML demo) |
