from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Callable, Dict, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class WSConnection:
    __slots__ = ("websocket", "user_id", "role", "connected_at", "_last_heartbeat")

    def __init__(self, websocket: WebSocket, user_id: str, role: str) -> None:
        self.websocket = websocket
        self.user_id = user_id
        self.role = role
        self.connected_at = time.monotonic()
        self._last_heartbeat = time.monotonic()

    @property
    def alive(self) -> bool:
        return (time.monotonic() - self._last_heartbeat) < 60

    def heartbeat(self) -> None:
        self._last_heartbeat = time.monotonic()


class ConnectionManager:
    def __init__(self) -> None:
        self._by_user: Dict[str, Set[WSConnection]] = {}
        self._by_role: Dict[str, Set[WSConnection]] = {}
        self._all: Set[WSConnection] = set()
        self._lock = asyncio.Lock()

    async def connect(
        self, websocket: WebSocket, user_id: str, role: str
    ) -> WSConnection:
        await websocket.accept()
        conn = WSConnection(websocket, user_id, role)
        async with self._lock:
            self._by_user.setdefault(user_id, set()).add(conn)
            self._by_role.setdefault(role, set()).add(conn)
            self._all.add(conn)
        logger.info("WS connect: user=%s role=%s total=%d", user_id, role, len(self._all))
        return conn

    async def disconnect(self, conn: WSConnection) -> None:
        async with self._lock:
            self._by_user.get(conn.user_id, set()).discard(conn)
            self._by_role.get(conn.role, set()).discard(conn)
            self._all.discard(conn)
            if not self._by_user.get(conn.user_id):
                self._by_user.pop(conn.user_id, None)
        logger.info("WS disconnect: user=%s total=%d", conn.user_id, len(self._all))

    async def send_json(self, conn: WSConnection, data: dict) -> bool:
        try:
            await conn.websocket.send_json(data)
            return True
        except Exception:
            await self.disconnect(conn)
            return False

    async def broadcast(self, data: dict, role: Optional[str] = None) -> int:
        sent = 0
        targets = (
            {c for cs in self._by_role.values() for c in cs}
            if role is None
            else self._by_role.get(role, set()).copy()
        )
        for conn in targets:
            if await self.send_json(conn, data):
                sent += 1
        return sent

    async def broadcast_to_role(self, role: str, data: dict) -> int:
        return await self.broadcast(data, role=role)

    async def send_to_user(self, user_id: str, data: dict) -> int:
        sent = 0
        for conn in self._by_user.get(user_id, set()).copy():
            if await self.send_json(conn, data):
                sent += 1
        return sent

    async def send_to_users(self, user_ids: Set[str], data: dict) -> int:
        sent = 0
        for uid in user_ids:
            sent += await self.send_to_user(uid, data)
        return sent

    async def broadcast_report_update(self, report: dict) -> int:
        return await self.broadcast({
            "type": "report_update",
            "data": report,
            "timestamp": time.time(),
        })

    async def broadcast_emergency(self, emergency: dict) -> int:
        sent = await self.broadcast_to_role("emergency", {
            "type": "emergency_alert",
            "data": emergency,
            "timestamp": time.time(),
        })
        sent += await self.broadcast_to_role("admin", {
            "type": "emergency_alert",
            "data": emergency,
            "timestamp": time.time(),
        })
        return sent

    async def send_notification(self, user_id: str, notification: dict) -> int:
        return await self.send_to_user(user_id, {
            "type": "notification",
            "data": notification,
            "timestamp": time.time(),
        })

    async def user_count(self) -> int:
        async with self._lock:
            return len(self._all)

    async def active_users_by_role(self) -> Dict[str, int]:
        async with self._lock:
            return {role: len(conns) for role, conns in self._by_role.items()}

    async def health_check(self) -> Dict[str, Any]:
        async with self._lock:
            return {
                "total_connections": len(self._all),
                "unique_users": len(self._by_user),
                "by_role": {r: len(c) for r, c in self._by_role.items()},
            }

    async def cleanup_stale(self) -> int:
        removed = 0
        async with self._lock:
            stale = {c for c in self._all if not c.alive}
            for conn in stale:
                self._by_user.get(conn.user_id, set()).discard(conn)
                self._by_role.get(conn.role, set()).discard(conn)
                self._all.discard(conn)
                removed += 1
        if removed:
            logger.info("WS cleanup: removed %d stale connections", removed)
        return removed


manager = ConnectionManager()


async def handle_websocket(websocket: WebSocket) -> None:
    from src.backend.infrastructure.database.supabase_client import get_supabase
    from src.backend.infrastructure.database.repositories.user_repository import SupabaseUserRepository

    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        supabase = get_supabase()
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            await websocket.close(code=4001, reason="Invalid token")
            return
        user_id = user.user.id
        profile = SupabaseUserRepository.find_by_id(user_id)
        role = (profile or {}).get("role", "citizen")
    except Exception:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    conn = await manager.connect(websocket, user_id, role)

    try:
        await conn.websocket.send_json({
            "type": "connected",
            "user_id": user_id,
            "role": role,
        })

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                msg = json.loads(data)
                msg_type = msg.get("type", "")

                if msg_type == "ping":
                    conn.heartbeat()
                    await manager.send_json(conn, {"type": "pong"})

                elif msg_type == "subscribe":
                    channels = msg.get("channels", [])
                    await manager.send_json(conn, {
                        "type": "subscribed",
                        "channels": channels,
                    })

                elif msg_type == "location_update":
                    if role in ("admin", "authority", "emergency"):
                        await manager.broadcast_to_role("emergency", {
                            "type": "location_update",
                            "user_id": user_id,
                            "role": role,
                            "data": msg.get("data", {}),
                        })
                        await manager.broadcast_to_role("admin", {
                            "type": "location_update",
                            "user_id": user_id,
                            "role": role,
                            "data": msg.get("data", {}),
                        })
                    else:
                        await manager.send_json(conn, {
                            "type": "location_update",
                            "user_id": user_id,
                            "data": msg.get("data", {}),
                        })

            except asyncio.TimeoutError:
                try:
                    await manager.send_json(conn, {"type": "ping"})
                except Exception:
                    break

    except (WebSocketDisconnect, Exception) as e:
        logger.debug("WS client disconnected: %s", str(e)[:50])
    finally:
        await manager.disconnect(conn)
