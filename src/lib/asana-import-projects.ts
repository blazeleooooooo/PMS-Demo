export const ASANA_IMPORT_WORKSPACE_GID = "0000000000000001";

export const ASANA_IMPORT_PROJECTS = [
  {
    key: "active-1",
    gid: "1000000000000001",
    name: "Demo board 1",
    shortName: "Active 1",
  },
  {
    key: "active-2",
    gid: "1000000000000002",
    name: "Demo board 2",
    shortName: "Active 2",
  },
  {
    key: "active-2a",
    gid: "1000000000000003",
    name: "Demo board 3",
    shortName: "Active 2A",
  },
] as const;

export type AsanaImportProjectKey = (typeof ASANA_IMPORT_PROJECTS)[number]["key"];

export type AsanaImportProject = (typeof ASANA_IMPORT_PROJECTS)[number];

export type AsanaImportTask = {
  gid: string;
  name: string;
  completed: boolean;
  assigneeName: string | null;
  createdAt: string | null;
  dueOn: string | null;
  permalinkUrl: string | null;
  projectKey: AsanaImportProjectKey;
  projectName: string;
  projectShortName: string;
};

const PROJECT_KEY_SET = new Set<string>(ASANA_IMPORT_PROJECTS.map((p) => p.key));

export function isAsanaImportProjectKey(value: string): value is AsanaImportProjectKey {
  return PROJECT_KEY_SET.has(value);
}

export function getAsanaImportProject(key: AsanaImportProjectKey): AsanaImportProject {
  const project = ASANA_IMPORT_PROJECTS.find((item) => item.key === key);
  if (!project) {
    throw new Error(`Unknown Asana import project: ${key}`);
  }
  return project;
}

export function listAsanaImportProjects(): AsanaImportProject[] {
  return [...ASANA_IMPORT_PROJECTS];
}

export function filterImportedAsanaTasks<T extends { gid: string }>(
  tasks: T[],
  importedGids: Set<string>
): { visible: T[]; hiddenCount: number } {
  const visible = tasks.filter((task) => !importedGids.has(task.gid));
  return { visible, hiddenCount: tasks.length - visible.length };
}
