# Kaizen Artifacts

Interactive and visual artifacts for Kaizen OS projects. Hosted via GitHub Pages and embedded in Notion project pages.

## Structure

```
kaizen-artifacts/
├── index.html              ← Artifact gallery
├── <project>/              ← Project folder (matches Projects DB name)
│   └── <artifact>.html     ← Self-contained HTML artifact
├── shared/                 ← Cross-project utilities
│   ├── css/
│   └── js/
└── test/                   ← Test artifacts for verification
```

## Conventions

- **Project folders** use `lowercase-with-hyphens` matching the project name in Notion Projects DB
- **One HTML file per artifact** — self-contained with inline CSS/JS when possible
- **Shared assets** in `/shared/` when reused across projects
- **URL pattern:** `https://kaizensiriuskintsugi.github.io/kaizen-artifacts/<project>/<artifact>.html`

## Artifact Types Hosted Here

| Type | Example |
|------|---------|
| Interactive HTML | Dashboards, calculators, visualizations |
| Mermaid diagrams | Rendered with Mermaid CDN, zoomable |
| React/Vue components | Self-contained with CDN imports |
| Data visualizations | Charts, graphs, pipeline views |

## What Does NOT Go Here

- Static documentation (use Notion pages or MCP workspace)
- Source code files (.py, .js, .cpp) — stays in project repos or MCP workspace
- Config files, JSON exports — stays in MCP workspace
- Binary files — stays in appropriate storage

## Publishing

1. Save HTML file to `<project>/<artifact-name>.html`
2. `git add . && git commit -m "Add <artifact> for <project>" && git push`
3. GitHub Pages auto-deploys (< 1 minute)
4. Embed in Notion via `/embed` block with the GitHub Pages URL

## Notion Integration

Artifacts are embedded in Notion project pages via `/embed` blocks. They auto-update when republished (new commit pushed). The PDP page body of each project contains an **Artifact Registry** table tracking all project deliverables and a **Live Artifact Embeds** section for interactive previews.
