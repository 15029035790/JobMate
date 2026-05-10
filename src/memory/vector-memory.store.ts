import type { EmbeddingRecord } from "../domain/types.ts"
import { createId, nowIso } from "../utils/id.ts"

export interface VectorSearchResult {
  record: EmbeddingRecord
  score: number
}

export class VectorMemoryStore {
  private readonly records: EmbeddingRecord[] = []

  add(input: Omit<EmbeddingRecord, "id" | "createdAt" | "vector"> & { vector?: number[] }): EmbeddingRecord {
    const record: EmbeddingRecord = {
      ...input,
      id: createId("embedding"),
      vector: input.vector ?? simpleTextVector(input.text),
      createdAt: nowIso()
    }
    this.records.push(record)
    return record
  }

  search(userId: string, text: string, topK = 5): EmbeddingRecord[] {
    return this.searchWithScores(userId, text, topK).map((x) => x.record)
  }

  searchWithScores(userId: string, text: string, topK = 5, minScore = 0): VectorSearchResult[] {
    const query = simpleTextVector(text)
    return this.records
      .filter((record) => record.userId === userId)
      .map((record) => ({ record, score: cosine(query, record.vector) }))
      .filter((x) => x.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
}

function simpleTextVector(text: string): number[] {
  const buckets = new Array(16).fill(0)
  for (const token of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    const index = [...token].reduce((sum, char) => sum + char.charCodeAt(0), 0) % buckets.length
    buckets[index] += 1
  }
  return buckets
}

function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0)
  const magA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0))
  const magB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0))
  return magA && magB ? dot / (magA * magB) : 0
}
