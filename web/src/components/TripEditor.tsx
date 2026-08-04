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

  return (
    <div className="container">
      <button onClick={onBack} className="link-button">
        ← All trips
      </button>
      <h1>{trip.title}</h1>

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

      <RenderPanel tripId={tripId} canRender={trip.stops.length >= 1} />
    </div>
  );
}
