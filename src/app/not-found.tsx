import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-base-content/70">Confira o endereço ou o código do evento.</p>
      <Link href="/" className="btn btn-primary">
        Ir para o início
      </Link>
    </main>
  );
}
