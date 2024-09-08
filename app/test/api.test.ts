import { createMocks } from 'node-mocks-http';
import { POST } from '../api/kafka/produce/route'; // ใช้ named export
import { describe, it, expect } from 'vitest';

describe('POST /api/kafka/produce', () => {
  it('should respond with success message', async () => {
    const promises = [];

    for (let i = 0; i < 100; i++) {
      const { req, res } = createMocks({
        method: 'POST',
        body: { message: 'Test message' }
      });

      promises.push(
        POST(req, res).then(() => { // ใช้ named export
          expect(res._getStatusCode()).toBe(200);
          const responseData = JSON.parse(res._getData());
          expect(responseData.message).toBe('Message sent to Kafka!');
        })
      );
    }

    await Promise.all(promises);
  });
});
