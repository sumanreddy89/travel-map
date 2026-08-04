import { useEffect, useState } from "react";
import { api } from "./api";
import type { Trip } from "./types";
import { TripEditor } from "./components/TripEditor";

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  function refresh() {
    api.listTrips().then(setTrips);
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
      {trips.length === 0 && <p className="muted">No trips yet.</p>}
      {trips.map((t) => (
        <div key={t.id} className="card trip-row" style={{ display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setSelected(t.id)}>
            <strong>{t.title}</strong>
            <span className="muted">
              {" "}
              — {t.stops.length} stop{t.stops.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            className="danger"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm(`Delete "${t.title}"? This can't be undone.`)) return;
              await api.deleteTrip(t.id);
              refresh();
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
