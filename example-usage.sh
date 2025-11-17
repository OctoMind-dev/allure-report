#!/bin/bash

# Example usage script for Octomind to Allure Converter

# Set your Octomind API credentials
export OCTOMIND_API_KEY="<your-octomind-api-key>"
export TEST_TARGET_ID="<your-test-target-id>"
export ENVIRONMENT_ID="<your-environment-id>"

# Output directory for Allure results
OUTPUT_DIR="./allure-results"
mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "Octomind to Allure Converter"
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

# Step 3: Run the converter
echo "Step 3: Converting Octomind report to Allure format..."
ts-node src/converter.ts \
  --api-key "$OCTOMIND_API_KEY" \
  --test-target-id "$TEST_TARGET_ID" \
  --test-report-id "$TEST_REPORT_ID" \
  --output-dir "$OUTPUT_DIR"
echo "✓ Conversion complete"
echo ""

# Step 4: List generated files
echo "Step 4: Generated files:"
ls -lh "$OUTPUT_DIR"
echo ""

# Step 5: Validate Allure format
echo "Step 5: Validating Allure format..."
if command -v allure &> /dev/null; then
    echo "Allure CLI found, generating report..."
    allure generate "$OUTPUT_DIR" -o ./allure-report --clean
    echo "✓ Allure report generated"
    echo ""
    echo "To view the report, run:"
    echo "  allure open ./allure-report"
else
    echo "⚠ Allure CLI not found. Install it with:"
    echo "  npm install -g allure-commandline"
    echo ""
    echo "After installation, generate the report with:"
    echo "  allure generate $OUTPUT_DIR -o ./allure-report --clean"
    echo "  allure open ./allure-report"
fi

echo ""
echo "=========================================="
echo "Conversion Complete!"
echo "=========================================="
echo ""
echo "Output directory: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Review the JSON files in $OUTPUT_DIR"
echo "2. Generate Allure report: allure generate $OUTPUT_DIR"
echo "3. View report: allure open ./allure-report"