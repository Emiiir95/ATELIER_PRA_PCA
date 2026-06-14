export interface User {
  id: number;
  email: string;
  role: "ADMIN" | "TEACHER";
}

export interface Class {
  id: number;
  label: string;
  year: string;
  createdAt: string;
  _count?: { students: number };
}

export interface Student {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  photoUrl: string | null;
  classId: number | null;
  createdAt: string;
  class?: { id: number; label: string; year: string };
}

export interface ImportResult {
  created: number;
  errors: number;
  details: { row: Record<string, string>; status?: string; error?: string }[];
}
