// Templated investigation notes. A note pasted from one paragraph with only the hostname
// changed is a sign that the investigation it describes did not happen case by case.
// Notes become term-frequency vectors over whitespace tokens, so a hostname is one token,
// and cases join a cluster when their cosine similarity reaches the threshold.

export interface NoteInput {
  id: string;
  text: string;
  owner: string;
}

export interface NoteMember {
  id: string;
  owner: string;
  text: string;
  // Similarity to the cluster's most central note.
  similarity: number;
}

export interface NoteCluster {
  size: number;
  medoidId: string;
  medoidText: string;
  meanSimilarity: number;
  owners: string[];
  members: NoteMember[];
}

export interface TemplatedNotesResult {
  threshold: number;
  notesCompared: number;
  clusters: NoteCluster[];
  flagged: boolean;
}

const WORD = /\w/;

// Strips punctuation from both ends of a token in one pass. A regex with a trailing
// [^\w]+$ backtracks quadratically on a long run of punctuation inside one token, and
// closure notes are text the entity wrote.
function trimToWord(raw: string): string {
  let start = 0;
  let end = raw.length;
  while (start < end && !WORD.test(raw[start]!)) start++;
  while (end > start && !WORD.test(raw[end - 1]!)) end--;
  return raw.slice(start, end);
}

function tokens(text: string): Map<string, number> {
  const tf = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/\s+/)) {
    const t = trimToWord(raw);
    if (t) tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  return tf;
}

interface Vec {
  tf: Map<string, number>;
  norm: number;
}

function vec(text: string): Vec {
  const tf = tokens(text);
  let sum = 0;
  for (const v of tf.values()) sum += v * v;
  return { tf, norm: Math.sqrt(sum) };
}

function cosine(a: Vec, b: Vec): number {
  if (!a.norm || !b.norm) return 0;
  const [small, large] = a.tf.size <= b.tf.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, v] of small.tf) {
    const w = large.tf.get(t);
    if (w) dot += v * w;
  }
  return dot / (a.norm * b.norm);
}

export function noteSimilarity(a: string, b: string): number {
  return cosine(vec(a), vec(b));
}

export function templatedNotes(notes: readonly NoteInput[], threshold: number, minCluster: number): TemplatedNotesResult {
  const vs = notes.map((n) => vec(n.text));
  const n = notes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosine(vs[i]!, vs[j]!) >= threshold) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r) ?? [];
    g.push(i);
    groups.set(r, g);
  }

  const clusters: NoteCluster[] = [];
  for (const idx of groups.values()) {
    if (idx.length < minCluster) continue;
    // The medoid is the note closest on average to every other note in the cluster.
    let medoid = idx[0]!;
    let best = -1;
    for (const i of idx) {
      let sum = 0;
      for (const j of idx) if (i !== j) sum += cosine(vs[i]!, vs[j]!);
      if (sum > best) {
        best = sum;
        medoid = i;
      }
    }
    const members = idx
      .map((i) => ({ id: notes[i]!.id, owner: notes[i]!.owner, text: notes[i]!.text, similarity: i === medoid ? 1 : cosine(vs[i]!, vs[medoid]!) }))
      .sort((a, b) => b.similarity - a.similarity || (a.id < b.id ? -1 : 1));
    const others = members.filter((m) => m.id !== notes[medoid]!.id);
    clusters.push({
      size: idx.length,
      medoidId: notes[medoid]!.id,
      medoidText: notes[medoid]!.text,
      meanSimilarity: others.length ? others.reduce((s, m) => s + m.similarity, 0) / others.length : 1,
      owners: [...new Set(members.map((m) => m.owner))].sort(),
      members,
    });
  }
  clusters.sort((a, b) => b.size - a.size || (a.medoidId < b.medoidId ? -1 : 1));
  return { threshold, notesCompared: n, clusters, flagged: clusters.length > 0 };
}
