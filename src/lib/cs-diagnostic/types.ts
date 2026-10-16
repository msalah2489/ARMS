/**
 * CS-FEATURE — Customer Service phone diagnostic types.
 * Safe to delete with the rest of src/lib/cs-diagnostic/.
 */

export type CsActionKind = "home_fix" | "go_to_branch" | "try_then_branch";

export type CsCause = {
  id: string;
  labelAr: string;
  /** Approximate likelihood 0–100; siblings on a node should be treated as guidance, not exact science. */
  percent: number;
};

export type CsAnswer = {
  id: string;
  labelAr: string;
  nextId: string;
};

export type CsQuestionNode = {
  id: string;
  kind: "question";
  promptAr: string;
  hintAr?: string;
  answers: CsAnswer[];
  /** Optional mid-path cause hints shown under the question. */
  causes?: CsCause[];
};

export type CsResultNode = {
  id: string;
  kind: "result";
  titleAr: string;
  summaryAr: string;
  action: CsActionKind;
  actionLabelAr: string;
  causes: CsCause[];
};

export type CsNode = CsQuestionNode | CsResultNode;

export type CsDiagnosticTree = {
  id: string;
  titleAr: string;
  startId: string;
  nodes: Record<string, CsNode>;
};
