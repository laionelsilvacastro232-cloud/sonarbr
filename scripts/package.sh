#!/usr/bin/env bash
# Empacota o código-fonte do Sonar em dist/sonar-fonte.zip
# Exclui dependências, build, segredos e uploads (regeneráveis/local).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGE="$(mktemp -d)"
NAME="sonar-fonte"
mkdir -p "$STAGE/$NAME" dist

# Pastas/arquivos incluídos
rsync -a \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude 'scripts' \
  --exclude 'storage' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '*.tsbuildinfo' \
  --exclude 'next-env.d.ts' \
  ./ "$STAGE/$NAME/"

# Garante que nenhum segredo vá junto (remoção dupla, por segurança)
find "$STAGE" -name '.env' -delete
find "$STAGE" -name '*.log' -delete

# Gera o ZIP
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGE" && zip -qr "$ROOT/dist/sonar-fonte.zip" "$NAME")
else
  (cd "$STAGE" && tar -czf "$ROOT/dist/sonar-fonte.tar.gz" "$NAME")
fi

rm -rf "$STAGE"
echo "OK: pacote gerado em dist/"
