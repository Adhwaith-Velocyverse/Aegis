# Aegis Reporting Module

A standalone, reusable reporting module for generating professional security assessment reports in PDF and Excel formats.

## Purpose

This module consumes finalized security assessment data from the Aegis Scoring and Recommendation engines and produces professional reports. It does not perform assessment collection, scoring, or recommendation generation.

## Architecture

```
Scoring Engine
       |
       v
Recommendation Engine
       |
       v
Report Data Adapter
       |
       v
+------------------+
| Reporting Module |
|------------------|
| Validation       |
| PDF Generation   |
| Excel Generation |
| Donut Chart      |
+------------------+
       |
       +----> PDF Report
       |
       +----> Excel Report
```

## Installation

```bash
npm install @aegis/reporting
```

## Input Data Contract

The module accepts `SecurityAssessmentReportData`:

```typescript
interface SecurityAssessmentReportData {
  assessment: {
    assessmentId: string;
    assessmentType: string;
    assessmentName?: string;
    tenantName?: string;
    assessmentDate: string;
    status?: string;
    durationMs?: number;
  };

  summary: {
    totalControls: number;
    actionableControls: number;
    passed: number;
    failed: number;
    partial: number;
    manualReview: number;
    notApplicable: number;
    totalScore: number;
    maximumScore: number;
    percentage: number | null;
    riskExposurePercentage?: number;
    securityPosturePercentage?: number;
  };

  controls: SecurityControlResult[];
  recommendations: Recommendation[];
  informationalControls?: InformationalControl[];
  failedEndpoints?: FailedEndpoint[];
  metadata?: Record<string, unknown>;
}
```

## Usage

```typescript
import { generatePdfReport, generateExcelReport, validateReportData, buildReportDataFromScore } from '@aegis/reporting';

// Option 1: Build report data from scoring engine output
const scoreResult = await scoringEngine.calculateSecurityScore(assessment);
const reportData = buildReportDataFromScore(scoreResult);

// Option 2: Provide custom report data
const reportData = {
  assessment: { ... },
  summary: { ... },
  controls: [ ... ],
  recommendations: [ ... ],
  // ...
};

// Validate before generating
validateReportData(reportData);

// Generate PDF
await generatePdfReport(reportData, {
  outputPath: './reports/assessment.pdf',
  title: 'Security Assessment Report',
});

// Generate Excel
await generateExcelReport(reportData, './reports/assessment.xlsx');
```

## Report Contents

### PDF Report
1. Cover page with donut chart showing Security Posture vs Risk Exposure
2. Assessment Overview with control counts and scores
3. Executive Summary with key strengths and areas for improvement
4. Detailed Control Results with evidence and recommendations
5. Recommendations section
6. Informational Controls (if any)
7. Failed Endpoints / Collection Issues (if any)
8. Conclusion

### Excel Report
1. Executive Summary worksheet
2. Control Results worksheet
3. Recommendations worksheet
4. Informational Controls worksheet (if any)
5. Failed Endpoints worksheet (if any)

## Donut Chart

The executive summary includes a donut chart that visually represents:
- Green segment: Security Posture percentage
- Red segment: Risk Exposure percentage
- Center: Risk Exposure Score percentage
- Legend below the chart

Chart values are dynamically generated from the scoring engine output.

## Validation

The module validates all required fields before report generation. Invalid data will throw descriptive errors.

## Error Handling

- Missing required fields: throws validation error
- Empty controls array: generates report with no controls
- 0% or 100% scores: handled correctly
- Missing evidence/recommendation: rendered as empty strings

## Portability

To use this module in another project:

1. Copy the `reporting/` folder
2. Install dependencies: `pdfkit`, `exceljs`
3. Import and call `generatePdfReport()` or `generateExcelReport()`
4. Provide data conforming to `SecurityAssessmentReportData`

No dependency on Email Security, Entra ID, or any specific assessment module.

## Testing

```bash
cd reporting
npm test
```

## License

Proprietary - Aegis Security Assessment Platform
