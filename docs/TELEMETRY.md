# Telemetry Integration

## Overview
Rebel Factory integrates with Paperclip for agent orchestration and telemetry.

## Architecture
```
Rebel Factory Backend
        ↓
  TelemetryService
        ↓
  PostgreSQL (local)
        ↓
  Paperclip Sync (optional)
```

## Metrics Collected
- Agent runs (start, complete, fail)
- Token usage (input, output)
- Quality scores
- Cost per run
- Duration

## Self-Learning System
1. **Individual Learning**: Per-agent pattern detection
2. **Venture Learning**: Cross-agent insights within a tenant
3. **Rebel-wide Learning**: Global patterns across all tenants

## Drift Detection
- Quality drift: Alert when avg quality drops >5% over 3 days
- Cost drift: Alert when costs exceed budget thresholds
- Usage drift: Unusual activity patterns

## API Endpoints
- GET /api/telemetry/metrics - Aggregated metrics
- GET /api/telemetry/insights - Learning insights
- GET /api/telemetry/drift - Drift alerts
