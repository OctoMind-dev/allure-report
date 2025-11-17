# Octomind to Allure Converter

A TypeScript utility to convert Octomind test reports into Allure Report format.

## Features

- **Single Report Mode**: Convert one test report by ID
- **Batch Mode**: Convert multiple test reports using keyset pagination
- **Environment Filtering**: Filter reports by environment in batch mode
- **Report Limiting**: Limit number of reports in batch mode
- Converts Octomind test reports to Allure test result files
- Creates Allure container files for test grouping
- Maps test case tags to Allure labels
- Includes deeplinks to Octomind app
- Preserves breakpoint and browser type information
- Links Playwright trace files
- Converts test steps with timing information
- Handles test status mapping (PASSED, FAILED, BROKEN, SKIPPED)

## Installation

```bash
npm install
npm run build
```

## Usage

### Single Report Mode

Convert a single test report by ID:

```bash
ts-node src/converter.ts \
  --api-key <your-octomind-api-key> \
  --test-target-id <test-target-uuid> \
  --test-report-id <test-report-uuid> \
  --output-dir ./allure-results
```

### Batch Mode

Convert multiple test reports using pagination:

```bash
# Convert all test reports
ts-node src/converter.ts \
  --api-key <your-octomind-api-key> \
  --test-target-id <test-target-uuid> \
  --batch \
  --output-dir ./allure-results

# Convert limited number of reports
ts-node src/converter.ts \
  --api-key <your-octomind-api-key> \
  --test-target-id <test-target-uuid> \
  --batch \
  --max-reports 10 \
  --output-dir ./allure-results

# Filter by environment
ts-node src/converter.ts \
  --api-key <your-octomind-api-key> \
  --test-target-id <test-target-uuid> \
  --batch \
  --environment-id <environment-uuid> \
  --output-dir ./allure-results
```

### Batch Mode History

Batch Mode will actually call allure generate and enable "history mode" by copying the history files from the previous run to the new run.

Results will then look like this:

![Allure History](allure-report-history.png)

### Example

Single report:
```bash
ts-node src/converter.ts \
  --api-key om_1234567890abcdef \
  --test-target-id e6bfc622-acb2-4305-8b4a-c6a079b292d6 \
  --test-report-id 9ae238fd-b4d3-4a8d-920e-93b0d26fc7cb \
  --output-dir ./allure-results
```

Batch mode (last 50 reports):
```bash
ts-node src/converter.ts \
  --api-key om_1234567890abcdef \
  --test-target-id e6bfc622-acb2-4305-8b4a-c6a079b292d6 \
  --batch \
  --max-reports 50 \
  --output-dir ./allure-results
```

### Command Line Options

| Option | Short | Description | Required |
|--------|-------|-------------|----------|
| `--api-key` | `-k` | Your Octomind API key | Yes |
| `--test-target-id` | `-t` | UUID of the test target | Yes |
| `--test-report-id` | `-r` | UUID of the test report (single mode) | Conditional* |
| `--batch` | `-b` | Enable batch mode for multiple reports | No |
| `--max-reports` | `-m` | Max reports in batch mode | No |
| `--environment-id` | `-e` | Filter by environment in batch mode | No |
| `--output-dir` | `-o` | Output directory for Allure files | No (default: `./allure-results`) |
| `--help` | `-h` | Show help message | No |

\* Required in single report mode, must NOT be specified in batch mode

## Generated Files

The converter creates the following files in the output directory:

- `{uuid}-result.json` - One file per test case containing:
  - Test metadata (name, description)
  - Test status and timing
  - Test steps with individual status
  - Links to Octomind app and Playwright traces
  - Labels for tags, breakpoint, and browser type
  
- `{uuid}-container.json` - One file per test report containing:
  - Container metadata
  - References to all test results (children)
  - Report-level timing information

## Allure Labels Added

The converter automatically adds the following labels to test results:

### Standard Labels
- `host`: Set to "octomind"
- `language`: Set to "typescript"
- `framework`: Set to "playwright"
- `testClass`: Test target ID
- `testMethod`: Test case ID
- `suite`: Test case name

### Custom Labels
- `breakpoint`: From test report breakpoint field
- `browser`: From test report browserType field
- `tag`: Each tag from the Octomind test case (can have multiple)

## Links Added

Each test result includes the following links:

1. **View in Octomind** - Direct link to the test report in Octomind app:
   ```
   https://app.octomind.dev/testtargets/{testTargetId}/testreports/{testReportId}
   ```

2. **Playwright Trace** - Link to the trace file (if available)

3. **TMS Link** - Link to external test management system (if externalId is set)

## Mapping Details

### Status Mapping

| Octomind Status | Allure Status |
|----------------|---------------|
| PASSED | passed |
| FAILED | failed |
| BROKEN | broken |
| SKIPPED | skipped |
| Other | unknown |

### Test Steps

Test steps from Octomind are converted with:
- Step name
- Status (passed/failed/skipped)
- Timing information (start/stop timestamps)
- Error messages (if step failed)

## Viewing the Report

After conversion, generate and view the Allure report:

```bash
# Generate the HTML report
allure generate ./allure-results -o ./allure-report --clean

# Open the report in a browser
allure open ./allure-report
```

Or use the serve command for quick viewing:

```bash
allure serve ./allure-results
```

## Project Structure

```
.
├── src/
│   └── converter.ts       # Main converter implementation
├── package.json
├── tsconfig.json
└── README.md
```

## API Integration

The converter uses the Octomind API to fetch:
- Test targets (app name and configuration)
- Test reports (paginated with keyset pagination)
- Individual test case details (name, description, tags)

API endpoints used:
- `GET /api/apiKey/v2/test-targets/{testTargetId}`
- `GET /api/apiKey/v2/test-targets/{testTargetId}/test-reports` (paginated)
- `GET /api/apiKey/v2/test-targets/{testTargetId}/test-reports/{testReportId}`
- `GET /api/apiKey/v2/test-targets/{testTargetId}/test-cases/{testCaseId}`

### Pagination

The batch mode uses keyset pagination to efficiently fetch all test reports:
- Fetches reports in pages of 20
- Uses `key[createdAt]` for cursor-based pagination
- Continues until all reports are fetched or `maxReports` is reached
- Supports filtering by `ENVIRONMENT_ID`

## Development

### Build

```bash
npm run build
```

### Run in Development

```bash
npm run start -- --api-key <key> --test-target-id <id> --test-report-id <id>
```

### Format Code

```bash
npm run format
```

### Lint Code

```bash
npm run lint
```

## Error Handling

The converter handles various error scenarios:

- **API errors**: Failed API requests are logged with details
- **Missing test cases**: If test case details can't be fetched, uses test case ID as fallback
- **Missing data**: Gracefully handles missing optional fields
- **Invalid arguments**: Validates required CLI arguments

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.3.0
- Valid Octomind API key

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues related to:
- Octomind API: Visit [Octomind Docs](https://octomind.dev/docs)
- Allure Report: Visit [Allure Docs](https://allurereport.org/docs)
- This converter: Open an issue on the repository