import { EventEmitter } from "events";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { mcxLogger } from "../utils/logger";

export enum MCXEventType {
  PRICE_TICK = "PRICE_TICK",
  CANDLE_CLOSED = "CANDLE_CLOSED",
  SIGNAL_GENERATED = "SIGNAL_GENERATED",
  POSITION_OPENED = "POSITION_OPENED",
  POSITION_CLOSED = "POSITION_CLOSED",
  SL_HIT = "SL_HIT",
  TP_HIT = "TP_HIT",
  WALLET_UPDATED = "WALLET_UPDATED",
  PRICE_MISMATCH = "PRICE_MISMATCH",
  CONTRACT_MISMATCH = "CONTRACT_MISMATCH",
  SL_TRIGGERED = "SL_TRIGGERED",
  TP_TRIGGERED = "TP_TRIGGERED",
  TRADING_HALTED = "TRADING_HALTED",
}

type Payload = Record<string, unknown>;

class EventBus extends EventEmitter {
  publish(type: MCXEventType, payload: Payload): boolean {
    mcxLogger.info(type, payload);
    void prisma.mcxEventLog.create({ data: { type, payload: payload as Prisma.InputJsonValue } }).catch((error: Error) => {
      mcxLogger.warn("EVENT_LOG_WRITE_FAILED", { type, error: error.message });
    });
    return super.emit(type, payload);
  }
}

const globalForEvents = global as unknown as { mcxEventBus?: EventBus };
export const MCXEventBus = globalForEvents.mcxEventBus || new EventBus();
MCXEventBus.setMaxListeners(100);
globalForEvents.mcxEventBus = MCXEventBus;
