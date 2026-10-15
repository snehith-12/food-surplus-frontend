// ─── Session types (extend NextAuth) ────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: "RESTAURANT" | "SHELTER" | "ADMIN";
      orgName: string;
    };
  }

  interface User {
    id: string;
    email: string;
    role: "RESTAURANT" | "SHELTER" | "ADMIN";
    orgName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "RESTAURANT" | "SHELTER" | "ADMIN";
    orgName: string;
  }
}

// ─── API response types ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
