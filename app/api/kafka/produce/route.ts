import { NextRequest, NextResponse } from 'next/server';
import { Kafka, Partitioners } from 'kafkajs';
import { PrismaClient } from '@prisma/client';

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'nextjs-client',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
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

    // บันทึกข้อความลงในฐานข้อมูล PostgreSQL
    await prisma.message.create({
      data: {
        message: message || 'Default message',
      },
    });

    return NextResponse.json({ success: true, message: 'Message sent to Kafka and saved in PostgreSQL!' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    );
  }
}
