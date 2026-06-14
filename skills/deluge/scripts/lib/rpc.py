#!/usr/bin/env python3
"""
Deluge JSON-RPC client with session management, retry logic, and batch support.
"""

import json
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from typing import Any, Dict, List, Optional


class DelugeRPC:
    def __init__(
        self,
        url: str = "http://10.0.0.100:8112",
        password: str = "",  # must be supplied by caller via env (DELUGE_PASSWORD)
        max_retries: int = 3,
        backoff_factor: float = 1.0,
    ):
        if not password:
            raise ValueError("DelugeRPC: password is required (set DELUGE_PASSWORD env var)")
        self.url = url.rstrip("/")
        if self.url.endswith("/json"):
            self.base_url = self.url
        else:
            self.base_url = f"{self.url}/json"
        self.password = password
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor

        # Cookie jar for session persistence
        self.cookie_jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar)
        )

        self._authenticated = False
        self._session_id: Optional[str] = None

    def _make_request(
        self, method: str, params: List[Any] = None, request_id: int = None
    ) -> Dict[str, Any]:
        """Make a single JSON-RPC request."""
        if params is None:
            params = []

        payload = {
            "method": method,
            "params": params,
            "id": request_id or int(time.time() * 1000),
        }

        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}

        req = urllib.request.Request(
            self.base_url, data=data, headers=headers, method="POST"
        )

        for attempt in range(self.max_retries):
            try:
                with self.opener.open(req, timeout=30) as resp:
                    response_data = resp.read().decode("utf-8")
                    response = json.loads(response_data)

                    # Check for JSON-RPC error
                    if "error" in response and response["error"] is not None:
                        error_msg = response["error"].get("message", "Unknown error")
                        raise RuntimeError(f"Deluge RPC error: {error_msg}")

                    return response

            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504):
                    if attempt < self.max_retries - 1:
                        wait = self.backoff_factor * (2 ** attempt)
                        time.sleep(wait)
                        continue
                raise RuntimeError(f"HTTP error {e.code}: {e.reason}")
            except urllib.error.URLError as e:
                raise RuntimeError(f"Connection error: {e.reason}")
            except json.JSONDecodeError as e:
                raise RuntimeError(f"Invalid JSON response: {e}")

        raise RuntimeError("Max retries exceeded")

    def login(self) -> bool:
        """Authenticate to Deluge daemon."""
        try:
            response = self._make_request("auth.login", [self.password])
            # Deluge returns {"result": true/false, "error": null, "id": ...}
            result = response.get("result", False)
            self._authenticated = result
            return result
        except Exception as e:
            raise RuntimeError(f"Authentication failed: {e}")

    def ensure_auth(self):
        """Ensure we are authenticated."""
        if not self._authenticated:
            self.login()

    def call(self, method: str, params: List[Any] = None) -> Any:
        """Make an RPC call with authentication."""
        self.ensure_auth()
        response = self._make_request(method, params)
        return response.get("result")

    def batch_call(self, calls: List[Dict[str, Any]]) -> List[Any]:
        """
        Execute multiple RPC calls in a single batch request.

        calls: List of dicts with keys: method, params, request_id (optional)
        Returns: List of results in order.
        """
        self.ensure_auth()

        batch_payload = []
        for i, call in enumerate(calls):
            payload = {
                "method": call["method"],
                "params": call.get("params", []),
                "id": call.get("request_id", i),
            }
            batch_payload.append(payload)

        # For batch, we send an array of objects
        data = json.dumps(batch_payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}

        req = urllib.request.Request(
            self.base_url, data=data, headers=headers, method="POST"
        )

        for attempt in range(self.max_retries):
            try:
                with self.opener.open(req, timeout=30) as resp:
                    response_data = resp.read().decode("utf-8")
                    responses = json.loads(response_data)

                    # responses is a list in batch mode
                    results = []
                    for resp_item in responses:
                        if "error" in resp_item and resp_item["error"] is not None:
                            error_msg = resp_item["error"].get("message", "Unknown error")
                            results.append({"__error__": error_msg})
                        else:
                            results.append(resp_item.get("result"))
                    return results

            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504):
                    if attempt < self.max_retries - 1:
                        wait = self.backoff_factor * (2 ** attempt)
                        time.sleep(wait)
                        continue
                raise RuntimeError(f"HTTP error {e.code}: {e.reason}")
            except urllib.error.URLError as e:
                raise RuntimeError(f"Connection error: {e.reason}")
            except json.JSONDecodeError as e:
                raise RuntimeError(f"Invalid JSON response: {e}")

        raise RuntimeError("Max retries exceeded")

    # Convenience methods for common operations

    def get_torrents_status(
        self, filter_dict: Dict[str, Any] = None, keys: List[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Get status for torrents matching filter."""
        if filter_dict is None:
            filter_dict = {}
        if keys is None:
            keys = []
        return self.call("core.get_torrents_status", [filter_dict, keys])

    def get_torrent_status(self, torrent_id: str, keys: List[str] = None) -> Dict[str, Any]:
        """Get status for a single torrent."""
        if keys is None:
            keys = []
        return self.call("core.get_torrent_status", [torrent_id, keys])

    def pause_torrent(self, torrent_ids: List[str]):
        """Pause one or more torrents."""
        self.call("core.pause_torrent", [torrent_ids])

    def resume_torrent(self, torrent_ids: List[str]):
        """Resume one or more torrents."""
        self.call("core.resume_torrent", [torrent_ids])

    def remove_torrent(self, torrent_id: str, remove_data: bool = False):
        """Remove a torrent, optionally keeping data."""
        self.call("core.remove_torrent", [torrent_id, remove_data])

    def get_session_status(self, keys: List[str] = None) -> Dict[str, Any]:
        """Get session statistics."""
        if keys is None:
            keys = []
        return self.call("core.get_session_status", [keys])

    def get_config(self) -> Dict[str, Any]:
        """Get daemon configuration."""
        return self.call("core.get_config")

    def get_labels(self) -> List[str]:
        """Get available labels (if label plugin is enabled)."""
        try:
            return self.call("label.get_labels")
        except Exception:
            return []

    def get_torrent_labels(self, torrent_ids: List[str]) -> Dict[str, List[str]]:
        """Get labels for specific torrents."""
        try:
            return self.call("label.get_torrent_labels", [torrent_ids])
        except Exception:
            return {}
