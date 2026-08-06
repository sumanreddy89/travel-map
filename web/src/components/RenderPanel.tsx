import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { MusicTrack, Orientation, RenderJob, Trip } from "../types";

type Props = {
  tripId: string;
  canRender: boolean;
  orientation: Orientation;
  onOrientationChange: (orientation: Orientation) => void;
  music: Trip["music"];
  onMusicChange: (music: Trip["music"]) => void;
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

const NO_MUSIC = "__none__";

export function RenderPanel({
  tripId,
  canRender,
  orientation,
  onOrientationChange,
  music,
  onMusicChange,
}: Props) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    api.renderStatus(tripId).then(setJob).catch(() => {});
    api.listMusic().then(setTracks).catch(() => {});
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

  // Unset trip.music means "auto-pick whatever's in the music folder" - show
  // that as selected by default rather than nothing, since that's what will
  // actually be used, but nothing is persisted until the user picks explicitly.
  const selectedPath = music !== undefined ? music.path : (tracks[0]?.path ?? "");

  function handleMusicSelect(value: string) {
    if (value === NO_MUSIC) {
      onMusicChange({ path: "", volume: 0 });
      return;
    }
    const track = tracks.find((t) => t.path === value);
    if (track) onMusicChange({ path: track.path, volume: 0.15, durationSec: track.durationSec });
  }

  return (
    <div className="card">
      <h3>Generate video</h3>

      <div className="settings-row">
        <label className="settings-field">
          <span className="muted">Format</span>
          <select
            value={orientation}
            disabled={!!active}
            onChange={(e) => onOrientationChange(e.target.value as Orientation)}
          >
            <option value="landscape">Landscape (16:9)</option>
            <option value="portrait">Portrait (9:16)</option>
          </select>
        </label>

        {tracks.length > 0 && (
          <label className="settings-field">
            <span className="muted">Music</span>
            <select
              value={selectedPath === "" ? NO_MUSIC : selectedPath}
              disabled={!!active}
              onChange={(e) => handleMusicSelect(e.target.value)}
            >
              {tracks.map((t) => (
                <option key={t.path} value={t.path}>
                  {t.name}
                </option>
              ))}
              <option value={NO_MUSIC}>No music</option>
            </select>
          </label>
        )}
      </div>

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
          {job.warnings && job.warnings.length > 0 && (
            <div className="warning-box">
              The video's ready, but a few things didn't come through:
              <ul>
                {job.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
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
