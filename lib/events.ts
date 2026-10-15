import { EventEmitter } from 'events';

// Prevent multiple instances of EventEmitter in development due to HMR
const globalForEvents = globalThis as unknown as {
  eventEmitter: EventEmitter | undefined;
};

export const eventEmitter =
  globalForEvents.eventEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") globalForEvents.eventEmitter = eventEmitter;
