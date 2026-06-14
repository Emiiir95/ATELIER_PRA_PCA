import axios from "axios";
import type { AuthUser } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api`
  : "/api";

const api = axios.create({ baseURL: API_BASE });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 → clear session and redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const loginUser = (email: string, password: string): Promise<{ token: string; user: AuthUser }> =>
  api.post("/auth/login", { email, password }).then((r) => r.data);

export const getMe = (): Promise<AuthUser> =>
  api.get("/auth/me").then((r) => r.data);

// Classes
export const getClasses = () => api.get("/classes").then((r) => r.data);
export const createClass = (data: { label: string; year: string }) =>
  api.post("/classes", data).then((r) => r.data);
export const updateClass = (id: number, data: { label: string; year: string }) =>
  api.put(`/classes/${id}`, data).then((r) => r.data);
export const deleteClass = (id: number) => api.delete(`/classes/${id}`);

// Students
export const getStudents = (params?: { class_id?: number; year?: string; q?: string }) =>
  api.get("/students", { params }).then((r) => r.data);
export const createStudent = (data: {
  firstName: string;
  lastName: string;
  email: string;
  classId: number;
}) => api.post("/students", data).then((r) => r.data);
export const updateStudent = (
  id: number,
  data: { firstName: string; lastName: string; email: string; classId: number | null }
) => api.put(`/students/${id}`, data).then((r) => r.data);
export const deleteStudent = (id: number) => api.delete(`/students/${id}`);

// Photo upload
export const uploadPhoto = (studentId: number, file: File) => {
  const form = new FormData();
  form.append("photo", file);
  return api.post(`/students/${studentId}/photo`, form).then((r) => r.data);
};

// CSV import
export const importCsv = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/students/import", form).then((r) => r.data);
};

// Trombi
export const downloadTrombi = (classId: number, format: "html" | "pdf") =>
  api
    .get("/trombi", { params: { class_id: classId, format }, responseType: "blob" })
    .then((r) => r.data);
