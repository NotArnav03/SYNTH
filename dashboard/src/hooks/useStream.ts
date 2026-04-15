import { useEffect, useRef, useState } from "react";
import {
  AgentInvocation,
  PaymentRecord,
  TaskDecomposition,
  TaskResult,
} from "../types";

export interface StreamState {
  connected: boolean;
  decompositions: TaskDecomposition[];
  invocations: AgentInvocation[];
  payments: PaymentRecord[];
  completed: TaskResult[];
}

const initial: StreamState = {
  connected: false,
  decompositions: [],
  invocations: [],
  payments: [],
  completed: [],
};

export function useStream(url: string = "/stream"): StreamState {
  const [state, setState] = useState<StreamState>(initial);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("hello", () => {
      setState((s) => ({ ...s, connected: true }));
    });
    es.addEventListener("decomposition", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as TaskDecomposition;
      setState((s) => ({ ...s, decompositions: [...s.decompositions, data] }));
    });
    es.addEventListener("invocation", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as AgentInvocation;
      setState((s) => {
        const existing = s.invocations.findIndex((i) => i.invocationId === data.invocationId);
        const next = [...s.invocations];
        if (existing >= 0) next[existing] = data;
        else next.push(data);
        return { ...s, invocations: next };
      });
    });
    es.addEventListener("payment", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as PaymentRecord;
      setState((s) => ({ ...s, payments: [...s.payments, data] }));
    });
    es.addEventListener("complete", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as TaskResult;
      setState((s) => ({ ...s, completed: [...s.completed, data] }));
    });
    es.onerror = () => {
      setState((s) => ({ ...s, connected: false }));
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [url]);

  return state;
}
