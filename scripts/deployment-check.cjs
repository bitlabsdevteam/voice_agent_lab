const fs = require("node:fs");

const requiredFiles = [
  "Dockerfile",
  "docker-compose.yml",
  "infra/postgres/001_initial_schema.sql",
  "infra/observability/prometheus.yml",
  "infra/observability/alerts.yml",
  "infra/observability/grafana-dashboard.json",
  "infra/observability/grafana/provisioning/datasources/datasource.yml",
  "infra/observability/grafana/provisioning/dashboards/dashboard.yml",
  "docs/deployment.md",
  "docs/operations.md",
  "release/release-manifest.json",
  "release/deployment-evidence.json"
];

const requiredManifestFields = [
  "application",
  "version",
  "buildId",
  "provider",
  "modelId",
  "sessionStore",
  "eventSink",
  "promptVersion",
  "promptSha256",
  "releaseGates",
  "observability",
  "productionCanaryEvidence",
  "rollback"
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
if (missingFiles.length > 0) {
  throw new Error(`Missing deployment files: ${missingFiles.join(", ")}`);
}

const manifest = JSON.parse(fs.readFileSync("release/release-manifest.json", "utf8"));
const missingFields = requiredManifestFields.filter((field) => !(field in manifest));
if (missingFields.length > 0) {
  throw new Error(`Missing release manifest fields: ${missingFields.join(", ")}`);
}

const deploymentEvidence = JSON.parse(fs.readFileSync("release/deployment-evidence.json", "utf8"));
if (!deploymentEvidence.ok) {
  throw new Error("Deployment evidence is not ok");
}

const operationsDoc = fs.readFileSync("docs/operations.md", "utf8");
const requiredRunbookSections = [
  "## On-Call Ownership",
  "## Dashboard Links",
  "## Alert Definitions",
  "## Known Provider Failure Modes",
  "## Manual Provider Failover",
  "## Prompt Rollback",
  "## Model Rollback",
  "## Tool Disable",
  "## Tenant Disable"
];
const missingRunbookSections = requiredRunbookSections.filter((section) => !operationsDoc.includes(section));
if (missingRunbookSections.length > 0) {
  throw new Error(`Missing operations runbook sections: ${missingRunbookSections.join(", ")}`);
}

const remoteEvidencePath = "release/remote-deployment-evidence.json";
const remoteDeploymentEvidence = fs.existsSync(remoteEvidencePath)
  ? JSON.parse(fs.readFileSync(remoteEvidencePath, "utf8"))
  : null;

console.log(
  JSON.stringify(
    {
      ok: true,
      filesChecked: requiredFiles.length,
      manifestFieldsChecked: requiredManifestFields.length,
      runbookSectionsChecked: requiredRunbookSections.length,
      deploymentEvidenceOk: deploymentEvidence.ok,
      remoteDeploymentEvidenceOk: remoteDeploymentEvidence ? remoteDeploymentEvidence.ok : null,
      remoteDeploymentEvidenceSkipped: remoteDeploymentEvidence ? Boolean(remoteDeploymentEvidence.skipped) : null,
      productionCanaryEvidence: manifest.productionCanaryEvidence,
      provider: manifest.provider,
      modelId: manifest.modelId
    },
    null,
    2
  )
);
