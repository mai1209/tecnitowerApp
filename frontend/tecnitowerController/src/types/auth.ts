export type AuthSessionUser = {
  _id: string;
  fullName: string;
  email: string;
  role: "admin" | "technician" | "viewer";
};

export type AuthSession = {
  token: string;
  user: AuthSessionUser;
};
