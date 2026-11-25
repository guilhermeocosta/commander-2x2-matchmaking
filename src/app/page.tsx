import { EventCodeForm } from "./event-code-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-primary">Commander 2x2 · Matchmaking</h1>
      <div className="card w-full bg-base-200">
        <div className="card-body items-center gap-4">
          <p>Digite o código do evento que a organização mostrou.</p>
          <EventCodeForm />
        </div>
      </div>
      <a className="link link-primary text-sm" href="https://commander2x2.org">
        Voltar para commander2x2.org
      </a>
    </main>
  );
}
