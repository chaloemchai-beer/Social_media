"use client"
import { useState } from 'react';

const KafkaPage = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const sendMessage = async () => {
    try {
      const res = await fetch('/api/kafka/produce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      // ตรวจสอบสถานะ HTTP response ก่อนทำการ parse JSON
      if (res.ok) {
        const data = await res.json();
        setResponse(data.message);
      } else {
        const errorData = await res.json();  // ในกรณีที่ response มี JSON ข้อผิดพลาด
        setError(errorData.error || 'Failed to send message.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }
  };

  return (
    <div>
      <h1>Send Message to Kafka</h1>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter message"
      />
      <button onClick={sendMessage}>Send</button>
      {response && <p>{response}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default KafkaPage;
