"use client";

import { useState } from "react";
import type { ChatAskUserQuestion } from "../../../_lib/workspace-types";

export function AskUserCard({
  question,
  onAnswer,
}: {
  question: ChatAskUserQuestion;
  onAnswer?: (answer: string, isCustom: boolean) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const isPending = question.status === "pending";
  const isAnswered = question.status === "answered";
  const isTimedOut = question.status === "timed_out";

  return (
    <div className="mt-2.5 rounded-lg border border-edge/40 bg-page/40 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        {isPending && (
          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-violet-500/10 text-violet-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Question
          </span>
        )}
        {isAnswered && (
          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400">
            Answered
          </span>
        )}
        {isTimedOut && (
          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-surface/60 text-dim">
            Timed out
          </span>
        )}
      </div>

      <p className="text-[12px] text-heading font-medium leading-relaxed mb-2.5">
        {question.question}
      </p>

      {isPending && (
        <div className="space-y-1.5">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onAnswer?.(opt.label, false)}
              className="w-full text-left px-3 py-2 rounded-md border border-edge/30 bg-page/30 hover:bg-page/60 hover:border-edge/50 transition-colors cursor-pointer group"
            >
              <span className="text-[11.5px] text-heading font-medium group-hover:text-accent transition-colors">
                {opt.label}
              </span>
              <span className="block text-[10.5px] text-dim leading-snug mt-0.5">
                {opt.description}
              </span>
            </button>
          ))}

          {question.allowCustom !== false && (
            <>
              {!showCustom ? (
                <button
                  onClick={() => setShowCustom(true)}
                  className="text-[10.5px] text-dim hover:text-sub pl-1 cursor-pointer transition-colors"
                >
                  Other...
                </button>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customText.trim()) {
                        onAnswer?.(customText.trim(), true);
                      }
                      if (e.key === "Escape") {
                        setShowCustom(false);
                        setCustomText("");
                      }
                    }}
                    placeholder="Type your answer..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-[11.5px] text-heading bg-page/60 border border-edge/30 rounded-md outline-none focus:border-accent-fill/40 placeholder:text-mute"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (customText.trim()) onAnswer?.(customText.trim(), true);
                    }}
                    disabled={!customText.trim()}
                    className="px-2.5 py-1.5 text-[10px] font-semibold rounded-md bg-accent-fill/12 text-accent hover:bg-accent-fill/20 transition-colors disabled:opacity-30 disabled:cursor-default cursor-pointer"
                  >
                    Send
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isAnswered && question.answer && (
        <div className="px-3 py-2 rounded-md bg-emerald-500/5 border border-emerald-500/15">
          <span className="text-[11.5px] text-emerald-400/90">
            {question.answer}
          </span>
        </div>
      )}
    </div>
  );
}
