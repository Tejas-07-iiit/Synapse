export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
