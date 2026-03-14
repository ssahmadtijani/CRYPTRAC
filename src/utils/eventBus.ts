/**
 * Event Bus for CRYPTRAC
 * Decouples service-level events from the WebSocket layer to prevent circular dependencies.
 */

import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);
