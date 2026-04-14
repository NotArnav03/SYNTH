"""Test config — set dummy API key before any SYNTH module imports."""
import os

os.environ.setdefault("ANTHROPIC_API_KEY", "test-dummy-key")
os.environ.setdefault("CIRCLE_API_KEY", "test-dummy-key")
os.environ.setdefault("ROUTER_WALLET", "arc:0xtest_router_wallet")
