import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { RenderJob } from "../types";

type Props = {
  tripId: string;
  canRender: boolean;
};

const STATE_LABEL: Record<string, string> = {
  idle: "Idle",
  narrating: "Writing narration",
  voicing: "Recording voiceover",
  mapping: "Preparing map animation",
  rendering: "Rendering video",
  done: "Done",
  error: "Error",
};

export function RenderPanel({ tripId, canRender }: Props) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api.renderStatus(tripId).then(setJob).catch(() => {});
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [tripId]);

  function startPolling() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const j = await api.renderStatus(tripId);
      setJob(j);
      if (j.state === "done" || j.state === "error") {
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    }, 1500);
  }

  async function start() {
    const j = await api.startRender(tripId);
    setJob(j);
    startPolling();
  }

  const active = job && ["narrating", "voicing", "mapping", "rendering"].includes(job.state);

  return (
    <div className="card">
      <h3>Generate video</h3>
      <button className="primary" onClick={start} disabled={!canRender || !!active}>
        {active ? "Generating..." : "Generate video"}
      </button>

      {job && job.state !== "idle" && (
        <div className="render-status">
          <div>{STATE_LABEL[job.state] ?? job.state}{job.message ? ` — ${job.message}` : ""}</div>
          {job.state === "rendering" && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.round(job.progress * 100)}%` }} />
            </div>
          )}
          {job.state === "error" && <div className="error-text">{job.error}</div>}
          {job.state === "done" && job.outputPath && (
            <div>
              <video src={`/data/${job.outputPath}`} controls style={{ width: "100%", marginTop: 12 }} />
              <a href={`/data/${job.outputPath}`} download className="primary" style={{ display: "inline-block", marginTop: 8 }}>
                Download video
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
