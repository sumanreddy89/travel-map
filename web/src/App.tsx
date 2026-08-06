import { useEffect, useState } from "react";
import { api } from "./api";
import type { Trip } from "./types";
import { TripEditor } from "./components/TripEditor";
import { useConfirm } from "./components/ConfirmDialog";

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const confirm = useConfirm();

  function refresh() {
    setLoading(true);
    api
      .listTrips()
      .then(setTrips)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  if (selected) {
    return (
      <TripEditor
        tripId={selected}
        onBack={() => {
          setSelected(null);
          refresh();
        }}
      />
    );
  }

  async function createTrip() {
    if (!newTitle.trim()) return;
    const trip = await api.createTrip(newTitle.trim());
    setNewTitle("");
    setSelected(trip.id);
  }

  async function handleDelete(trip: Trip, e: React.MouseEvent) {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete trip",
      message: `Delete "${trip.title}"? This removes all its stops, photos/videos, and any generated video. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    await api.deleteTrip(trip.id);
    refresh();
  }

  return (
    <div className="container">
      <h1>TravelMap</h1>
      <p className="muted">Turn a route of places, photos and videos into a Globe Trekker-style travel video.</p>

      <div className="card">
        <h3>New trip</h3>
        <div className="row">
          <input
            placeholder="Trip title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTrip()}
          />
          <button className="primary" onClick={createTrip}>
            Create
          </button>
        </div>
      </div>

      <h3>Your trips</h3>
      {loading && <p className="muted">Loading your trips...</p>}
      {!loading && trips.length === 0 && (
        <div className="empty-state">
          <p className="muted">No trips yet — create one above to get started.</p>
        </div>
      )}
      {!loading &&
        trips.map((t) => (
          <div key={t.id} className="card trip-row" onClick={() => setSelected(t.id)}>
            <div className="trip-row-info">
              <strong>{t.title}</strong>
              <span className="muted">
                {" "}
                — {t.stops.length} stop{t.stops.length === 1 ? "" : "s"}
              </span>
            </div>
            <button className="danger" onClick={(e) => handleDelete(t, e)}>
              Delete
            </button>
          </div>
        ))}
    </div>
  );
}
