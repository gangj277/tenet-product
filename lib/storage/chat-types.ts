export interface SessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface SessionMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NewSessionMessage {
  id?: string;
  role: "user" | "agent";
  text: string;
  metadata?: Record<string, unknown>;
}
