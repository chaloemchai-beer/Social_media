import { NextRequest, NextResponse } from 'next/server';
import { Kafka, Partitioners } from 'kafkajs';
import { PrismaClient } from '@prisma/client';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'nextjs-client',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    await producer.connect();
    const { message } = await req.json();

    await producer.send({
      topic: 'test-topic',
      messages: [{ value: message || 'Hello from Next.js API' }],
    });

    await producer.disconnect();

    // Save the message to the PostgreSQL database
    await prisma.message.create({
      data: {
        message: message || 'Default message',
      },
    });

    return NextResponse.json({ success: true, message: 'Message sent to Kafka and saved in PostgreSQL!' });
  } catch (error) {
    // Assert the error type to Error so that TypeScript can recognize error.message
    const errorMessage = (error as Error).message || 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to send message', details: errorMessage },
      { status: 500 }
    );
  }
}
