import React, { useEffect, useState } from 'react';
import { Table } from "antd";
import { useNavigate } from 'react-router';

interface Letter {
    id: number;
    date: string;
    place: string;
    sender: string;
    recipient: string;
}

const LetterList: React.FC = () => {
    const [letters, setLetters] = useState<Letter[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchLetters = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/letters');
                const data = await response.json();
                setLetters(data);
            } catch (error) {
                console.error('Error fetching letters:', error);
            }
        };

        fetchLetters();
    }, []);

    const columns = [
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: (text: string, record: Letter) => (
                <a onClick={() => navigate(`/letters/${record.id}`)}>
                    {text}
                </a>
            ),
        },
        {
            title: 'Place',
            dataIndex: 'place',
            key: 'place',
        },
        {
            title: 'Sender',
            dataIndex: 'sender',
            key: 'sender',
        },
        {
            title: 'Recipient',
            dataIndex: 'recipient',
            key: 'recipient',
        }
    ];

    return (
        <div>
            <h1>Letters</h1>
            <Table rowKey="id" dataSource={letters} columns={columns} />
        </div>
    );
};

export default LetterList;