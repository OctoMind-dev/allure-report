#!/bin/bash

# Example batch usage script for Octomind to Allure Converter

# Set your Octomind API credentials
export OCTOMIND_API_KEY="<your-octomind-api-key>"
export TEST_TARGET_ID="<your-test-target-id>"
export ENVIRONMENT_ID="<your-environment-id>"

# Output directory for Allure results
OUTPUT_DIR="./allure-results-batch"

echo "=========================================="
echo "Octomind to Allure Converter - Batch Mode"
echo "=========================================="
echo ""

# Step 1: Install dependencies
echo "Step 1: Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Step 2: Build the project
echo "Step 2: Building TypeScript..."
npm run build
echo "✓ Build complete"
echo ""

# Example 1: Convert all test reports
echo "Example 1: Converting ALL test reports..."
echo "=========================================="
ts-node src/converter.ts \
  --api-key "$OCTOMIND_API_KEY" \
  --test-target-id "$TEST_TARGET_ID" \
  --environment-id "$ENVIRONMENT_ID" \
  --batch \
  --max-reports 10 \
  --debug \
  --output-dir "$OUTPUT_DIR/all-reports"
echo ""
echo "✓ All reports converted"
echo "" 

# Example 2: Convert last 10 test reports
echo "Example 2: Converting last 10 test reports..."
echo "=========================================="
ts-node src/converter.ts \
  --api-key "$OCTOMIND_API_KEY" \
  --test-target-id "$TEST_TARGET_ID" \
  --batch \
  --max-reports 10 \
  --debug \
  --output-dir "$OUTPUT_DIR/last-10-reports"
echo ""
echo "✓ Last 10 reports converted"
echo ""

# Example 3: Convert reports for specific environment
echo "Example 3: Converting reports last 20 for specific environment..."
echo "=========================================="
ts-node src/converter.ts \
  --api-key "$OCTOMIND_API_KEY" \
  --test-target-id "$TEST_TARGET_ID" \
  --batch \
  --environment-id "$ENVIRONMENT_ID" \
  --max-reports 20 \
  --debug \
  --output-dir "$OUTPUT_DIR/staging-env"
echo ""
echo "✓ Environment-specific reports converted"
echo ""

# Example 4: Combine filters - last 20 reports from specific environment
echo "Example 4: Last 20 reports from specific environment..."
echo "=========================================="
ts-node src/converter.ts \
  --api-key "$OCTOMIND_API_KEY" \
  --test-target-id "$TEST_TARGET_ID" \
  --batch \
  --environment-id "$ENVIRONMENT_ID" \
  --max-reports 20 \
  --output-dir "$OUTPUT_DIR/staging-last-20"
echo ""
echo "✓ Filtered reports converted"
echo ""

# Step 5: Generate Allure reports
echo "Step 5: Generating Allure HTML reports..."
if command -v allure &> /dev/null; then
    echo "Generating report for all reports..."
    allure generate "$OUTPUT_DIR/all-reports" -o "$OUTPUT_DIR/all-reports-html" --clean
    
    echo "Generating report for last 10 reports..."
    allure generate "$OUTPUT_DIR/last-10-reports" -o "$OUTPUT_DIR/last-10-reports-html" --clean
    
    echo "Generating report for staging environment..."
    allure generate "$OUTPUT_DIR/staging-env" -o "$OUTPUT_DIR/staging-env-html" --clean
    
    echo "✓ All Allure reports generated"
    echo ""
    echo "View reports with:"
    echo "  allure open $OUTPUT_DIR/all-reports-html"
    echo "  allure open $OUTPUT_DIR/last-10-reports-html"
    echo "  allure open $OUTPUT_DIR/staging-env-html"
else
    echo "⚠ Allure CLI not found. Install it with:"
    echo "  npm install -g allure-commandline"
fi

echo ""
echo "=========================================="
echo "Batch Conversion Complete!"
echo "=========================================="
echo ""
echo "Output directories:"
echo "  All reports:       $OUTPUT_DIR/all-reports"
echo "  Last 10 reports:   $OUTPUT_DIR/last-10-reports"
echo "  Staging env:       $OUTPUT_DIR/staging-env"
echo "  Staging last 20:   $OUTPUT_DIR/staging-last-20"
echo ""
echo "Statistics:"
for dir in "$OUTPUT_DIR"/*; do
    if [ -d "$dir" ] && [[ ! "$dir" =~ -html$ ]]; then
        result_count=$(find "$dir" -name "*-result.json" | wc -l)
        container_count=$(find "$dir" -name "*-container.json" | wc -l)
        echo "  $(basename "$dir"): $result_count test results, $container_count containers"
    fi
done