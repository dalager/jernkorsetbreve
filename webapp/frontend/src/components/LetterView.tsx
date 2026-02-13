import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button, Card, Col, Flex, Row, Spin, Statistic } from 'antd';
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
        <Card title={letter?.date + ', ' + letter?.place} style={{ maxWidth: '800px', margin: '20px auto' }}>

            <Flex justify="flex-end">
                <Button
                    type="primary"
                    onClick={handlePrevious}
                    disabled={numericId <= 1}
                    style={{ marginRight: '10px' }}
                >
                    Previous
                </Button>
                <Button
                    type="primary"
                    onClick={handleNext}
                    disabled={numericId >= 665}
                    style={{ marginRight: '10px' }}

                >
                    Next
                </Button>
                <Button type="default" disabled={loading} onClick={modernizeLetter}>Modernisér</Button>
            </Flex>

            {loading ? (
                <Spin />
            ) : (
                <>
                    {letter ? (
                        <>
                            <p>
                                <strong>Fra</strong> {letter.sender}
                            </p>
                            <p>
                                <strong>Til</strong> {letter.recipient}
                            </p>
                            <div style={{ whiteSpace: 'pre-wrap' }}>
                                {letterTextFixed ? (
                                    <div>
                                        <MarkdownDiffResolver
                                            originalMd={letter?.text || ''}
                                            correctedMd={letterTextFixed}
                                        />
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Statistic title="LLM Time" value={lastTiming} suffix="ms" />
                                            </Col>
                                            <Col span={12}>
                                                <Statistic title="LLM Perf" value={modernize_tps} precision={2} suffix="TPS" />
                                            </Col>
                                        </Row>


                                    </div>

                                ) : (
                                    <Paragraphs text={letter.text} />
                                )}
                            </div>
                        </>
                    ) : (
                        <p style={{ whiteSpace: 'pre-wrap' }}>Letter not found.</p>
                    )}
                </>
            )}
        </Card>
    );
};

export default LetterView;