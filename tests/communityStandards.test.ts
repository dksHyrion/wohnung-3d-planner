import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Open Source Community Standards', () => {
  const root = path.resolve(__dirname, '..');

  it('provides a comprehensive CONTRIBUTING.md guideline', () => {
    const contributingPath = path.join(root, 'CONTRIBUTING.md');
    expect(fs.existsSync(contributingPath)).toBe(true);

    const content = fs.readFileSync(contributingPath, 'utf-8');
    expect(content).toContain('1 Three.js Unit = 1.0 cm');
    expect(content).toContain('EPSILON_CM');
    expect(content).toContain('npm test');
    expect(content).toContain('npm run build');
    expect(content).toContain('layoutFurnitureParts');
  });

  it('provides a SECURITY.md policy document', () => {
    const securityPath = path.join(root, 'SECURITY.md');
    expect(fs.existsSync(securityPath)).toBe(true);

    const content = fs.readFileSync(securityPath, 'utf-8');
    expect(content).toContain('Sicherheitsrichtlinie');
    expect(content).toContain('Offline-First');
    expect(content).toContain('Vulnerability');
  });

  it('provides GitHub Issue Templates and PR Template', () => {
    const bugPath = path.join(root, '.github/ISSUE_TEMPLATE/bug_report.yml');
    const featurePath = path.join(root, '.github/ISSUE_TEMPLATE/feature_request.yml');
    const configPath = path.join(root, '.github/ISSUE_TEMPLATE/config.yml');
    const prPath = path.join(root, '.github/pull_request_template.md');

    expect(fs.existsSync(bugPath)).toBe(true);
    expect(fs.existsSync(featurePath)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(prPath)).toBe(true);

    const bugContent = fs.readFileSync(bugPath, 'utf-8');
    expect(bugContent).toContain('name: Bug Report');
    expect(bugContent).toContain('Schritte zur Reproduktion');

    const prContent = fs.readFileSync(prPath, 'utf-8');
    expect(prContent).toContain('npm test');
    expect(prContent).toContain('npm run build');
  });
});
