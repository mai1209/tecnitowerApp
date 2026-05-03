export type AuthSessionUser = {
  _id: string;
  fullName: string;
  email: string;
  role: "admin" | "user";
  canWrite: boolean;
};

export type AuthSession = {
  token: string;
  user: AuthSessionUser;
};
