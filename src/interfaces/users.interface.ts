import { AuthProvider } from "@prisma/client";
export interface User {
    id?: string;
    email: string;
    password: string;
    name?: string;
    authProvider?: AuthProvider;
  }
