"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FileEntry } from "../../_lib/workspace-types";
import { SectionHeader } from "./section-header";
import { FileRow } from "./file-row";
import { NestedFolderGroup, FolderGroup } from "./folder-tree";
import { InlineCreateInput } from "./inline-create-input";
import { buildFolderTree } from "./tree-utils";

export function FileSidebar({
  files,
  activeFileKey,
  onSelect,
  onDelete,
  onCreateNote,
  onMoveNote,
  onRenameNote,
  onAddSource,
  onCreateExperiment,
}: {
  files: FileEntry[];
  activeFileKey: string;
  onSelect: (key: string) => void;
  onDelete?: (key: string) => void;
  onCreateNote?: (label: string, folder?: string) => string;
  onMoveNote?: (noteKey: string, newFolder: string | null) => void;
  onRenameNote?: (noteKey: string, newLabel: string) => void;
  onAddSource?: (input: { file?: File; url?: string }) => Promise<void>;
  onCreateExperiment?: (title: string) => string;
}) {
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [papersOpen, setPapersOpen] = useState(false);
  const [experimentsOpen, setExperimentsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingExperiment, setCreatingExperiment] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [addSourceUrl, setAddSourceUrl] = useState("");
  const [addSourceLoading, setAddSourceLoading] = useState(false);
  const [addSourceError, setAddSourceError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [pinnedFolders, setPinnedFolders] = useState<Set<string>>(new Set());
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const coreFiles = files.filter((f) => f.group === "core");
  const noteFiles = files.filter((f) => f.group === "note");
  const paperFiles = files.filter((f) => f.group === "paper");
  const experimentFiles = files.filter((f) => f.group === "experiment");
  const sourceFiles = files.filter((f) => f.group === "source");

  useEffect(() => {
    const noteFolderPaths = noteFiles
      .map((f) => f.folder)
      .filter((f): f is string => !!f);

    if (noteFolderPaths.length === 0) return;

    setPinnedFolders((prev) => {
      const next = new Set(prev);
      let changed = false;

      for (const folderPath of noteFolderPaths) {
        const segments = folderPath.split("/");
        let path = "";
        for (const seg of segments) {
          path = path ? `${path}/${seg}` : seg;
          if (!next.has(path)) {
            next.add(path);
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [noteFiles]);

  const { roots: noteFolders, ungrouped: ungroupedNotes } = buildFolderTree(
    noteFiles,
    pinnedFolders
  );

  const handleDeleteFolder = useCallback(
    (folderPath: string) => {
      const lastSlash = folderPath.lastIndexOf("/");
      const parentFolder = lastSlash > 0 ? folderPath.slice(0, lastSlash) : null;

      for (const file of noteFiles) {
        if (file.folder === folderPath || file.folder?.startsWith(folderPath + "/")) {
          onMoveNote?.(file.key, parentFolder);
        }
      }

      setPinnedFolders((prev) => {
        const next = new Set(prev);
        for (const path of prev) {
          if (path === folderPath || path.startsWith(folderPath + "/")) {
            next.delete(path);
          }
        }
        return next;
      });
    },
    [noteFiles, onMoveNote]
  );

  const handleDragStart = useCallback((e: React.DragEvent, key: string) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  }, []);

  const handleDrop = useCallback(
    (folderPath: string | null) => {
      if (dragKey && onMoveNote) {
        onMoveNote(dragKey, folderPath);
      }
      setDragKey(null);
      setDragOverFolder(null);
      setDragOverRoot(false);
    },
    [dragKey, onMoveNote]
  );

  const handleAddSourceFile = useCallback(
    async (file: File) => {
      if (!onAddSource) return;
      setAddSourceLoading(true);
      setAddSourceError(null);
      try {
        await onAddSource({ file });
        setAddingSource(false);
      } catch (err) {
        setAddSourceError((err as Error).message || "Failed to add source");
      } finally {
        setAddSourceLoading(false);
      }
    },
    [onAddSource]
  );

  const handleAddSourceUrl = useCallback(
    async (url: string) => {
      if (!onAddSource || !url.trim()) return;
      setAddSourceLoading(true);
      setAddSourceError(null);
      try {
        await onAddSource({ url: url.trim() });
        setAddingSource(false);
        setAddSourceUrl("");
      } catch (err) {
        setAddSourceError((err as Error).message || "Failed to add source");
      } finally {
        setAddSourceLoading(false);
      }
    },
    [onAddSource]
  );

  const totalArtifactCount = coreFiles.length + noteFiles.length;

  return (
    <div className="flex flex-col h-full select-none">
      <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-dim">
        Explorer
      </div>

      {(coreFiles.length > 0 || noteFiles.length > 0) && (
        <div>
          <SectionHeader
            title="Artifacts"
            count={totalArtifactCount}
            open={artifactsOpen}
            onToggle={() => setArtifactsOpen((v) => !v)}
            trailing={
              onCreateNote ? (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setArtifactsOpen(true);
                      setCreatingNote(true);
                      setCreatingFolder(false);
                    }}
                    className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                    title="New note"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setArtifactsOpen(true);
                      setCreatingFolder(true);
                      setCreatingNote(false);
                    }}
                    className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                    title="New folder"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                  </button>
                </div>
              ) : undefined
            }
          />
          <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: artifactsOpen ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              {coreFiles.map((file) => (
                <FileRow
                  key={file.key}
                  file={file}
                  active={file.key === activeFileKey}
                  onClick={() => onSelect(file.key)}
                />
              ))}

              {creatingNote && (
                <InlineCreateInput
                  icon="note"
                  placeholder="Note name..."
                  onSubmit={(label) => {
                    onCreateNote?.(label);
                    setCreatingNote(false);
                  }}
                  onCancel={() => setCreatingNote(false)}
                />
              )}

              {creatingFolder && (
                <InlineCreateInput
                  icon="folder"
                  placeholder="Folder name..."
                  onSubmit={(name) => {
                    setPinnedFolders((prev) => new Set(prev).add(name));
                    setCreatingFolder(false);
                  }}
                  onCancel={() => setCreatingFolder(false)}
                />
              )}

              <div
                onDragOver={(e) => {
                  if (!dragKey) return;
                  e.preventDefault();
                  setDragOverRoot(true);
                  setDragOverFolder(null);
                }}
                onDragLeave={() => setDragOverRoot(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverRoot(false);
                  handleDrop(null);
                }}
                className={dragOverRoot && dragKey ? "bg-accent-fill/8" : ""}
              >
                {ungroupedNotes.map((file) => (
                  <FileRow
                    key={file.key}
                    file={file}
                    active={file.key === activeFileKey}
                    onClick={() => onSelect(file.key)}
                    onDelete={onDelete}
                    onRename={onRenameNote}
                    draggable
                    onDragStart={handleDragStart}
                  />
                ))}
              </div>

              {noteFolders.map((node) => (
                <NestedFolderGroup
                  key={node.path}
                  node={node}
                  depth={0}
                  activeFileKey={activeFileKey}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onRename={onRenameNote}
                  onCreateNote={onCreateNote}
                  onCreateFolder={(path) => setPinnedFolders((prev) => new Set(prev).add(path))}
                  onDeleteFolder={handleDeleteFolder}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  dragOverFolder={dragOverFolder}
                  onDragOverFolder={setDragOverFolder}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {paperFiles.length > 0 && (
        <div className="mt-1">
          <SectionHeader
            title="Papers"
            count={paperFiles.length}
            open={papersOpen}
            onToggle={() => setPapersOpen((v) => !v)}
          />
          <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: papersOpen ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              {paperFiles.map((file) => (
                <FileRow
                  key={file.key}
                  file={file}
                  active={file.key === activeFileKey}
                  onClick={() => onSelect(file.key)}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-1">
        <SectionHeader
          title="Experiments"
          count={experimentFiles.length}
          open={experimentsOpen}
          onToggle={() => setExperimentsOpen((v) => !v)}
          trailing={
            onCreateExperiment ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExperimentsOpen(true);
                  setCreatingExperiment(true);
                }}
                className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                title="New experiment"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ) : undefined
          }
        />
        <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: experimentsOpen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            {creatingExperiment && (
              <InlineCreateInput
                icon="experiment"
                placeholder="Experiment name..."
                onSubmit={(label) => {
                  onCreateExperiment?.(label);
                  setCreatingExperiment(false);
                }}
                onCancel={() => setCreatingExperiment(false)}
              />
            )}
            {experimentFiles.map((file) => (
              <FileRow
                key={file.key}
                file={file}
                active={file.key === activeFileKey}
                onClick={() => onSelect(file.key)}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      </div>

      {(sourceFiles.length > 0 || onAddSource) && (
        <div className="mt-1">
          <SectionHeader
            title="Sources"
            count={sourceFiles.length}
            open={sourcesOpen}
            onToggle={() => setSourcesOpen((v) => !v)}
            trailing={
              onAddSource ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSourcesOpen(true);
                    setAddingSource((v) => !v);
                    setAddSourceError(null);
                    setAddSourceUrl("");
                  }}
                  className="p-0.5 rounded hover:bg-surface/60 text-dim hover:text-sub transition-all cursor-pointer"
                  title="Add source"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              ) : undefined
            }
          />
          <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: sourcesOpen ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              {addingSource && (
                <div className="mx-3 my-1.5 p-2 rounded-md bg-surface/60 border border-edge/30 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAddSourceFile(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={addSourceLoading}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] text-sub hover:text-heading hover:bg-page/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>Upload PDF</span>
                  </button>
                  <div className="flex items-center gap-2 px-2">
                    <div className="flex-1 h-px bg-edge/20" />
                    <span className="text-[9px] text-dim">or</span>
                    <div className="flex-1 h-px bg-edge/20" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={urlInputRef}
                      value={addSourceUrl}
                      onChange={(e) => setAddSourceUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && addSourceUrl.trim()) {
                          handleAddSourceUrl(addSourceUrl);
                        }
                        if (e.key === "Escape") {
                          setAddingSource(false);
                          setAddSourceUrl("");
                          setAddSourceError(null);
                        }
                      }}
                      placeholder="Paste PDF URL..."
                      disabled={addSourceLoading}
                      className="flex-1 bg-transparent border-b border-edge/30 focus:border-accent-fill/40 text-[11px] text-heading outline-none placeholder:text-dim/50 px-1 py-1 transition-colors disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleAddSourceUrl(addSourceUrl)}
                      disabled={addSourceLoading || !addSourceUrl.trim()}
                      className="px-2 py-1 rounded text-[10px] font-medium text-accent hover:bg-accent-fill/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                  {addSourceLoading && (
                    <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-dim">
                      <div className="w-3 h-3 border-[1.5px] border-dim/30 border-t-accent-fill rounded-full animate-spin" />
                      <span>Processing PDF...</span>
                    </div>
                  )}
                  {addSourceError && (
                    <div className="px-2 py-1 text-[10px] text-red-400 leading-snug">
                      {addSourceError}
                    </div>
                  )}
                </div>
              )}
              {(() => {
                const hasFolders = sourceFiles.some((file) => file.folder);
                if (!hasFolders) {
                  return sourceFiles.map((file) => (
                    <FileRow
                      key={file.key}
                      file={file}
                      active={file.key === activeFileKey}
                      onClick={() => onSelect(file.key)}
                      onDelete={onDelete}
                    />
                  ));
                }

                const folderMap = new Map<string, FileEntry[]>();
                const ungrouped: FileEntry[] = [];

                for (const file of sourceFiles) {
                  if (file.folder) {
                    const entries = folderMap.get(file.folder) ?? [];
                    entries.push(file);
                    folderMap.set(file.folder, entries);
                  } else {
                    ungrouped.push(file);
                  }
                }

                return (
                  <>
                    {Array.from(folderMap.entries()).map(([folderName, folderFiles]) => (
                      <FolderGroup
                        key={folderName}
                        folderName={folderName}
                        files={folderFiles}
                        activeFileKey={activeFileKey}
                        onSelect={onSelect}
                        onDelete={onDelete}
                      />
                    ))}
                    {ungrouped.map((file) => (
                      <FileRow
                        key={file.key}
                        file={file}
                        active={file.key === activeFileKey}
                        onClick={() => onSelect(file.key)}
                        onDelete={onDelete}
                      />
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
