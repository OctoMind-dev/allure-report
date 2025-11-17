#!/usr/bin/env node

/**
 * Octomind to Allure Report Converter
 * 
 * Converts Octomind test reports to Allure Report format
 * Usage: ts-node converter.ts --api-key <key> --test-target-id <id> --test-report-id <id> [--output-dir <dir>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { execFileSync } from 'child_process';

// ============================================================================
// Type Definitions - Octomind API Types
// ============================================================================

interface OctomindTestReport {
  id: string;
  testTargetId: string;
  status: 'PASSED' | 'FAILED' | 'RUNNING' | 'SKIPPED' | 'BROKEN';
  executionUrl: string;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  breakpoint?: string;
  browserType?: string;
  testResults: OctomindTestResult[];
}

interface OctomindTestResult {
  id: string;
  testTargetId: string;
  testCaseId: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'BROKEN';
  traceUrl?: string;
  error?: string;
  stackTrace?: string;
  duration?: number;
  createdAt?: string;
  updatedAt?: string;
  steps?: OctomindTestStep[];
}

interface OctomindTestStep {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration?: number;
  error?: string;
}

interface OctomindTestCaseTag {
  id: string;
  type: string;
  value: string;
  environmentId: string;
  testTargetId: string;
}

interface OctomindTestCase {
  id: string;
  name: string;
  description?: string;
  tags?: Array<OctomindTestCaseTag>;
  externalId?: string;
}

interface OctomindTestTarget {
  id: string;
  app: string;
  tags?: Array<OctomindTestCaseTag>;
  environments?: Array<{
    id: string;
    type: string;
    discoveryUrl: string;
    email?: string;
  }>;
}

interface OctomindTestReportsPage {
  data: OctomindTestReport[];
  key: {
    createdAt: string;
  };
  hasNextPage: boolean;
}

interface TestReportFilter {
  key: 'environmentId';
  value: {
    operator: 'equals';
    value: string;
  };
}

interface TestReportFilters {
  filters: TestReportFilter[];
}

// ============================================================================
// Type Definitions - Allure Report Types
// ============================================================================

interface AllureTestResult {
  uuid: string;
  historyId: string;
  testCaseId?: string;
  fullName: string;
  name: string;
  description?: string;
  links: AllureLink[];
  labels: AllureLabel[];
  status: AllureStatus;
  statusDetails?: AllureStatusDetails;
  stage: AllureStage;
  start: number;
  stop: number;
  steps?: AllureStep[];
  attachments?: AllureAttachment[];
  parameters?: AllureParameter[];
}

interface AllureContainer {
  uuid: string;
  name: string;
  start: number;
  stop: number;
  children: string[];
  befores?: AllureStep[];
  afters?: AllureStep[];
}

interface AllureLink {
  type: string;
  name: string;
  url: string;
}

interface AllureLabel {
  name: string;
  value: string;
}

interface AllureStep {
  name: string;
  status: AllureStatus;
  statusDetails?: AllureStatusDetails;
  stage: AllureStage;
  start: number;
  stop: number;
  steps?: AllureStep[];
  attachments?: AllureAttachment[];
  parameters?: AllureParameter[];
}

interface AllureStatusDetails {
  known?: boolean;
  muted?: boolean;
  flaky?: boolean;
  message?: string;
  trace?: string;
}

interface AllureAttachment {
  name: string;
  source: string;
  type: string;
}

interface AllureParameter {
  name: string;
  value: string;
  excluded?: boolean;
  mode?: 'default' | 'masked' | 'hidden';
}

type AllureStatus = 'passed' | 'failed' | 'broken' | 'skipped' | 'unknown';
type AllureStage = 'scheduled' | 'running' | 'finished' | 'pending' | 'interrupted';

// ============================================================================
// Converter Class
// ============================================================================

class OctomindToAllureConverter {
  private apiKey: string;
  private apiBaseUrl: string;
  private testCaseCache: Map<string, OctomindTestCase>;

  constructor(apiKey: string, apiBaseUrl: string = 'https://app.octomind.dev/api') {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
    this.testCaseCache = new Map();
  }

  /**
   * Fetch test report from Octomind API
   */
  async fetchTestReport(testTargetId: string, testReportId: string): Promise<OctomindTestReport> {
    const url = `${this.apiBaseUrl}/apiKey/v2/test-targets/${testTargetId}/test-reports/${testReportId}`;
    
    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch test report: ${response.status} ${response.statusText}`);
    }

    return await response.json() as OctomindTestReport;
  }

  /**
   * Fetch test target details from Octomind API
   */
  async fetchTestTarget(testTargetId: string): Promise<OctomindTestTarget> {
    const url = `${this.apiBaseUrl}/apiKey/v2/test-targets/${testTargetId}`;
    
    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch test target: ${response.status} ${response.statusText}`);
    }

    return await response.json() as OctomindTestTarget;
  }

  /**
   * Fetch paginated test reports from Octomind API
   */
  async fetchTestReports(
    testTargetId: string,
    options?: {
      keyCreatedAt?: string;
      filters?: TestReportFilter[];
      debug?: boolean;
    }
  ): Promise<OctomindTestReportsPage> {
    const params = new URLSearchParams();
    
    // Note: There is no limit parameter for this API
    // The API returns a fixed page size
    
    if (options?.keyCreatedAt) {
      // The key must be JSON-stringified and URL-encoded
      const keyObject = { createdAt: options.keyCreatedAt };
      const keyString = JSON.stringify(keyObject);
      params.append('key', keyString);
    }
    
    if (options?.filters && options.filters.length > 0) {
      // The filters must be JSON-stringified and URL-encoded as an array
      const filtersObject = options.filters;
      const filtersString = JSON.stringify(filtersObject);
      params.append('filters', filtersString);
    }
    
    const url = `${this.apiBaseUrl}/apiKey/v2/test-targets/${testTargetId}/test-reports?${params.toString()}`;
    
    if (options?.debug) {
      console.log('  API Request URL:', url);
      if (options?.keyCreatedAt) {
        console.log('  Key object:', { createdAt: options.keyCreatedAt });
      }
      if (options?.filters) {
        console.log('  Filters object:', JSON.stringify(options.filters));
      }
    }
    
    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch test reports: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as OctomindTestReportsPage;
    
    if (options?.debug) {
      console.log('  API Response:', {
        dataCount: result.data.length,
        hasNextPage: result.hasNextPage,
        keyCursor: result.key?.createdAt,
        firstReportId: result.data[0]?.id,
        firstReportCreatedAt: result.data[0]?.createdAt,
        lastReportId: result.data[result.data.length - 1]?.id,
        lastReportCreatedAt: result.data[result.data.length - 1]?.createdAt,
      });
    }

    return result;
  }

  /**
   * Fetch all test reports using pagination
   */
  async fetchAllTestReports(
    testTargetId: string,
    options?: {
      maxReports?: number;
      filters?: TestReportFilter[];
      debug?: boolean;
    }
  ): Promise<OctomindTestReport[]> {
    const allReports: OctomindTestReport[] = [];
    let hasNextPage = true;
    let keyCreatedAt: string | undefined;
    const maxReports = options?.maxReports || Infinity;
    const seenIds = new Set<string>(); // Track seen report IDs to avoid duplicates

    console.log('Fetching test reports...');
    
    while (hasNextPage && allReports.length < maxReports) {
      const page = await this.fetchTestReports(testTargetId, {
        keyCreatedAt,
        filters: options?.filters,
        debug: options?.debug,
      });

      // Filter out any reports we've already seen (shouldn't happen with proper keyset pagination, but safety check)
      const newReports = page.data.filter(report => !seenIds.has(report.id));
      
      if (newReports.length === 0 && page.data.length > 0) {
        // All reports in this page were duplicates - pagination is broken
        console.warn('  Warning: Received duplicate reports, stopping pagination');
        break;
      }

      // Add new reports
      newReports.forEach(report => {
        seenIds.add(report.id);
        allReports.push(report);
      });

      console.log(`  Fetched ${newReports.length} new reports (total: ${allReports.length}, page had: ${page.data.length})`);

      hasNextPage = page.hasNextPage;
      
      if (hasNextPage && page.key?.createdAt) {
        // Use the key from the response as cursor for next page
        keyCreatedAt = page.key.createdAt;
        if (options?.debug) {
          console.log(`  Next cursor: ${keyCreatedAt}`);
        }
      }

      // Stop if we've reached the max
      if (allReports.length >= maxReports) {
        break;
      }

      // Safety check: if we got fewer than requested and hasNextPage is true, something might be wrong
      if (newReports.length === 0 && hasNextPage) {
        console.warn('  Warning: No new reports but hasNextPage=true, stopping to prevent infinite loop');
        break;
      }
    }

    console.log(`  Pagination complete. Total unique reports: ${allReports.length}`);

    // Trim to max if we fetched more
    if (allReports.length > maxReports) {
      return allReports.slice(0, maxReports);
    }

    return allReports;
  }

  /**
   * Fetch test case details from Octomind API (with caching)
   */
  async fetchTestCase(testTargetId: string, testCaseId: string): Promise<OctomindTestCase> {
    // Create cache key
    const cacheKey = `${testTargetId}:${testCaseId}`;
    
    // Check cache first
    if (this.testCaseCache.has(cacheKey)) {
      return this.testCaseCache.get(cacheKey)!;
    }
    
    const url = `${this.apiBaseUrl}/apiKey/v2/test-targets/${testTargetId}/test-cases/${testCaseId}`;
    
    const response = await fetch(url, {
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    let testCase: OctomindTestCase;
    
    if (!response.ok) {
      // If we can't fetch the test case, return minimal info
      testCase = {
        id: testCaseId,
        name: testCaseId,
        tags: [],
      };
    } else {
      testCase = await response.json() as OctomindTestCase;
    }
    
    // Store in cache
    this.testCaseCache.set(cacheKey, testCase);
    
    return testCase;
  }

  /**
   * Convert Octomind status to Allure status
   */
  private convertStatus(status: string): AllureStatus {
    switch (status) {
      case 'PASSED':
        return 'passed';
      case 'FAILED':
        return 'failed';
      case 'BROKEN':
        return 'broken';
      case 'SKIPPED':
        return 'skipped';
      default:
        return 'unknown';
    }
  }

  /**
   * Generate history ID from test details (for linking test runs)
   */
  private generateHistoryId(testTargetId: string, testCaseId: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5')
      .update(`${testTargetId}:${testCaseId}`)
      .digest('hex');
  }

  /**
   * Convert Octomind test step to Allure step
   */
  private convertStep(step: OctomindTestStep, startTime: number): AllureStep {
    const stepStart = startTime;
    const stepStop = startTime + (step.duration || 0);

    const allureStep: AllureStep = {
      name: step.name,
      status: this.convertStatus(step.status),
      stage: 'finished',
      start: stepStart,
      stop: stepStop,
    };

    if (step.error) {
      allureStep.statusDetails = {
        message: step.error,
      };
    }

    return allureStep;
  }

  /**
   * Convert Octomind test result to Allure test result
   */
  async convertTestResult(
    testResult: OctomindTestResult,
    testReport: OctomindTestReport,
    testCase: OctomindTestCase,
    testTarget: OctomindTestTarget
  ): Promise<AllureTestResult> {
    const uuid = randomUUID();
    const historyId = this.generateHistoryId(testResult.testTargetId, testResult.testCaseId);
    
    // Use test case description as name, fallback to test case ID
    const testName = testCase.description || testCase.name || testResult.testCaseId;
    // Use app name instead of testTargetId for better readability
    const testFullName = `${testTarget.app}.${testName}`;
    
    // Calculate timestamps
    const createdAt = testResult.createdAt ? new Date(testResult.createdAt).getTime() : Date.now();
    const updatedAt = testResult.updatedAt ? new Date(testResult.updatedAt).getTime() : createdAt;
    const start = createdAt;
    const stop = updatedAt;

    // Build links
    const links: AllureLink[] = [];
    
    // Add deeplink to Octomind app
    links.push({
      type: 'link',
      name: 'View in Octomind',
      url: `https://app.octomind.dev/testtargets/${testResult.testTargetId}/testreports/${testReport.id}`,
    });

    // Add trace URL if available
    if (testResult.traceUrl) {
      links.push({
        type: 'link',
        name: 'Playwright Trace',
        url: testResult.traceUrl,
      });
    }

    // Add external ID link if available
    if (testCase.externalId) {
      links.push({
        type: 'tms',
        name: testCase.externalId,
        url: `#${testCase.externalId}`, // Placeholder, adjust based on your TMS
      });
    }

    // Build labels
    const labels: AllureLabel[] = [
      { name: 'host', value: 'octomind' },
      { name: 'language', value: 'typescript' },
      { name: 'framework', value: 'playwright' },
      { name: 'testClass', value: testTarget.app },
      { name: 'testMethod', value: testResult.testCaseId },
      { name: 'suite', value: testName },
      { name: 'package', value: testTarget.app },
    ];

    // Add breakpoint as label
    if (testReport.breakpoint) {
      labels.push({
        name: 'breakpoint',
        value: testReport.breakpoint,
      });
    }

    // Add browser type as label
    if (testReport.browserType) {
      labels.push({
        name: 'browser',
        value: testReport.browserType,
      });
    }

    // Add tags from test case as labels
    if (testCase.tags && testCase.tags.length > 0) {
      testCase.tags.forEach(tag => {
        if( tag.type === 'TEXT') {
          labels.push({
            name: 'tag',
            value: tag.value,
          });
        }
      });
    }

    // Convert steps
    const steps: AllureStep[] = [];
    if (testResult.steps) {
      let currentTime = start;
      testResult.steps.forEach(step => {
        steps.push(this.convertStep(step, currentTime));
        currentTime += (step.duration || 0);
      });
    }

    // Build status details
    let statusDetails: AllureStatusDetails | undefined;
    if (testResult.error || testResult.stackTrace) {
      statusDetails = {
        message: testResult.error,
        trace: testResult.stackTrace,
      };
    }

    const allureResult: AllureTestResult = {
      uuid,
      historyId,
      testCaseId: testResult.testCaseId,
      fullName: testFullName,
      name: testName,
      description: testCase.description,
      links,
      labels,
      status: this.convertStatus(testResult.status),
      statusDetails,
      stage: 'finished',
      start,
      stop,
      steps,
    };

    return allureResult;
  }

  /**
   * Convert Octomind test report to Allure container
   */
  convertToContainer(testReport: OctomindTestReport, testResultUuids: string[]): AllureContainer {
    const uuid = randomUUID();
    
    // Calculate timestamps
    const now = Date.now();
    let start = now;
    let stop = now;

    if (testReport.startedAt) {
      start = new Date(testReport.startedAt).getTime();
    }
    if (testReport.finishedAt) {
      stop = new Date(testReport.finishedAt).getTime();
    }

    const container: AllureContainer = {
      uuid,
      name: `Test Report ${testReport.id}`,
      start,
      stop,
      children: testResultUuids,
    };

    return container;
  }

  /**
   * Convert and write Allure results for a single test report
   */
  async convertTestReportToAllure(
    testReport: OctomindTestReport,
    testTarget: OctomindTestTarget,
    outputDir: string
  ): Promise<string[]> {
    const testResultUuids: string[] = [];

    // Convert each test result
    for (const testResult of testReport.testResults) {
      console.log(`  Converting test case: ${testResult.testCaseId}, status: ${testResult.status}`);
      
      // Fetch test case details
      const testCase = await this.fetchTestCase(testReport.testTargetId, testResult.testCaseId);
      
      // Convert to Allure format
      const allureResult = await this.convertTestResult(testResult, testReport, testCase, testTarget);
      testResultUuids.push(allureResult.uuid);

      // Write result file
      const resultFileName = `${allureResult.uuid}-result.json`;
      const resultFilePath = path.join(outputDir, resultFileName);
      fs.writeFileSync(resultFilePath, JSON.stringify(allureResult, null, 2));
    }

    return testResultUuids;
  }

  /**
   * Convert and write Allure results for a single test report (by ID)
   */
  async convertAndWrite(
    testTargetId: string,
    testReportId: string,
    outputDir: string
  ): Promise<void> {
    console.log('Fetching test target...');
    const testTarget = await this.fetchTestTarget(testTargetId);
    console.log(`Test Target: ${testTarget.app}`);
    
    console.log('Fetching test report...');
    const testReport = await this.fetchTestReport(testTargetId, testReportId);
    
    console.log(`Found ${testReport.testResults.length} test results`);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const testResultUuids = await this.convertTestReportToAllure(testReport, testTarget, outputDir);

    // Create and write container file
    console.log('Creating container...');
    const container = this.convertToContainer(testReport, testResultUuids);
    const containerFileName = `${container.uuid}-container.json`;
    const containerFilePath = path.join(outputDir, containerFileName);
    fs.writeFileSync(containerFilePath, JSON.stringify(container, null, 2));
    
    console.log(`  Written: ${containerFileName}`);
    console.log(`\nConversion complete! Output directory: ${outputDir}`);
    console.log(`Generated ${testResultUuids.length} test result files and 1 container file.`);
  }

  wipeDirSync(dir: string) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  }

  copyDirSync(srcDir: string, destDir: string) {
    // Node 16.7+ provides cpSync
    fs.cpSync(srcDir, destDir, { recursive: true, force: true, errorOnExist: false });
  }

  /**
   * Convert and write Allure results for multiple test reports
   */
  async convertMultipleReports(
    testTargetId: string,
    outputDir: string,
    options?: {
      maxReports?: number;
      environmentId?: string;
      debug?: boolean;
    }
  ): Promise<void> {
    console.log('Fetching test target...');
    const testTarget = await this.fetchTestTarget(testTargetId);
    console.log(`Test Target: ${testTarget.app}`);
    
    // Build filters array if environment ID is provided
    const filters: TestReportFilter[] | undefined = options?.environmentId
      ? [
          {
            key: 'environmentId',
            value: {
              operator: 'equals',
              value: options.environmentId,
            },
          },
        ]
      : undefined;

    if (filters) {
      console.log(`Filtering by environment: ${options?.environmentId}`);
    }

    // Clear test case cache before starting batch conversion
    this.testCaseCache.clear();
    console.log('Test case cache initialized');

    // Fetch all test reports
    const testReports = await this.fetchAllTestReports(testTargetId, {
      maxReports: options?.maxReports,
      filters,
      debug: options?.debug,
    });

    console.log(`\nFound ${testReports.length} test reports to convert`);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const reportDir = 'allure-report';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const historyDir = path.join(reportDir, 'history');

    let totalTestResults = 0;
    let totalContainers = 0;

    // Convert each test report
    for (let i = 0; i < testReports.length; i++) {
      this.wipeDirSync(outputDir);
      const testReport = testReports[i];
      console.log(`\n[${i + 1}/${testReports.length}] Converting report: ${testReport.id}`);
      console.log(`  Status: ${testReport.status}, Tests: ${testReport.testResults.length}`);

      const testResultUuids = await this.convertTestReportToAllure(testReport, testTarget, outputDir);
      totalTestResults += testResultUuids.length;

      // Create and write container file
      const container = this.convertToContainer(testReport, testResultUuids);
      const containerFileName = `${container.uuid}-container.json`;
      const containerFilePath = path.join(outputDir, containerFileName);
      fs.writeFileSync(containerFilePath, JSON.stringify(container, null, 2));
      totalContainers++;
      if( fs.existsSync(historyDir) ) this.copyDirSync(historyDir, path.join(outputDir, 'history'));
      console.log(`Generating Allure report for report: ${testReport.id}`);
      execFileSync('allure', ['generate', outputDir, '-o', reportDir, '--clean' ], {
        stdio: 'inherit',
      });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Conversion complete!');
    console.log(`${'='.repeat(60)}`);
    console.log(`Output directory: ${outputDir}`);
    console.log(`Test reports converted: ${testReports.length}`);
    console.log(`Test result files: ${totalTestResults}`);
    console.log(`Container files: ${totalContainers}`);
    console.log(`Total files: ${totalTestResults + totalContainers}`);
    console.log(`Test cases cached: ${this.testCaseCache.size}`);
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let apiKey = '';
  let testTargetId = '';
  let testReportId = '';
  let outputDir = './allure-results';
  let batchMode = false;
  let maxReports: number | undefined;
  let environmentId: string | undefined;
  let debug = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--api-key':
      case '-k':
        apiKey = args[++i];
        break;
      case '--test-target-id':
      case '-t':
        testTargetId = args[++i];
        break;
      case '--test-report-id':
      case '-r':
        testReportId = args[++i];
        break;
      case '--output-dir':
      case '-o':
        outputDir = args[++i];
        break;
      case '--batch':
      case '-b':
        batchMode = true;
        break;
      case '--max-reports':
      case '-m':
        maxReports = parseInt(args[++i], 10);
        break;
      case '--environment-id':
      case '-e':
        environmentId = args[++i];
        break;
      case '--debug':
      case '-d':
        debug = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Octomind to Allure Converter

Usage:
  ts-node converter.ts [options]

Options:
  -k, --api-key <key>           Octomind API key (required)
  -t, --test-target-id <id>     Test target ID (required)
  -r, --test-report-id <id>     Test report ID (required for single mode)
  -o, --output-dir <dir>        Output directory (default: ./allure-results)
  -b, --batch                   Batch mode: convert multiple test reports
  -m, --max-reports <number>    Maximum number of reports to convert in batch mode
  -e, --environment-id <id>     Filter by environment ID in batch mode
  -d, --debug                   Enable debug logging for API requests
  -h, --help                    Show this help message

Single Report Mode:
  ts-node converter.ts \\
    --api-key your-api-key \\
    --test-target-id e6bfc622-acb2-4305-8b4a-c6a079b292d6 \\
    --test-report-id 9ae238fd-b4d3-4a8d-920e-93b0d26fc7cb \\
    --output-dir ./allure-results

Batch Mode (all reports):
  ts-node converter.ts \\
    --api-key your-api-key \\
    --test-target-id e6bfc622-acb2-4305-8b4a-c6a079b292d6 \\
    --batch \\
    --output-dir ./allure-results

Batch Mode (limited reports):
  ts-node converter.ts \\
    --api-key your-api-key \\
    --test-target-id e6bfc622-acb2-4305-8b4a-c6a079b292d6 \\
    --batch \\
    --max-reports 10 \\
    --output-dir ./allure-results

Batch Mode (filter by environment):
  ts-node converter.ts \\
    --api-key your-api-key \\
    --test-target-id e6bfc622-acb2-4305-8b4a-c6a079b292d6 \\
    --batch \\
    --environment-id 3c90c3cc-0d44-4b50-8888-8dd25736052a \\
    --output-dir ./allure-results
`);
        process.exit(0);
    }
  }

  // Validate required arguments
  if (!apiKey || !testTargetId) {
    console.error('Error: Missing required arguments\n');
    console.error('Required:');
    console.error('  --api-key <key>');
    console.error('  --test-target-id <id>');
    if (!batchMode) {
      console.error('  --test-report-id <id> (for single report mode)');
    }
    console.error('\nRun with --help for more information');
    process.exit(1);
  }

  // Validate batch mode vs single mode
  if (batchMode && testReportId) {
    console.error('Error: Cannot specify both --batch and --test-report-id');
    console.error('Use --batch for multiple reports OR --test-report-id for a single report');
    process.exit(1);
  }

  if (!batchMode && !testReportId) {
    console.error('Error: --test-report-id is required in single report mode');
    console.error('Use --batch flag to convert multiple reports');
    process.exit(1);
  }

  // Run conversion
  try {
    const converter = new OctomindToAllureConverter(apiKey, process.env.OCTOMIND_API_URL);
    
    if (batchMode) {
      await converter.convertMultipleReports(testTargetId, outputDir, {
        maxReports,
        environmentId,
        debug,
      });
    } else {
      await converter.convertAndWrite(testTargetId, testReportId, outputDir);
    }
  } catch (error) {
    console.error('Error during conversion:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { OctomindToAllureConverter };