import { NodeSDK } from '@opentelemetry/sdk-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import net from 'net';

// Array to store logs
const apiLogs = [];

function sendLog(log) {
    const client = new net.Socket();
    client.connect(5000, 'localhost', () => {
        client.write(JSON.stringify(log) + '\n');
        client.end();
        console.log(`Log sent to Logstash:`.bgWhite.bold, log);
    });
    client.on('error', (err) => console.error('Logstash connection error:', err));
}

// Modify CapturingSpanProcessor to send logs
class CapturingSpanProcessor extends SimpleSpanProcessor {
    onEnd(span) {
        const attributes = span.attributes || {};
        const logEntry = {
            method: attributes['http.method'],
            url: attributes['http.url'],
            statusCode: attributes['http.status_code'],
            timestamp: new Date().toISOString(),
        };
        if (logEntry.method) {
            apiLogs.push(logEntry);
            console.log(`Captured API Log: ${JSON.stringify(logEntry)}`.bgYellow.bold);
            sendLog(logEntry); // Send to Logstash
        }
    }
}


// Create OpenTelemetry SDK with custom processor
const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  spanProcessor: new CapturingSpanProcessor(new ConsoleSpanExporter()),
  instrumentations: [getNodeAutoInstrumentations()],
});

// Start the SDK
sdk.start();

// Add shutdown hook to stop the SDK when the process exits
process.on('exit', () => {
  sdk.shutdown();
});

// Add error handler to catch any errors during shutdown
process.on('uncaughtException', (err) => {
  console.error('Error shutting down SDK:', err);
  sdk.shutdown();
});

// Add signal handler to catch SIGINT and SIGTERM signals
process.on('SIGINT', () => {
  sdk.shutdown();
});

process.on('SIGTERM', () => {
  sdk.shutdown();
});

export { apiLogs };