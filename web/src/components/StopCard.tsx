import { useRef, useState } from "react";
import { api } from "../api";
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

export function StopCard({ tripId, stop, index, count, onChange, onDelete, onMove }: Props) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(stop.date ?? "");
  const [notes, setNotes] = useState(stop.notes ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function saveEdits() {
    const updated = await api.updateStop(tripId, stop.id, { date, notes });
    onChange(updated);
    setEditing(false);
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

  return (
    <div className="card stop-card">
      <div className="stop-header">
        <div className="stop-order">
          <button disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button disabled={index === count - 1} onClick={() => onMove(1)}>
            ↓
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <strong>
            {index + 1}. {stop.name}
          </strong>
          {stop.date && <span className="muted"> — {stop.date}</span>}
        </div>
        <button onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Edit"}</button>
        <button className="danger" onClick={onDelete}>
          Remove
        </button>
      </div>

      {editing && (
        <div className="stop-edit">
          <input placeholder="Date" value={date} onChange={(e) => setDate(e.target.value)} />
          <textarea
            placeholder="Notes for the narration"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button className="primary" onClick={saveEdits}>
            Save
          </button>
        </div>
      )}

      {stop.notes && !editing && <p className="muted">{stop.notes}</p>}

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
          {uploading ? "..." : "+ Add photo/video"}
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
