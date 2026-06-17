import type { Server } from "socket.io";

let io: Server | null = null;

export function setSocketServer(server: Server | null) {
  io = server;
}

export function emitToOrder(orderId: string, event: string, payload: unknown) {
  io?.to(`order:${orderId}`).emit(event, payload);
}