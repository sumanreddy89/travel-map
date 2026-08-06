import { useRef, useState } from "react";
import { api } from "../api";
import { useConfirm } from "./ConfirmDialog";
import type { Stop } from "../types";

type Props = {
  tripId: string;
  stop: Stop;
  index: number;
  count: number;
  onChange: (stop: Stop) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

export function StopCard({ tripId, stop, index, count, onChange, onDelete, onMove }: Props) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(stop.date ?? "");
  const [notes, setNotes] = useState(stop.notes ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [narrationDraft, setNarrationDraft] = useState(stop.narration ?? "");
  const [narrationBusy, setNarrationBusy] = useState(false);
  const narrationDirty = narrationDraft !== (stop.narration ?? "");
  const confirm = useConfirm();

  async function handleDelete() {
    const ok = await confirm({
      title: "Remove stop",
      message: `Remove "${stop.name}" and its ${stop.media.length} photo${stop.media.length === 1 ? "" : "s"}/video${stop.media.length === 1 ? "" : "s"}? This can't be undone.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) onDelete();
  }

  async function saveEdits() {
    const updated = await api.updateStop(tripId, stop.id, { date, notes });
    onChange(updated);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const added = await api.uploadMedia(tripId, stop.id, files);
      onChange({ ...stop, media: [...stop.media, ...added] });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeMedia(mediaId: string) {
    await api.deleteMedia(tripId, stop.id, mediaId);
    onChange({ ...stop, media: stop.media.filter((m) => m.id !== mediaId) });
  }

  async function generateNarration() {
    setNarrationBusy(true);
    try {
      const updated = await api.generateStopNarration(tripId, stop.id);
      setNarrationDraft(updated.narration ?? "");
      onChange(updated);
    } finally {
      setNarrationBusy(false);
    }
  }

  async function saveNarration() {
    setNarrationBusy(true);
    try {
      const updated = await api.updateStop(tripId, stop.id, { narration: narrationDraft });
      onChange(updated);
    } finally {
      setNarrationBusy(false);
    }
  }

  return (
    <div className="card stop-card">
      <div className="stop-header">
        <div className="stop-order">
          <button disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            ↑
          </button>
          <button disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
            ↓
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <strong>
            {index + 1}. {stop.name}
          </strong>
          {stop.date && <span className="muted"> — {stop.date}</span>}
        </div>
        <button onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Edit"}</button>
        <button className="danger" onClick={handleDelete}>
          Remove
        </button>
      </div>

      {!editing && (stop.notes || stop.narration) && (
        <p className="muted stop-preview">{stop.notes || truncate(stop.narration ?? "", 140)}</p>
      )}

      {editing && (
        <div className="stop-edit">
          <input placeholder="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          <textarea
            placeholder="Notes for the narration"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button className="primary" onClick={saveEdits}>
            Save details
          </button>

          <div className="narration-block">
            <div className="narration-label">
              Narration
              {stop.audioPath && !narrationDirty && <span className="muted"> · voiceover recorded</span>}
              {narrationDirty && <span className="muted"> · unsaved edit, will re-record voiceover</span>}
            </div>
            {stop.narration || narrationDraft ? (
              <>
                <textarea
                  className="narration-text"
                  value={narrationDraft}
                  placeholder="AI-written narration for this stop"
                  onChange={(e) => setNarrationDraft(e.target.value)}
                />
                <div className="row">
                  <button onClick={generateNarration} disabled={narrationBusy}>
                    {narrationBusy ? "Working..." : "Regenerate with AI"}
                  </button>
                  <button className="primary" onClick={saveNarration} disabled={narrationBusy || !narrationDirty}>
                    Save narration
                  </button>
                </div>
              </>
            ) : (
              <button onClick={generateNarration} disabled={narrationBusy}>
                {narrationBusy ? "Writing..." : "Generate narration with AI"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="media-grid">
        {stop.media.map((m) => (
          <div key={m.id} className="media-thumb">
            {m.type === "photo" ? (
              <img src={`/data/${m.path}`} alt="" />
            ) : (
              <video src={`/data/${m.path}`} muted />
            )}
            <button className="media-remove" onClick={() => removeMedia(m.id)}>
              ×
            </button>
          </div>
        ))}
        <label className="media-add">
          {uploading ? "..." : "+ Add"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
    </div>
  );
}
