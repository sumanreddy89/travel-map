import { useEffect, useState } from "react";
import { api } from "../api";
import type { Stop, Trip } from "../types";
import { StopForm } from "./StopForm";
import { StopCard } from "./StopCard";
import { RenderPanel } from "./RenderPanel";

type Props = {
  tripId: string;
  onBack: () => void;
};

export function TripEditor({ tripId, onBack }: Props) {
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    api.getTrip(tripId).then(setTrip);
  }, [tripId]);

  if (!trip) return <div className="container">Loading...</div>;

  async function addStop(stop: { name: string; lat: number; lng: number; date?: string; notes?: string }) {
    const newStop = await api.addStop(tripId, stop);
    setTrip((t) => (t ? { ...t, stops: [...t.stops, newStop] } : t));
  }

  function updateStopLocal(updated: Stop) {
    setTrip((t) => (t ? { ...t, stops: t.stops.map((s) => (s.id === updated.id ? updated : s)) } : t));
  }

  async function deleteStop(stopId: string) {
    await api.deleteStop(tripId, stopId);
    setTrip((t) => (t ? { ...t, stops: t.stops.filter((s) => s.id !== stopId) } : t));
  }

  async function moveStop(index: number, direction: -1 | 1) {
    if (!trip) return;
    const stops = [...trip.stops];
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    [stops[index], stops[target]] = [stops[target], stops[index]];
    setTrip({ ...trip, stops });
    await api.reorderStops(tripId, stops.map((s) => s.id));
  }

  async function setOrientation(orientation: "landscape" | "portrait") {
    setTrip((t) => (t ? { ...t, orientation } : t));
    await api.updateTrip(tripId, { orientation });
  }

  async function setMusic(music: Trip["music"]) {
    setTrip((t) => (t ? { ...t, music } : t));
    await api.updateTrip(tripId, { music });
  }

  return (
    <div className="container">
      <button onClick={onBack} className="link-button">
        ← All trips
      </button>
      <h1>{trip.title}</h1>

      <TitleCardEditor trip={trip} onChange={setTrip} />

      {trip.stops.map((stop, i) => (
        <StopCard
          key={stop.id}
          tripId={tripId}
          stop={stop}
          index={i}
          count={trip.stops.length}
          onChange={updateStopLocal}
          onDelete={() => deleteStop(stop.id)}
          onMove={(dir) => moveStop(i, dir)}
        />
      ))}

      <StopForm onAdd={addStop} />

      <RenderPanel
        tripId={tripId}
        canRender={trip.stops.length >= 1}
        orientation={trip.orientation ?? "landscape"}
        onOrientationChange={setOrientation}
        music={trip.music}
        onMusicChange={setMusic}
      />
    </div>
  );
}

function TitleCardEditor({ trip, onChange }: { trip: Trip; onChange: (t: Trip) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(trip.titleCardNarration ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = draft !== (trip.titleCardNarration ?? "");

  useEffect(() => {
    setDraft(trip.titleCardNarration ?? "");
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  async function generate() {
    setBusy(true);
    try {
      const { titleCardNarration } = await api.generateTitleNarration(trip.id);
      setDraft(titleCardNarration);
      onChange({ ...trip, titleCardNarration, titleCardAudioPath: undefined, titleCardAudioDurationSec: undefined });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await api.updateTrip(trip.id, { titleCardNarration: draft });
      onChange(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="stop-header">
        <div style={{ flex: 1 }}>
          <strong>Opening line</strong>
        </div>
        <button onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Edit"}</button>
      </div>

      {!editing && (
        <p className="muted stop-preview">
          {trip.titleCardNarration
            ? trip.titleCardNarration.length > 140
              ? trip.titleCardNarration.slice(0, 140).trimEnd() + "…"
              : trip.titleCardNarration
            : "No opening line yet — click Edit to generate one."}
        </p>
      )}

      {editing && (
        <div className="stop-edit">
          {trip.titleCardNarration || draft ? (
            <>
              <textarea
                className="narration-text"
                value={draft}
                placeholder="AI-written opening line, spoken over the title card"
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="row">
                <button onClick={generate} disabled={busy}>
                  {busy ? "Working..." : "Regenerate with AI"}
                </button>
                <button className="primary" onClick={save} disabled={busy || !dirty}>
                  Save opening line
                </button>
              </div>
            </>
          ) : (
            <button onClick={generate} disabled={busy}>
              {busy ? "Writing..." : "Generate opening line with AI"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
