import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Statistic } from '@/components/ui/statistic';
import MarkdownDiffResolver from './MarkdownDiffResolver';

interface Letter {
    id: number;
    date: string;
    place: string;
    sender: string;
    recipient: string;
    text: string;
}

// Use environment variable or default to /api (which uses Vite proxy in Docker)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const LetterView: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [letter, setLetter] = useState<Letter | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [letterTextFixed, setLetterTextFixed] = useState<string | null>(null);
    const [lastTiming, setLastTiming] = useState<number | null>(0);
    const [modernize_tps, setModernize_tps] = useState<number | null>(0);
    const numericId = parseInt(id || '1', 10);

    useEffect(() => {
        const fetchLetter = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/letters/${numericId}`);
                const data = await response.json();
                setLetter(data);
                setLetterTextFixed(null);
            } catch (error) {
                console.error('Error fetching letter:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLetter();
    }, [numericId]);

    const handlePrevious = () => {
        if (numericId > 1) {
            navigate(`/letters/${numericId - 1}`);
        }
    };

    const handleNext = () => {
        if (numericId < 665) {
            navigate(`/letters/${numericId + 1}`);
        }
    };

    const modernizeLetter = async () => {
        setLoading(true);
        const start = new Date().getTime();
        try {
            const response = await fetch(`${API_BASE_URL}/proofread/${numericId}`, {
                method: 'POST',
            });
            const letterTextFixedData = await response.json();
            setLetterTextFixed(letterTextFixedData.text);
            setModernize_tps(letterTextFixedData.tps);
        } catch (error) {
            console.error('Error modernizing letter:', error);
        }
        setLoading(false);
        const end = new Date().getTime();
        setLastTiming(end - start);

    };

    function Paragraphs({ text }: { text: string }) {
        return (
            <>
                {text
                    .split(/\n{2,}/) // split on one or more occurrences of "\n\n"
                    .map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                    ))
                }
            </>
        );
    };
    return (
        <div className="max-w-3xl mx-auto p-6">
            <Card>
                <CardHeader>
                    <CardTitle>{letter?.date + ', ' + letter?.place}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end gap-2 mb-4">
                        <Button
                            onClick={handlePrevious}
                            disabled={numericId <= 1}
                            variant="secondary"
                        >
                            Previous
                        </Button>
                        <Button
                            onClick={handleNext}
                            disabled={numericId >= 665}
                            variant="secondary"
                        >
                            Next
                        </Button>
                        <Button
                            variant="default"
                            disabled={loading}
                            onClick={modernizeLetter}
                            data-testid="modernize-button"
                        >
                            Modernisér
                        </Button>
                    </div>

                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-64 w-full" />
                        </div>
                    ) : (
                        <>
                            {letter ? (
                                <>
                                    <p className="mb-2 font-body">
                                        <strong className="text-ink-dark">Fra:</strong> <span data-testid="letter-sender">{letter.sender}</span>
                                    </p>
                                    <p className="mb-4 font-body">
                                        <strong className="text-ink-dark">Til:</strong> <span data-testid="letter-recipient">{letter.recipient}</span>
                                    </p>
                                    <div className="whitespace-pre-wrap">
                                        {letterTextFixed ? (
                                            <div>
                                                <MarkdownDiffResolver
                                                    originalMd={letter?.text || ''}
                                                    correctedMd={letterTextFixed}
                                                />
                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                    <Statistic title="LLM Time" value={lastTiming ?? undefined} suffix="ms" />
                                                    <Statistic title="LLM Perf" value={modernize_tps ?? undefined} precision={2} suffix="TPS" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div data-testid="letter-text">
                                                <Paragraphs text={letter.text} />
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <p className="whitespace-pre-wrap text-faded">Letter not found.</p>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LetterView;