#!/usr/bin/env bash
# Setup llama-server on RunPod (standalone — no Ollama dependency)
# Run this in the RunPod web terminal or via SSH
#
# Template: RunPod PyTorch (any CUDA 12.x image works)
# Why standalone: Ollama has chat template issues with GLM-4.7-Flash.
# llama-server uses the Jinja2 template baked into the GGUF and gives
# better tool-call reliability for agentic workflows.
# Running without Ollama reclaims ~300 MB VRAM and avoids PID 1 fragility.
#
# Pre-reqs: RunPod GPU pod with CUDA 12.x (PyTorch template recommended)
# Port: 8080 (only process — no port conflicts)
#
# Client proxy URL: https://<pod-id>-8080.proxy.runpod.net/v1

set -euo pipefail

LLAMA_SRC="/workspace/llama-src"
LLAMA_BIN="${LLAMA_SRC}/build/bin/llama-server"
LLAMA_TAG="b8184"
MODEL_DIR="/workspace/models"
MODEL_FILE="GLM-4.7-Flash-UD-Q4_K_XL.gguf"
MODEL_URL="https://huggingface.co/unsloth/GLM-4.7-Flash-GGUF/resolve/main/${MODEL_FILE}"
LLAMA_PORT=8080

echo "=== Step 1: Install dependencies ==="
apt-get update -qq
apt-get install -y -qq aria2 libgomp1 cmake 2>/dev/null || true
export PATH="/usr/local/cuda/bin:${PATH}"

echo "=== Step 2: Build llama-server from source ==="
# Build from source to match the pod's exact CUDA version.
# Pre-built binaries (CUDA 12.8 PTX) crash on CUDA 12.4 runtime.
if [ ! -f "$LLAMA_BIN" ]; then
  echo "Cloning llama.cpp ${LLAMA_TAG}..."
  git clone --depth 1 --branch "$LLAMA_TAG" \
    https://github.com/ggml-org/llama.cpp.git "$LLAMA_SRC"
  cd "$LLAMA_SRC"
  # Detect GPU compute capability for optimal build
  GPU_ARCH=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader | head -1 | tr -d '.')
  echo "Building for compute capability ${GPU_ARCH}..."
  cmake -B build \
    -DGGML_CUDA=ON \
    -DCMAKE_CUDA_ARCHITECTURES="${GPU_ARCH}" \
    -DCMAKE_BUILD_TYPE=Release \
    -DLLAMA_CURL=OFF
  cmake --build build --config Release -j"$(nproc)" --target llama-server
  echo "llama-server built at ${LLAMA_BIN}"
else
  echo "llama-server already built"
fi

echo "=== Step 3: Download GLM-4.7-Flash UD-Q4_K_XL GGUF ==="
mkdir -p "$MODEL_DIR"
if [ ! -f "${MODEL_DIR}/${MODEL_FILE}" ]; then
  echo "Downloading ${MODEL_FILE} (~16.3 GB)..."
  aria2c -x 16 -s 16 --file-allocation=none \
    -d "$MODEL_DIR" -o "$MODEL_FILE" "$MODEL_URL"
else
  echo "Model already downloaded"
fi

echo "=== Step 4: Start llama-server ==="
pkill -f "llama-server.*${MODEL_FILE}" 2>/dev/null || true
sleep 1

# Shared libs built alongside llama-server
export LD_LIBRARY_PATH="${LLAMA_SRC}/build/ggml/src:${LLAMA_SRC}/build/src:${LD_LIBRARY_PATH:-}"

# GLM-4.7-Flash optimal params from Unsloth docs:
#   --temp 0.7 --top-p 1.0 --min-p 0.01 --repeat-penalty 1.0
# --jinja: use Jinja2 chat template from GGUF (critical for tool calls)
# --flash-attn on: enable flash attention for extended context
# --ctx-size 8192: fits on 20 GB A4500 with ~2.7 GB headroom
nohup "$LLAMA_BIN" \
  --model "${MODEL_DIR}/${MODEL_FILE}" \
  --port "$LLAMA_PORT" \
  --host 0.0.0.0 \
  --ctx-size 8192 \
  --n-gpu-layers 999 \
  --flash-attn on \
  --jinja \
  --temp 0.7 \
  --top-p 1.0 \
  --min-p 0.01 \
  --repeat-penalty 1.0 \
  > /workspace/llama-server.log 2>&1 &

echo "llama-server started on port ${LLAMA_PORT} (PID: $!)"
echo "Logs: tail -f /workspace/llama-server.log"
echo ""
echo "=== Waiting for model to load ==="
for i in $(seq 1 60); do
  if curl -sf "http://localhost:${LLAMA_PORT}/v1/models" > /dev/null 2>&1; then
    echo "llama-server ready!"
    curl -s "http://localhost:${LLAMA_PORT}/v1/models"
    echo ""
    break
  fi
  echo -n "."
  sleep 5
done
echo ""
echo "Done. Use port ${LLAMA_PORT} in client configs."
echo "Proxy URL: https://<pod-id>-${LLAMA_PORT}.proxy.runpod.net/v1"
echo "The /v1/chat/completions endpoint is OpenAI-compatible."
