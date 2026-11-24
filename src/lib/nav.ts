export function homeFor(role: string) {
  return role === "admin" || role === "super_admin" ? "/admin" : role === "reviewer" ? "/reviewer" : "/dashboard";
}
