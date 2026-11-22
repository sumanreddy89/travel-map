import { useState } from "react";
import { api } from "../api";
import type { GeocodeResult } from "../types";
import { MapPicker } from "./MapPicker";

type Props = {
  onAdd: (stop: { name: string; lat: number; lng: number; date?: string; notes?: string }) => Promise<void>;
};

export function StopForm({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState(20);
  const [lng, setLng] = useState(0);
  const [picked, setPicked] = useState(false);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await api.geocode(query.trim());
      setResults(r);
    } finally {
      setSearching(false);
    }
  }

  function pick(r: GeocodeResult) {
    setLat(parseFloat(r.lat));
    setLng(parseFloat(r.lon));
    setName(r.display_name.split(",")[0]);
    setPicked(true);
    setResults([]);
    setQuery(r.display_name);
  }

  async function submit() {
    if (!name.trim() || !picked || saving) return;
    // Keep what was typed until the server has saved it; clear only on success.
    setSaving(true);
    setError("");
    try {
      await onAdd({ name: name.trim(), lat, lng, date: date || undefined, notes: notes || undefined });
    } catch (err) {
      setError(`Couldn't save the stop: ${(err as Error).message}`);
      return;
    } finally {
      setSaving(false);
    }
    setName("");
    setQuery("");
    setDate("");
    setNotes("");
    setPicked(false);
    setResults([]);
  }

  return (
    <div className="card">
      <h3>Add a stop</h3>
      <div className="row">
        <input
          placeholder="Search a place..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button onClick={search} disabled={searching}>
          {searching ? "Searching..." : "Search"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="results">
          {results.map((r, i) => (
            <li key={i} onClick={() => pick(r)}>
              {r.display_name}
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <>
          <MapPicker
            lat={lat}
            lng={lng}
            onChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
          <div className="row">
            <input placeholder="Stop name" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Date (optional)" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <textarea
            placeholder="Notes for the narration (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button className="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Add stop"}
          </button>
          {error && <p className="error-text" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}
