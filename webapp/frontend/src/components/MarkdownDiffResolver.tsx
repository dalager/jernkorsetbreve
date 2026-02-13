import { useState } from "react";
import { diffWords, Change } from "diff";
import { Button } from '@/components/ui/button';
import { CheckCircle, CloseCircle } from '@/components/ui/icons';

interface MarkdownDiffResolverProps {
    originalMd: string;
    correctedMd: string;
}

type ChunkStatus = "pending" | "accepted" | "rejected";

interface DiffChunk {
    id: number;
    value: string;
    added: boolean;
    removed: boolean;
    status: ChunkStatus;
    // Extend to handle merged changes:
    oldValue?: string;
    newValue?: string;
}

export default function MarkdownDiffResolver({
    originalMd,
    correctedMd,
}: MarkdownDiffResolverProps) {
    function unifyDiff(changes: Change[]): DiffChunk[] {
        // Merges consecutive removed+added chunks into a single DiffChunk
        const merged: DiffChunk[] = [];
        let i = 0;
        let idCounter = 1;

        while (i < changes.length) {
            const c = changes[i];
            if (c.removed && i + 1 < changes.length && changes[i + 1].added) {
                // Combine both into one “changed word” chunk
                merged.push({
                    id: idCounter++,
                    value: c.value + " => " + changes[i + 1].value, // For display
                    added: false,
                    removed: false,
                    status: "pending",
                    oldValue: c.value,
                    newValue: changes[i + 1].value,
                });
                i += 2;
            } else {
                // Normal chunk
                merged.push({
                    id: idCounter++,
                    value: c.value,
                    added: !!c.added,
                    removed: !!c.removed,
                    status: "pending",
                });
                i++;
            }
        }
        return merged;
    }

    const rawDiff = diffWords(originalMd, correctedMd);
    const [diffChunks, setDiffChunks] = useState<DiffChunk[]>(() => {
        return unifyDiff(rawDiff);
    });

    /**
     * Build the final text, taking into account each chunk’s status:
     *  - For unchanged chunks: always included.
     *  - For removed chunks: "accepted" => remove them, "rejected" => keep them.
     *  - For added chunks:   "accepted" => keep them,  "rejected" => omit them.
     */
    function computeFinalText(chunks: DiffChunk[]): string {
        return chunks
            .map((chunk) => {
                // Handle merged chunk
                if (chunk.oldValue !== undefined && chunk.newValue !== undefined) {
                    return chunk.status === "accepted" ? chunk.newValue : chunk.oldValue;
                }
                // Unchanged text
                if (!chunk.added && !chunk.removed) {
                    return chunk.value;
                }

                // Added text
                if (chunk.added) {
                    if (chunk.status === "accepted") {
                        return chunk.value;
                    } else {
                        return "";
                    }
                }

                // Removed text
                if (chunk.removed) {
                    if (chunk.status === "rejected") {
                        return chunk.value;
                    } else {
                        return "";
                    }
                }

                return ""; // Fallback
            })
            .join("");
    }

    function handleAccept(id: number) {
        setDiffChunks((prev) =>
            prev.map((chunk) => {
                if (chunk.id === id) {
                    return { ...chunk, status: "accepted" };
                }
                return chunk;
            })
        );
    }

    function handleReject(id: number) {
        setDiffChunks((prev) =>
            prev.map((chunk) => {
                if (chunk.id === id) {
                    return { ...chunk, status: "rejected" };
                }
                return chunk;
            })
        );
    }

    function handleAcceptAll() {
        setDiffChunks(prev => prev.map(chunk => ({ ...chunk, status: "accepted" })));
    }

    function handleRejectAll() {
        setDiffChunks(prev => prev.map(chunk => ({ ...chunk, status: "rejected" })));
    }

    function handleResetAll() {
        setDiffChunks(prev => prev.map(chunk => ({ ...chunk, status: "pending" })));
    }

    // Build the final text based on user decisions
    const finalText = computeFinalText(diffChunks);

    return (
        <div className="font-body">
            <div className="flex gap-2 mb-4">
                <Button variant="secondary" size="sm" onClick={handleAcceptAll}>Accept All</Button>
                <Button variant="secondary" size="sm" onClick={handleRejectAll}>Reject All</Button>
                <Button variant="secondary" size="sm" onClick={handleResetAll}>Reset</Button>
            </div>
            <div className="flex gap-4 items-start">
                <div className="flex-1">
                    <div className="mb-4 border border-faded/30 p-2 whitespace-pre-wrap bg-cream rounded"
                    >
                        {diffChunks.map((chunk) => {
                            // If merged chunk, display oldValue in red strikethrough + newValue in green, with single accept/reject
                            if (chunk.oldValue !== undefined && chunk.newValue !== undefined) {
                                return (
                                    <span key={chunk.id} className="mr-1">
                                        <span className="bg-red-100 text-red-600 line-through">
                                            {chunk.oldValue}
                                        </span>{" "}
                                        <span className="bg-green-100 text-green-600">
                                            {chunk.newValue}
                                        </span>{" "}
                                        <button
                                            onClick={() => handleReject(chunk.id)}
                                            disabled={chunk.status === "rejected"}
                                            className="inline-flex items-center justify-center w-4 h-4 relative -top-0.5 disabled:opacity-30"
                                        >
                                            <CloseCircle twoTone twoToneColor="#c33" />
                                        </button>
                                        <button
                                            onClick={() => handleAccept(chunk.id)}
                                            disabled={chunk.status === "accepted"}
                                            className="inline-flex items-center justify-center w-4 h-4 relative -top-0.5 disabled:opacity-30"
                                        >
                                            <CheckCircle twoTone twoToneColor="#3c3" />
                                        </button>
                                    </span>
                                );
                            }
                            const isChanged = chunk.added || chunk.removed;
                            if (!isChanged) {
                                // Unchanged text -> just return it
                                return <span key={chunk.id}>{chunk.value}</span>;
                            }

                            // For changes, color them accordingly
                            const colorClass = chunk.added
                                ? "bg-green-100 text-green-600"
                                : chunk.removed
                                ? "bg-red-100 text-red-600 line-through"
                                : "";

                            return (
                                <span key={chunk.id} className="mr-1">
                                    <span className={colorClass}>{chunk.value}</span>{" "}
                                    <button
                                        onClick={() => handleReject(chunk.id)}
                                        disabled={chunk.status === "rejected"}
                                        className="inline-flex items-center justify-center w-4 h-4 relative -top-0.5 disabled:opacity-30"
                                    >
                                        <CloseCircle twoTone twoToneColor="#c33" />
                                    </button>
                                    <button
                                        onClick={() => handleAccept(chunk.id)}
                                        disabled={chunk.status === "accepted"}
                                        className="inline-flex items-center justify-center w-4 h-4 relative -top-0.5 disabled:opacity-30"
                                    >
                                        <CheckCircle twoTone twoToneColor="#3c3" />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="min-h-[60px] border border-faded/30 p-2 whitespace-pre-wrap bg-cream rounded">
                        {finalText}
                    </div>
                </div>
            </div>
        </div>
    );
}