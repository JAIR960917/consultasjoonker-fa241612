import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({
  children,
  adminOnly = false,
  allowedRoles,
}: {
  children: JSX.Element;
  adminOnly?: boolean;
  allowedRoles?: Array<"admin" | "gerente" | "desenvolvedor">;
}) {
  const { user, role, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  // Desenvolvedor tem acesso total (equivalente a admin), exceto quando rota exige role específico via allowedRoles
  if (adminOnly && role !== "admin" && role !== "desenvolvedor") return <Navigate to="/" replace />;
  if (allowedRoles && (!role || !allowedRoles.includes(role))) return <Navigate to="/" replace />;
  return children;
}
