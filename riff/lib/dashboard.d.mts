export function portAvailable(port: number): Promise<boolean>;
export function groupFindings(findings?: Record<string, any>[]): Record<string, any>[];
export function observationList(state: Record<string, any>): Record<string, any>[];
export function reviewObservation(state: Record<string, any>, review: Record<string, any>): Record<string, any>;
