import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Admin · Commander 2x2" };

// Admin pages read the session cookie before rendering anything, so redirects are real 307s.
export const instant = false;

export default async function LoginPage() {
  // Already logged in: skip the form.
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">Commander 2x2</h1>
        <p className="text-base-content/70">Área do organizador</p>
      </div>
      <div className="card bg-base-200">
        <div className="card-body">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
