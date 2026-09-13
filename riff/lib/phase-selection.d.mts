export function selectReadyPhase<T extends { id: string; status: string; priority?: string; depends_on?: string[] }>(phases: T[]): T | null;
