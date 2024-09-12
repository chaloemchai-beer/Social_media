"use client";

import { useState } from 'react';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const KafkaPage: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string>('');

  const { data: session, status } = useSession(); // Type annotations for session and status
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const sendMessage = async () => {
    try {
      const res = await fetch('/api/kafka/produce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      // Check HTTP response status before parsing JSON
      if (res.ok) {
        const data = await res.json();
        setResponse(data.message);
      } else {
        const errorData = await res.json();  // Handle JSON error response
        setError(errorData.error || 'Failed to send message.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>; // Optional: loading state
  }

  return (
    session?.user && (
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
    )
  );
};

export default KafkaPage;
