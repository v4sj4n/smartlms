export type Health = { status: string; service: string; db: string };
export type Module = { key: string; name: string; permissions: string[] };
export type Role = { id: string; name: string; modules: Module[] };
export type User = { email: string; name: string; role: string };
export type Meta = { roles: Role[]; users: User[] };
export type ClassRoom = { id: string; name: string; capacity: number; tags: string[] };
export type Story = { id: string; floor: number; name: string; classes: ClassRoom[] };
export type Campus = { id: string; name: string; address?: string; stories: Story[] };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<Health>("/api/health"),
  meta: () => get<Meta>("/api/meta"),
  campuses: () => get<Campus[]>("/api/campuses"),
};
