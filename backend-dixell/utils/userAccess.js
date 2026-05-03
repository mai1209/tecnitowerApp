export function normalizeUserRole(role) {
  return String(role ?? "").trim().toLowerCase() === "admin" ? "admin" : "user";
}

export function getUserCanWrite(user) {
  const normalizedRole = normalizeUserRole(user?.role);
  if (normalizedRole === "admin") return true;
  if (typeof user?.canWrite === "boolean") return user.canWrite;

  const legacyRole = String(user?.role ?? "").trim().toLowerCase();
  if (legacyRole === "viewer") return false;
  return true;
}

export function buildPublicUser(user) {
  return {
    _id: user?._id?.toString?.() ?? String(user?._id ?? ""),
    fullName: user?.fullName,
    email: user?.email,
    role: normalizeUserRole(user?.role),
    canWrite: getUserCanWrite(user),
    isActive: user?.isActive,
    createdAt: user?.createdAt,
  };
}
