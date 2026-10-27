import * as path from 'node:path';
import * as vscode from 'vscode';

type Category =
  | 'serverComponent'
  | 'clientComponent'
  | 'serverAction'
  | 'apiRoute'
  | 'workspacePackage';

type CategoryMeta = { badge: string; colorId: string; tooltip: string };

const CATEGORY_META: Record<Category, CategoryMeta> = {
  serverComponent: {
    badge: 'SC',
    colorId: 'nextjsTreeColors.serverComponent',
    tooltip: 'Server component',
  },
  clientComponent: {
    badge: 'CC',
    colorId: 'nextjsTreeColors.clientComponent',
    tooltip: "Client component ('use client')",
  },
  serverAction: {
    badge: 'SA',
    colorId: 'nextjsTreeColors.serverAction',
    tooltip: "Server action ('use server' or actions/ folder)",
  },
  apiRoute: {
    badge: 'RT',
    colorId: 'nextjsTreeColors.apiRoute',
    tooltip: 'API route (route.ts)',
  },
  workspacePackage: {
    badge: 'PK',
    colorId: 'nextjsTreeColors.workspacePackage',
    tooltip: 'Workspace package',
  },
};

const RELEVANT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const DIRECTIVE_SCAN_BYTES = 300;

const readLeadingDirective = async (
  uri: vscode.Uri
): Promise<'client' | 'server' | null> => {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const head = Buffer.from(bytes).toString('utf8', 0, DIRECTIVE_SCAN_BYTES);
    const leading = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use (client|server)['"]/.exec(
      head
    );
    if (!leading) return null;
    return leading[2] as 'client' | 'server';
  } catch {
    return null;
  }
};

const classifyFile = async (uri: vscode.Uri): Promise<Category | null> => {
  const base = path.basename(uri.fsPath);
  if (base === 'route.ts' || base === 'route.tsx') return 'apiRoute';

  const ext = path.extname(uri.fsPath);
  if (!RELEVANT_EXTENSIONS.has(ext)) return null;

  const segments = uri.fsPath.split(path.sep);
  const directive = await readLeadingDirective(uri);

  if (directive === 'server') return 'serverAction';
  if (segments.includes('actions')) return 'serverAction';
  if (directive === 'client') return 'clientComponent';
  if (ext === '.tsx' || ext === '.jsx') return 'serverComponent';
  return null;
};

const classifyFolder = async (uri: vscode.Uri): Promise<Category | null> => {
  const segments = uri.fsPath.split(path.sep);
  const parentName = segments.at(-2);
  if (parentName === 'packages') return 'workspacePackage';

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(uri);
  } catch {
    return null;
  }

  const fileCategories: Category[] = [];
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.File) continue;
    if (!RELEVANT_EXTENSIONS.has(path.extname(name))) continue;

    const category = await classifyFile(vscode.Uri.joinPath(uri, name));
    if (!category) return null;
    fileCategories.push(category);
  }

  if (fileCategories.length === 0) return null;
  const [first, ...rest] = fileCategories;
  return rest.every((category) => category === first) ? first : null;
};

class NextjsTreeColorsProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();

  readonly onDidChangeFileDecorations = this.emitter.event;

  refresh(uris?: vscode.Uri | vscode.Uri[]) {
    this.emitter.fire(uris);
  }

  async provideFileDecoration(
    uri: vscode.Uri
  ): Promise<vscode.FileDecoration | undefined> {
    if (uri.scheme !== 'file') return undefined;

    let stat: vscode.FileStat;
    try {
      stat = await vscode.workspace.fs.stat(uri);
    } catch {
      return undefined;
    }

    const isDirectory = stat.type === vscode.FileType.Directory;
    const category = isDirectory
      ? await classifyFolder(uri)
      : await classifyFile(uri);
    if (!category) return undefined;

    const meta = CATEGORY_META[category];
    return {
      badge: isDirectory ? undefined : meta.badge,
      color: new vscode.ThemeColor(meta.colorId),
      tooltip: meta.tooltip,
    };
  }
}

export const activate = (context: vscode.ExtensionContext) => {
  const provider = new NextjsTreeColorsProvider();
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(provider));

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');
  const refreshUriAndParent = (uri: vscode.Uri) => {
    provider.refresh([uri, vscode.Uri.joinPath(uri, '..')]);
  };

  watcher.onDidChange(refreshUriAndParent);
  watcher.onDidCreate(refreshUriAndParent);
  watcher.onDidDelete(refreshUriAndParent);
  context.subscriptions.push(watcher);
};

export const deactivate = () => {};
