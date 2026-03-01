#!/usr/bin/env bash
# Setup llama-server on RunPod (replaces Ollama for GLM-4.7-Flash)
# Run this in the RunPod terminal (web or SSH)
#
# Why: Ollama has chat template compatibility issues with GLM-4.7-Flash.
# llama-server uses the template baked into the GGUF and gives better
# tool-call reliability for agentic workflows.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/vanmarkic/AI-Boilerplate/master/shared/scripts/setup-llama-server.sh | bash
#   # Or paste sections manually

set -euo pipefail

MODEL_DIR="/workspace/models"
MODEL_FILE="GLM-4.7-Flash-UD-Q4_K_XL.gguf"
MODEL_URL="https://huggingface.co/unsloth/GLM-4.7-Flash-GGUF/resolve/main/${MODEL_FILE}"
LLAMA_PORT=11434  # Same port as Ollama so proxy URL stays the same

echo "=== Step 1: Stop Ollama ==="
pkill ollama 2>/dev/null || true
sleep 2

echo "=== Step 2: Install llama.cpp from source ==="
if [ ! -f /usr/local/bin/llama-server ]; then
  apt-get update -qq && apt-get install -y -qq cmake build-essential git
  cd /tmp
  git clone --depth 1 https://github.com/ggml-org/llama.cpp.git
  cd llama.cpp
  cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
  cmake --build build --config Release -j$(nproc) --target llama-server
  cp build/bin/llama-server /usr/local/bin/llama-server
  cd /workspace
  rm -rf /tmp/llama.cpp
  echo "llama-server installed to /usr/local/bin/llama-server"
else
  echo "llama-server already installed"
fi

echo "=== Step 3: Download GLM-4.7-Flash UD-Q4_K_XL GGUF ==="
mkdir -p "$MODEL_DIR"
if [ ! -f "${MODEL_DIR}/${MODEL_FILE}" ]; then
  echo "Downloading ${MODEL_FILE} (~17.5 GB)..."
  wget -q --show-progress -O "${MODEL_DIR}/${MODEL_FILE}" "$MODEL_URL"
else
  echo "Model already downloaded"
fi

echo "=== Step 4: Start llama-server ==="
# GLM-4.7-Flash optimal params from Unsloth docs:
#   --temp 0.7 --top-p 1.0 --min-p 0.01 --repeat-penalty 1.0
# Flash attention + all layers on GPU
nohup llama-server \
  --model "${MODEL_DIR}/${MODEL_FILE}" \
  --port "$LLAMA_PORT" \
  --host 0.0.0.0 \
  --ctx-size 32768 \
  --n-gpu-layers 999 \
  --flash-attn \
  --jinja \
  --temp 0.7 \
  --top-p 1.0 \
  --min-p 0.01 \
  --repeat-penalty 1.0 \
  > /workspace/llama-server.log 2>&1 &

echo "llama-server started on port ${LLAMA_PORT} (PID: $!)"
echo "Logs: tail -f /workspace/llama-server.log"
echo ""
echo "=== Verify ==="
sleep 5
curl -s http://localhost:${LLAMA_PORT}/v1/models | python3 -m json.tool 2>/dev/null || echo "Waiting for model to load..."
echo ""
echo "Done. Client configs (Continue, Aider) need no URL changes."
echo "The /v1/chat/completions endpoint is OpenAI-compatible."
