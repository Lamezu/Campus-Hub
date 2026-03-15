import type { JamendoTrack } from '../types';

const CLIENT_ID = '04efd656';
const BASE_URL = 'https://api.jamendo.com/v3.0';

export async function searchTracks(query: string): Promise<JamendoTrack[]> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    format: 'json',
    limit: '20',
    namesearch: query,
    audioformat: 'mp31',
  });

  const res = await fetch(`${BASE_URL}/tracks/?${params}`);
  if (!res.ok) throw new Error('Jamendo request failed');

  const data = await res.json();
  return (data.results ?? []).map((t: Record<string, string>): JamendoTrack => ({
    id: String(t.id),
    name: t.name,
    artistName: t.artist_name,
    audioUrl: t.audio,
    coverUrl: t.image,
  }));
}