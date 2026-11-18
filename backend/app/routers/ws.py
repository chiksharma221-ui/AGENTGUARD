"""WebSocket Real-Time Notifications for Human Approvers."""

import json
import logging
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from app.core.security import decode_token
from app.database import SessionLocal
from app.models.user import User

logger = logging.getLogger("agentguard.ws")

router = APIRouter(tags=["WebSockets"])


class ConnectionManager:
    """Manages active WebSocket connections from dashboard approvers and admins."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept inbound socket and register into active pool."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connected. Active sockets: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove disconnected socket from tracking pool."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket disconnected. Remaining sockets: %d", len(self.active_connections))

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Dispatch real-time event JSON to all connected clients."""
        payload = json.dumps(message, default=str)
        dead_connections: list[WebSocket] = []

        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as exc:
                logger.warning("Failed to send message over socket: %s", exc)
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


# Global connection manager instance
ws_manager = ConnectionManager()


@router.websocket("/ws/approvals")
async def approvals_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT bearer access token for authentication"),
) -> None:
    """Real-time push channel notifying approvers of incoming and resolved requests."""
    # Authenticate token from query string
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == UUID(user_id), User.is_active == True).first()
            if not user:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        finally:
            db.close()

    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws_manager.connect(websocket)

    try:
        while True:
            # Keep-alive loop listening for client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.error("WebSocket encountered unexpected error: %s", exc)
        ws_manager.disconnect(websocket)
