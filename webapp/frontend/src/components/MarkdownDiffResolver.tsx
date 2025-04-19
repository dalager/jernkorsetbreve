import React, { useState } from "react";
import { diffWords, Change } from "diff";
import { Button } from 'antd';
import { CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";

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
        <div style={{ fontFamily: "sans-serif" }}>
            <div style={{ marginBottom: "1rem" }}>
                <Button type="default" onClick={handleAcceptAll}>Accept All</Button>
                <Button type="default" onClick={handleRejectAll}>Reject All</Button>
                <Button type="default" onClick={handleResetAll}>Reset</Button>
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ flex: "1" }}>
                    <div
                        style={{
                            marginBottom: "1rem",
                            border: "1px solid #ccc",
                            padding: "8px",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {diffChunks.map((chunk) => {
                            // If merged chunk, display oldValue in red strikethrough + newValue in green, with single accept/reject
                            if (chunk.oldValue !== undefined && chunk.newValue !== undefined) {
                                return (
                                    <span key={chunk.id} style={{ marginRight: 4 }}>
                                        <span
                                            style={{
                                                backgroundColor: "#fdd",
                                                color: "red",
                                                textDecoration: "line-through",
                                            }}
                                        >
                                            {chunk.oldValue}
                                        </span>{" "}
                                        <span style={{ backgroundColor: "#dfd", color: "green" }}>
                                            {chunk.newValue}
                                        </span>{" "}
                                        <Button
                                            onClick={() => handleReject(chunk.id)}
                                            disabled={chunk.status === "rejected"}
                                            size="small"
                                            style={{ width: 16, top: -2 }}
                                            type="link"
                                            icon={<CloseCircleTwoTone twoToneColor="#c33" />}
                                        />
                                        <Button
                                            onClick={() => handleAccept(chunk.id)}
                                            type="link"
                                            size="small"
                                            style={{ width: 16, top: -2 }}
                                            disabled={chunk.status === "accepted"}
                                            icon={<CheckCircleTwoTone twoToneColor="#3c3" />}
                                        />

                                    </span>
                                );
                            }
                            const isChanged = chunk.added || chunk.removed;
                            if (!isChanged) {
                                // Unchanged text -> just return it
                                return <span key={chunk.id}>{chunk.value}</span>;
                            }

                            // For changes, color them accordingly
                            let style: React.CSSProperties = {};
                            if (chunk.added) {
                                style = {
                                    backgroundColor: "#dfd",
                                    color: "green",
                                };
                            } else if (chunk.removed) {
                                style = {
                                    backgroundColor: "#fdd",
                                    color: "red",
                                    textDecoration: "line-through",
                                };
                            }

                            return (
                                <span key={chunk.id} style={{ marginRight: 4 }}>
                                    <span style={style}>{chunk.value}</span>{" "}
                                    <Button
                                        onClick={() => handleReject(chunk.id)}
                                        disabled={chunk.status === "rejected"}
                                        size="small"
                                        style={{ width: 16, top: -2 }}
                                        type="link"
                                        icon={<CloseCircleTwoTone twoToneColor="#c33" />}
                                    />
                                    <Button
                                        onClick={() => handleAccept(chunk.id)}
                                        type="link"
                                        size="small"
                                        style={{ width: 16, top: -2 }}
                                        disabled={chunk.status === "accepted"}
                                        icon={<CheckCircleTwoTone twoToneColor="#3c3" />}
                                    />
                                </span>
                            );
                        })}
                    </div>
                </div>
                <div style={{ flex: "1" }}>
                    <div
                        style={{
                            minHeight: "60px",
                            border: "1px solid #ccc",
                            padding: "8px",
                            whiteSpace: "pre-wrap",
                        }}
                    >
                        {finalText}
                    </div>
                </div>
            </div>
        </div>
    );
}