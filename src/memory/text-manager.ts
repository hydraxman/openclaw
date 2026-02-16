import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import type {
  MemoryEmbeddingProbeResult,
  MemorySearchManager,
  MemorySearchResult,
  MemorySource,
  MemorySyncProgressUpdate,
} from "./types.js";
import { resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { resolveMemorySearchConfig, type ResolvedMemorySearchConfig } from "../agents/memory-search.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  chunkMarkdown,
  isMemoryPath,
  listMemoryFiles,
  normalizeExtraMemoryPaths,
  remapChunkLines,
} from "./internal.js";
import { buildSessionEntry, listSessionFilesForAgent } from "./session-files.js";

const log = createSubsystemLogger("memory");
const INDEX_CACHE = new Map<string, TextMemoryManager>();
const SNIPPET_MAX_CHARS = 700;
const BM25_K1 = 1.2;
const BM25_B = 0.75;

type IndexedChunk = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  source: MemorySource;
  text: string;
  snippet: string;
  length: number;
};

type Posting = { index: number; tf: number };

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu);
  if (!matches) {
    return [];
  }
  return matches.filter((entry) => entry.length > 1);
}

function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function snippetForText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= SNIPPET_MAX_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, SNIPPET_MAX_CHARS - 1)}…`;
}

export class TextMemoryManager implements MemorySearchManager {
  private readonly cacheKey: string;
  private readonly cfg: OpenClawConfig;
  private readonly agentId: string;
  private readonly workspaceDir: string;
  private readonly settings: ResolvedMemorySearchConfig;
  private docs: IndexedChunk[] = [];
  private postings = new Map<string, Posting[]>();
  private docFrequency = new Map<string, number>();
  private avgDocLength = 0;
  private syncing: Promise<void> | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private dirty = true;

  static async get(params: { cfg: OpenClawConfig; agentId: string }): Promise<TextMemoryManager | null> {
    const settings = resolveMemorySearchConfig(params.cfg, params.agentId);
    if (!settings) {
      return null;
    }
    const workspaceDir = resolveAgentWorkspaceDir(params.cfg, params.agentId);
    const key = `${params.agentId}:${workspaceDir}:${JSON.stringify(settings)}`;
    const existing = INDEX_CACHE.get(key);
    if (existing) {
      return existing;
    }
    const manager = new TextMemoryManager({
      cacheKey: key,
      cfg: params.cfg,
      agentId: params.agentId,
      workspaceDir,
      settings,
    });
    INDEX_CACHE.set(key, manager);
    return manager;
  }

  private constructor(params: {
    cacheKey: string;
    cfg: OpenClawConfig;
    agentId: string;
    workspaceDir: string;
    settings: ResolvedMemorySearchConfig;
  }) {
    this.cacheKey = params.cacheKey;
    this.cfg = params.cfg;
    this.agentId = params.agentId;
    this.workspaceDir = params.workspaceDir;
    this.settings = params.settings;
    this.ensureIntervalSync();
  }

  async search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ): Promise<MemorySearchResult[]> {
    if (this.settings.sync.onSearch && this.dirty) {
      await this.sync({ reason: "search" });
    }

    const cleaned = query.trim();
    if (!cleaned) {
      return [];
    }
    if (this.docs.length === 0) {
      return [];
    }

    const terms = tokenize(cleaned);
    if (terms.length === 0) {
      return [];
    }

    const scoreByDoc = new Map<number, number>();
    const phrase = cleaned.toLowerCase();
    const docCount = this.docs.length;

    for (const term of terms) {
      const postings = this.postings.get(term);
      const df = this.docFrequency.get(term) ?? 0;
      if (!postings || df <= 0) {
        continue;
      }
      const idf = Math.log(1 + (docCount - df + 0.5) / (df + 0.5));
      for (const posting of postings) {
        const doc = this.docs[posting.index];
        if (!doc) {
          continue;
        }
        const tf = posting.tf;
        const norm = tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / Math.max(1, this.avgDocLength)));
        const score = idf * ((tf * (BM25_K1 + 1)) / Math.max(1e-9, norm));
        scoreByDoc.set(posting.index, (scoreByDoc.get(posting.index) ?? 0) + score);
      }
    }

    if (scoreByDoc.size === 0) {
      return [];
    }

    for (const [index, score] of scoreByDoc.entries()) {
      const doc = this.docs[index];
      if (!doc) {
        continue;
      }
      if (doc.text.toLowerCase().includes(phrase)) {
        scoreByDoc.set(index, score + 0.2);
      }
    }

    const maxRawScore = Math.max(...scoreByDoc.values(), 1e-9);
    const minScore = opts?.minScore ?? this.settings.query.minScore;
    const maxResults = opts?.maxResults ?? this.settings.query.maxResults;

    const ranked = Array.from(scoreByDoc.entries())
      .map(([index, raw]) => {
        const doc = this.docs[index]!;
        const normalized = Math.max(0, Math.min(1, raw / maxRawScore));
        return {
          path: doc.path,
          startLine: doc.startLine,
          endLine: doc.endLine,
          score: normalized,
          snippet: doc.snippet,
          source: doc.source,
        } satisfies MemorySearchResult;
      })
      .filter((entry) => entry.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return ranked;
  }

  async readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }> {
    const rawPath = params.relPath.trim();
    if (!rawPath) {
      throw new Error("path required");
    }
    const absPath = path.isAbsolute(rawPath)
      ? path.resolve(rawPath)
      : path.resolve(this.workspaceDir, rawPath);
    const relPath = path.relative(this.workspaceDir, absPath).replace(/\\/g, "/");
    const inWorkspace =
      relPath.length > 0 && !relPath.startsWith("..") && !path.isAbsolute(relPath);
    const allowedWorkspace = inWorkspace && isMemoryPath(relPath);
    let allowedAdditional = false;
    if (!allowedWorkspace && this.settings.extraPaths.length > 0) {
      const additionalPaths = normalizeExtraMemoryPaths(this.workspaceDir, this.settings.extraPaths);
      for (const additionalPath of additionalPaths) {
        try {
          const stat = await fs.lstat(additionalPath);
          if (stat.isSymbolicLink()) {
            continue;
          }
          if (stat.isDirectory()) {
            if (absPath === additionalPath || absPath.startsWith(`${additionalPath}${path.sep}`)) {
              allowedAdditional = true;
              break;
            }
            continue;
          }
          if (stat.isFile()) {
            if (absPath === additionalPath && absPath.endsWith(".md")) {
              allowedAdditional = true;
              break;
            }
          }
        } catch {}
      }
    }
    if (!allowedWorkspace && !allowedAdditional) {
      throw new Error("path required");
    }
    if (!absPath.endsWith(".md")) {
      throw new Error("path required");
    }
    const stat = await fs.lstat(absPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error("path required");
    }
    const content = await fs.readFile(absPath, "utf-8");
    if (!params.from && !params.lines) {
      return { text: content, path: relPath };
    }
    const lines = content.split("\n");
    const start = Math.max(1, params.from ?? 1);
    const count = Math.max(1, params.lines ?? lines.length);
    const slice = lines.slice(start - 1, start - 1 + count);
    return { text: slice.join("\n"), path: relPath };
  }

  async sync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void> {
    if (this.syncing) {
      return this.syncing;
    }
    this.syncing = this.runSync(params).finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  status() {
    const sourceMap = new Map<MemorySource, { files: number; chunks: number }>();
    for (const source of this.settings.sources) {
      sourceMap.set(source, { files: 0, chunks: 0 });
    }
    const filesBySource = new Map<MemorySource, Set<string>>();
    for (const source of this.settings.sources) {
      filesBySource.set(source, new Set());
    }
    for (const doc of this.docs) {
      sourceMap.get(doc.source)!.chunks += 1;
      filesBySource.get(doc.source)?.add(doc.path);
    }
    for (const [source, files] of filesBySource.entries()) {
      sourceMap.get(source)!.files = files.size;
    }

    const sourceCounts = Array.from(sourceMap.entries()).map(([source, counts]) => ({
      source,
      files: counts.files,
      chunks: counts.chunks,
    }));

    return {
      backend: "text" as const,
      provider: "text",
      model: "bm25-js",
      requestedProvider: "text",
      files: new Set(this.docs.map((doc) => doc.path)).size,
      chunks: this.docs.length,
      dirty: this.dirty,
      workspaceDir: this.workspaceDir,
      extraPaths: this.settings.extraPaths,
      sources: Array.from(this.settings.sources),
      sourceCounts,
      vector: { enabled: false, available: false },
      fts: { enabled: true, available: true },
      cache: { enabled: false },
    };
  }

  async probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult> {
    return { ok: true };
  }

  async probeVectorAvailability(): Promise<boolean> {
    return false;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    INDEX_CACHE.delete(this.cacheKey);
  }

  private ensureIntervalSync() {
    const every = Math.max(0, this.settings.sync.intervalMinutes);
    if (every <= 0) {
      return;
    }
    const ms = every * 60 * 1000;
    this.intervalTimer = setInterval(() => {
      void this.sync({ reason: "interval" }).catch((err) => {
        log.warn(`text memory sync failed (interval): ${String(err)}`);
      });
    }, ms);
  }

  private async runSync(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void> {
    const records: Array<{ path: string; source: MemorySource; chunks: ReturnType<typeof chunkMarkdown> }> = [];

    const memoryFiles = this.settings.sources.includes("memory")
      ? await listMemoryFiles(this.workspaceDir, this.settings.extraPaths)
      : [];

    const sessionFiles = this.settings.sources.includes("sessions")
      ? await listSessionFilesForAgent(this.agentId)
      : [];

    const total = memoryFiles.length + sessionFiles.length;
    let completed = 0;

    for (const absPath of memoryFiles) {
      try {
        const content = await fs.readFile(absPath, "utf-8");
        const relPath = path.relative(this.workspaceDir, absPath).replace(/\\/g, "/");
        const chunks = chunkMarkdown(content, this.settings.chunking);
        records.push({ path: relPath, source: "memory", chunks });
      } catch {
        // ignore unreadable files
      }
      completed += 1;
      params?.progress?.({ completed, total, label: "memory" });
    }

    for (const absPath of sessionFiles) {
      const entry = await buildSessionEntry(absPath);
      if (entry && entry.content.trim()) {
        const chunks = chunkMarkdown(entry.content, this.settings.chunking);
        remapChunkLines(chunks, entry.lineMap);
        records.push({ path: entry.path, source: "sessions", chunks });
      }
      completed += 1;
      params?.progress?.({ completed, total, label: "sessions" });
    }

    const docs: IndexedChunk[] = [];
    const postings = new Map<string, Posting[]>();
    const docFrequency = new Map<string, number>();

    for (const record of records) {
      for (const chunk of record.chunks) {
        const index = docs.length;
        const terms = countTerms(tokenize(chunk.text));
        if (terms.size === 0) {
          continue;
        }
        docs.push({
          id: `${record.path}:${chunk.startLine}:${chunk.endLine}`,
          path: record.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          source: record.source,
          text: chunk.text,
          snippet: snippetForText(chunk.text),
          length: Math.max(1, Array.from(terms.values()).reduce((sum, value) => sum + value, 0)),
        });

        for (const [term, tf] of terms.entries()) {
          const list = postings.get(term) ?? [];
          list.push({ index, tf });
          postings.set(term, list);
        }
        for (const term of terms.keys()) {
          docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
        }
      }
    }

    const avgDocLength =
      docs.length > 0 ? docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length : 0;

    this.docs = docs;
    this.postings = postings;
    this.docFrequency = docFrequency;
    this.avgDocLength = avgDocLength;
    this.dirty = false;
  }
}
