export interface User {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateUserInput = {
  email: string;
  password: string;
};

export type UpdateUserPasswordInput = {
  userId: number;
  newPassword: string;
};
