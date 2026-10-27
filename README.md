# Next.js Tree Colors

Colors the VS Code file tree by Next.js file type:

| Badge | Meaning |
|---|---|
| **SC** | Server component |
| **CC** | Client component (`'use client'`) |
| **SA** | Server action (`'use server'` or an `actions/` folder) |
| **RT** | API route (`route.ts`) |
| **PK** | Workspace package (`packages/*`) |

Folders get a tinted name (no badge) when every file directly inside them shares one category.

## Try it

1. Open this folder in VS Code.
2. Press `F5` - this opens a second "Extension Development Host" window with the extension loaded.
3. In that second window, open any Next.js project folder and look at the Explorer tree.

## Colors

The actual colors are theme colors, so they can be overridden per VS Code theme via `workbench.colorCustomizations` using the ids in `package.json` -> `contributes.colors` (e.g. `nextjsTreeColors.clientComponent`).
