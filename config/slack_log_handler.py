import json
import logging
import threading
import urllib.request
import urllib.error
import os


class SlackLogHandler(logging.Handler):
    """Slack chat.postMessage API を使ってログを送信するハンドラ"""

    COLORS = {
        logging.CRITICAL: '#dc3545',
        logging.ERROR: '#dc3545',
        logging.WARNING: '#ffc107',
        logging.INFO: '#28a745',
        logging.DEBUG: '#6c757d',
    }

    def __init__(self, channel, token=None, **kwargs):
        super().__init__(**kwargs)
        self.channel = channel
        self.token = token or os.environ.get('SLACK_BOT_TOKEN', '')

    def emit(self, record):
        if not self.token:
            return

        try:
            msg = self.format(record)
            thread = threading.Thread(
                target=self._send, args=(msg, record.levelno), daemon=True
            )
            thread.start()
        except Exception:
            self.handleError(record)

    def _send(self, message, levelno):
        color = self.COLORS.get(levelno, '#6c757d')
        payload = json.dumps({
            'channel': self.channel,
            'attachments': [{
                'color': color,
                'text': message,
                'fallback': message,
            }],
        }).encode('utf-8')

        req = urllib.request.Request(
            'https://slack.com/api/chat.postMessage',
            data=payload,
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': f'Bearer {self.token}',
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                body = json.loads(resp.read().decode('utf-8'))
                if not body.get('ok'):
                    print(f'[SlackLogHandler] API error: {body.get("error")}')
        except (urllib.error.URLError, OSError) as e:
            print(f'[SlackLogHandler] Send failed: {e}')
