"use client"
// components/SearchBooksForm.tsx
import { useState } from 'react';

export default function SearchBooksForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    setResults(data);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Search for books"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
        />
        <button type="submit">Search</button>
      </form>

      <div>
        {results.map((result, index) => (
          <div key={index}>
            <h3>{result._source.title}</h3>
            <p>{result._source.author}</p>
            <p>{result._source.genre}</p>
            <p>{result._source.published_date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
