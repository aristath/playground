#!/bin/bash
# Upload all files to R2 bucket using wrangler in parallel
# Usage: ./upload-to-r2.sh

BUCKET="altolith-dev"
SOURCE_DIR="/Users/aristath/playground/dist/packages/playground/wasm-wordpress-net"

cd "$SOURCE_DIR"

# Count total files
TOTAL=$(find . -type f | wc -l | tr -d ' ')
echo "Uploading $TOTAL files to $BUCKET..."

# Create upload function for xargs
upload_file() {
    local file="$1"
    local key="${file#./}"
    wrangler r2 object put "$BUCKET/$key" --file "$SOURCE_DIR/$key" --remote 2>/dev/null && echo "✓ $key" || echo "✗ $key"
}
export -f upload_file
export BUCKET SOURCE_DIR

# Upload files using xargs for parallel execution (10 parallel processes)
find . -type f | xargs -P 10 -I {} bash -c 'upload_file "$@"' _ {}

echo "Upload complete!"
