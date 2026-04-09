import platform
import subprocess
from typing import Any


def _memory_gb() -> int:
    if platform.system() == "Darwin":
        try:
            mem_bytes = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True).strip())
            return max(1, round(mem_bytes / (1024**3)))
        except Exception:
            return 8
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    mem_kb = int(line.split()[1])
                    return max(1, round(mem_kb / (1024**2)))
    except Exception:
        pass
    return 8


def _cpu_summary() -> str:
    if platform.system() == "Darwin":
        try:
            return subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip()
        except Exception:
            return platform.processor() or "Unknown CPU"
    return platform.processor() or "Unknown CPU"


def _cpu_cores() -> int:
    if platform.system() == "Darwin":
        try:
            return int(subprocess.check_output(["sysctl", "-n", "hw.ncpu"], text=True).strip())
        except Exception:
            return 4
    return 4


def recommend_models() -> dict[str, Any]:
    memory_gb = _memory_gb()
    cpu = _cpu_summary()
    cores = _cpu_cores()

    if memory_gb >= 32:
        chat_model = "qwen2.5:14b"
        code_model = "qwen2.5-coder:14b"
        tier = "high"
    elif memory_gb >= 16:
        chat_model = "qwen2.5:7b"
        code_model = "qwen2.5-coder:7b"
        tier = "balanced"
    else:
        chat_model = "qwen2.5:3b"
        code_model = "qwen2.5-coder:3b"
        tier = "light"

    return {
        "system": {
            "memoryGb": memory_gb,
            "cpu": cpu,
            "cores": cores,
        },
        "tier": tier,
        "modes": {
            "chat": {
                "id": chat_model,
                "label": "Chat",
                "agentic": True,
                "webAccess": True,
                "tools": True,
            },
            "code": {
                "id": code_model,
                "label": "Code",
                "agentic": True,
                "webAccess": True,
                "tools": True,
            },
        },
    }
