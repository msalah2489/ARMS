"use client";

/**
 * CS-FEATURE — Generic walker for cs-diagnostic tree data.
 * Delete with src/components/customer-service/ when removing the feature.
 */

import { useMemo, useState } from "react";
import type { CsCause, CsDiagnosticTree, CsNode, CsResultNode } from "@/lib/cs-diagnostic";

function CausesList({ causes }: { causes: CsCause[] }) {
  if (!causes.length) return null;
  const sorted = [...causes].sort((a, b) => b.percent - a.percent);
  return (
    <ul className="mt-3 space-y-2">
      {sorted.map((cause) => (
        <li
          key={cause.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-ink-900/10 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-ink-900/60"
        >
          <span className="text-ink-900 dark:text-sand-50">{cause.labelAr}</span>
          <span className="shrink-0 rounded-lg bg-aroma-100 px-2 py-0.5 text-xs font-semibold text-aroma-900 dark:bg-aroma-900/40 dark:text-aroma-100">
            {cause.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function actionTone(action: CsResultNode["action"]) {
  if (action === "go_to_branch") {
    return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100";
  }
  if (action === "try_then_branch") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100";
}

export function DiagnosticWizard({ tree }: { tree: CsDiagnosticTree }) {
  const [nodeId, setNodeId] = useState(tree.startId);
  const [trail, setTrail] = useState<string[]>([]);

  const node: CsNode | undefined = tree.nodes[nodeId];

  const stepLabel = useMemo(() => {
    const step = trail.length + 1;
    return `الخطوة ${step}`;
  }, [trail.length]);

  function goTo(nextId: string) {
    setTrail((prev) => [...prev, nodeId]);
    setNodeId(nextId);
  }

  function goBack() {
    setTrail((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const prevId = next.pop()!;
      setNodeId(prevId);
      return next;
    });
  }

  function restart() {
    setTrail([]);
    setNodeId(tree.startId);
  }

  if (!node) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        عقدة تشخيص مفقودة ({nodeId}). أعد بدء المعالج.
        <button type="button" className="mt-3 block text-aroma-800 underline" onClick={restart}>
          إعادة البدء
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-700/60 dark:text-sand-100/60">
          {tree.titleAr} · {stepLabel}
        </p>
        <div className="flex gap-2">
          {trail.length > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-xl border border-ink-900/10 px-3 py-1.5 text-xs text-ink-800 hover:border-aroma-400 dark:border-white/10 dark:text-sand-100"
            >
              رجوع
            </button>
          ) : null}
          <button
            type="button"
            onClick={restart}
            className="rounded-xl border border-ink-900/10 px-3 py-1.5 text-xs text-ink-800 hover:border-aroma-400 dark:border-white/10 dark:text-sand-100"
          >
            من البداية
          </button>
        </div>
      </div>

      {node.kind === "question" ? (
        <section className="rounded-2xl border border-ink-900/10 bg-sand-50 p-5 dark:border-white/10 dark:bg-ink-900">
          <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">{node.promptAr}</h2>
          {node.hintAr ? (
            <p className="mt-2 text-sm text-ink-700/70 dark:text-sand-100/70">{node.hintAr}</p>
          ) : null}
          {node.causes?.length ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-ink-700/50 dark:text-sand-100/50">
                احتمالات مبدئية (إرشادية)
              </p>
              <CausesList causes={node.causes} />
            </div>
          ) : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {node.answers.map((answer) => (
              <button
                key={answer.id}
                type="button"
                onClick={() => goTo(answer.nextId)}
                className="min-h-12 rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-right text-sm font-medium text-ink-900 hover:border-aroma-400 hover:bg-aroma-50 dark:border-white/15 dark:bg-ink-950 dark:text-sand-50 dark:hover:border-aroma-400 dark:hover:bg-ink-900"
              >
                {answer.labelAr}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-ink-900/10 bg-sand-50 p-5 dark:border-white/10 dark:bg-ink-900">
          <h2 className="font-display text-xl text-ink-900 dark:text-sand-50">{node.titleAr}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700/80 dark:text-sand-100/80">
            {node.summaryAr}
          </p>
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${actionTone(node.action)}`}>
            الإجراء: {node.actionLabelAr}
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-ink-700/50 dark:text-sand-100/50">
              الأسباب المحتملة (%)
            </p>
            <CausesList causes={node.causes} />
          </div>
          <button
            type="button"
            onClick={restart}
            className="mt-5 rounded-xl bg-ink-900 px-4 py-2.5 text-sm text-sand-50 hover:bg-ink-800 dark:bg-aroma-700 dark:hover:bg-aroma-600"
          >
            شكوى جديدة — من البداية
          </button>
        </section>
      )}
    </div>
  );
}
