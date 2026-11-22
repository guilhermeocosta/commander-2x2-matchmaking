export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-primary">Commander 2x2 · Matchmaking</h1>
      <div className="card w-full bg-base-200">
        <div className="card-body items-center gap-3">
          <span className="badge badge-primary badge-outline">Em construção</span>
          <p>
            Em breve você vai entrar nos eventos, ver sua mesa e enviar seus resultados por aqui.
          </p>
          <a className="link link-primary" href="https://commander2x2.org">
            Voltar para commander2x2.org
          </a>
        </div>
      </div>
    </main>
  );
}
