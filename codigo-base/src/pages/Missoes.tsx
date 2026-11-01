import { useEffect, useMemo, useState } from "react";
import { PageLayout } from "../components/layout/PageLayout";
import { missaoGlobalRepository } from "../data/repositories";
import type { Database } from "../types/database";
import "./Missoes.css";

// ---------------------------------------------------------------------------
// Missões (/missoes)
//
// Lista as missões do período corrente do usuário (globais diárias/semanais e
// diárias de curso), lidas de my_missions (migração 0031). Mostra resumo com
// pendentes e concluídas; cada cartão tem rótulo de contexto, meta, progresso,
// prazo e bônus (Q071/Q072/Q073). As missões de SALA ficam na página da sala.
// ---------------------------------------------------------------------------

type Missao = Database["public"]["Functions"]["my_missions"]["Returns"][number];
type Escopo = Database["public"]["Enums"]["mission_scope"];
type Objetivo = Database["public"]["Enums"]["mission_objective"];

const ROTULO_ESCOPO: Record<Escopo, string> = {
  global_daily: "Diária global",
  global_weekly: "Semanal global",
  course_daily: "Diária de curso",
};

const ROTULO_OBJETIVO: Record<Objetivo, string> = {
  complete_lessons: "Concluir aulas",
  correct_questions: "Acertar questões distintas",
  complete_executions: "Concluir execuções",
  study_days: "Estudar em dias distintos",
};

const errMsg = (error: unknown, fallback = "Erro desconhecido.") =>
  error instanceof Error ? error.message : fallback;

// Prazo relativo curto em pt-BR (ex.: "em 3h", "em 2d", "encerrada").
function prazoRelativo(fimIso: string, agora: Date = new Date()): string {
  const fim = new Date(fimIso).getTime();
  if (Number.isNaN(fim)) return "";
  const seg = Math.floor((fim - agora.getTime()) / 1000);
  if (seg <= 0) return "encerrada";
  const h = Math.floor(seg / 3600);
  if (h < 1) return `em ${Math.max(1, Math.floor(seg / 60))} min`;
  if (h < 24) return `em ${h}h`;
  return `em ${Math.floor(h / 24)}d`;
}

export default function Missoes() {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const lista = await missaoGlobalRepository.minhas();
        if (!cancelado) setMissoes(lista);
      } catch (error) {
        if (!cancelado) setErro(errMsg(error, "Não foi possível carregar as missões."));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  const pendentes = useMemo(() => missoes.filter((m) => !m.completed), [missoes]);
  const concluidas = useMemo(() => missoes.filter((m) => m.completed), [missoes]);

  return (
    <PageLayout variant="bare">
      <div className="missoes">
        <main className="missoes__main">
          <div className="missoes__brilho" />

          <header className="missoes__cabecalho">
            <div>
              <p className="missoes__caminho">PLATAFORMA / <span>MISSÕES</span></p>
              <h1 className="missoes__titulo">Missões</h1>
              <p className="missoes__subtitulo">
                Objetivos diários e semanais. Cumpra para ganhar XP de bônus.
              </p>
            </div>
          </header>

          {carregando ? (
            <p className="missoes__estado">Carregando missões...</p>
          ) : erro ? (
            <p className="missoes__estado missoes__estado--erro">{erro}</p>
          ) : missoes.length === 0 ? (
            <p className="missoes__estado">Nenhuma missão disponível no momento.</p>
          ) : (
            <>
              <section className="missoes__secao">
                <div className="missoes__secao-cabecalho">
                  <h2 className="missoes__secao-titulo">Pendentes</h2>
                  <span className="missoes__secao-resumo">{pendentes.length}</span>
                </div>
                {pendentes.length === 0 ? (
                  <p className="missoes__estado">Tudo em dia. Volte amanhã para novas missões.</p>
                ) : (
                  <ul className="missoes__lista">
                    {pendentes.map((missao) => (
                      <MissaoCartao key={missao.occurrence_id} missao={missao} />
                    ))}
                  </ul>
                )}
              </section>

              {concluidas.length > 0 && (
                <section className="missoes__secao">
                  <div className="missoes__secao-cabecalho">
                    <h2 className="missoes__secao-titulo">Concluídas</h2>
                    <span className="missoes__secao-resumo">{concluidas.length}</span>
                  </div>
                  <ul className="missoes__lista">
                    {concluidas.map((missao) => (
                      <MissaoCartao key={missao.occurrence_id} missao={missao} concluida />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </PageLayout>
  );
}

function MissaoCartao({ missao, concluida = false }: { missao: Missao; concluida?: boolean }) {
  const escopo = ROTULO_ESCOPO[missao.scope] ?? missao.scope;
  const objetivo = ROTULO_OBJETIVO[missao.objective] ?? missao.objective;
  const progresso = Math.min(100, Number(missao.progress) || 0);
  const contexto = missao.scope === "course_daily" && missao.course_title ? `${escopo} · ${missao.course_title}` : escopo;

  return (
    <li className={`missoes__item${concluida ? " missoes__item--concluida" : ""}`}>
      <div className="missoes__item-topo">
        <span className="missoes__contexto">{contexto}</span>
        <span className="missoes__prazo">{concluida ? "concluída" : prazoRelativo(missao.period_end)}</span>
      </div>

      <strong className="missoes__item-titulo">{missao.title}</strong>
      {missao.description && <p className="missoes__item-descricao">{missao.description}</p>}

      <div className="missoes__item-meta">
        <span className="missoes__objetivo">{objetivo}</span>
        <span className="missoes__contagem">
          {missao.current_count}/{missao.target}
        </span>
        <span className="missoes__bonus" aria-label={`Recompensa de ${missao.reward_xp} XP`}>
          +{missao.reward_xp} XP
        </span>
      </div>

      <div className="missoes__barra" role="progressbar" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progresso}%` }} />
      </div>
    </li>
  );
}
