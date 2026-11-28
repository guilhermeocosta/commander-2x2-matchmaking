"use client";

import { useActionState, useState } from "react";

import { exportLeaderboardAction, type ExportData, type ExportState } from "./export-actions";

const initialState: ExportState = {};

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function recordLabel({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  return `${wins}-${draws}-${losses}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }
  return (
    <button type="button" className="btn btn-primary" onClick={copy}>
      {copied === "ok" ? "Copiado!" : copied === "fail" ? "Não deu para copiar" : "Copiar"}
    </button>
  );
}

function download(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "leaderboard.json";
  a.click();
  // Revoking right away cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportResult({ data }: { data: ExportData }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-base-content/70">
        Arquivo do site de {formatDate(data.sourceUpdatedAt)}: {data.updatedCount}{" "}
        {data.updatedCount === 1 ? "jogador atualizado" : "jogadores atualizados"},{" "}
        {data.newPlayers.length} {data.newPlayers.length === 1 ? "novo" : "novos"}.
      </p>

      {data.newPlayers.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-box border border-warning/40 bg-warning/10 p-4 text-warning"
        >
          <p className="font-semibold">Jogadores novos: revise antes de publicar</p>
          <p className="text-sm text-base-content/80">
            Não estavam no ranking. Confira o nome e o id; se algum já existe com outro nome, junte
            as estatísticas à mão.
          </p>
          <ul className="flex flex-col gap-1 text-sm text-base-content">
            {data.newPlayers.map((p) => (
              <li key={p.id} className="break-words">
                <span className="font-medium">{p.name}</span>{" "}
                <code className="font-mono text-xs">{p.id}</code>
                {p.reason === "missing-roster-id" && (
                  <span className="text-xs"> (id do ranking que saiu do arquivo)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Decklists para coletar</h3>
        {data.decklists.length === 0 ? (
          <p className="text-sm text-base-content/70">Ninguém teve 2 vitórias ou mais.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.decklists.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3">
                <span className="break-words">{d.name}</span>
                <span className="badge badge-sm badge-success shrink-0 font-mono">
                  {recordLabel(d)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-base-content/60">2 vitórias ou mais, byes incluídos.</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">leaderboard.json</h3>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={data.json} />
          <button type="button" className="btn" onClick={() => download(data.json)}>
            Baixar
          </button>
        </div>
        <textarea
          readOnly
          aria-label="Novo leaderboard.json"
          className="textarea h-80 w-full font-mono text-xs"
          value={data.json}
          spellCheck={false}
        />
        <p className="text-xs text-base-content/60">
          Substitua src/data/leaderboard.json no repositório do site e abra um PR.
        </p>
      </div>
    </div>
  );
}

/** "Gerar arquivo" fetches the site's current file and shows the updated one. */
export function ExportAdmin({ code }: { code: string }) {
  const [state, action, pending] = useActionState(exportLeaderboardAction, initialState);
  return (
    <div className="flex flex-col gap-4">
      <form action={action}>
        <input type="hidden" name="code" value={code} />
        <button type="submit" className="btn btn-primary btn-block sm:btn-wide" disabled={pending}>
          {pending ? "Gerando…" : state.data ? "Gerar de novo" : "Gerar arquivo"}
        </button>
      </form>
      {state.error && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          {state.error}
        </div>
      )}
      {state.data && <ExportResult data={state.data} />}
    </div>
  );
}
