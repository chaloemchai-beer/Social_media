// pages/api/search.ts or app/api/search/route.ts
import { NextResponse } from 'next/server';
import client from '../../../services/search/elasticsearch';

export async function POST(request: Request) {
    try {
      // Parse the JSON data from the request body
      const { query } = await request.json();
  
      // Perform the search query in Elasticsearch
      const response = await client.search({
        index: 'books', // Name of the Elasticsearch index
        query: {
          multi_match: {
            query,
            fields: ['title^3', 'author', 'genre'], // Search in these fields, boosting 'title'
          },
        },
      });
  
      // Return the search results
      return NextResponse.json(response.hits.hits);
    } catch (error) {
      console.error('Elasticsearch search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }