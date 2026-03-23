import type {
  Violation,
  ComponentScore,
  AggregateScore,
  RenderStatus,
  ScoreEvent,
} from './types.js';

/**
 * In-memory store for component violations and scores.
 * Used by AST engine (write), render pipeline (write), and dashboard (read).
 */
export class ScoreStore {
  private components = new Map<string, ComponentScore>();
  private listeners = new Set<(event: ScoreEvent) => void>();

  /**
   * Replace violations for a component and recalculate tokenCompliance.
   *
   * Formula: round(((totalProperties - violations.length) / totalProperties) * 100, 1)
   * Edge case: totalProperties=0 → tokenCompliance=100.0
   */
  setViolations(
    file: string,
    violations: Violation[],
    totalProperties: number,
  ): void {
    const existing = this.components.get(file);

    const tokenCompliance =
      totalProperties === 0
        ? 100.0
        : Math.round(
            ((totalProperties - violations.length) / totalProperties) *
              100 *
              10,
          ) / 10;

    this.components.set(file, {
      file,
      exports: existing?.exports ?? [],
      tokenCompliance,
      renderFidelity: existing?.renderFidelity ?? null,
      renderStatus: existing?.renderStatus ?? 'pending',
      violations,
    });

    this.notify({ type: 'violation', file });
  }

  /**
   * Set render fidelity score and status for a component.
   */
  setRenderFidelity(
    file: string,
    score: number | null,
    status: RenderStatus,
  ): void {
    const existing = this.components.get(file);

    this.components.set(file, {
      file,
      exports: existing?.exports ?? [],
      tokenCompliance: existing?.tokenCompliance ?? null,
      renderFidelity: score,
      renderStatus: status,
      violations: existing?.violations ?? [],
    });

    this.notify({ type: 'render', file });
  }

  /**
   * Get score for a single component.
   */
  getComponentScore(file: string): ComponentScore | undefined {
    return this.components.get(file);
  }

  /**
   * Get aggregate scores across all components.
   * Render fidelity average excludes skipped/error components.
   */
  getAggregateScore(): AggregateScore {
    let complianceSum = 0;
    let complianceCount = 0;
    let fidelitySum = 0;
    let renderedComponents = 0;
    let skippedComponents = 0;
    let totalViolations = 0;

    for (const comp of this.components.values()) {
      if (comp.tokenCompliance !== null) {
        complianceSum += comp.tokenCompliance;
        complianceCount++;
      }

      if (comp.renderStatus === 'rendered' && comp.renderFidelity !== null) {
        fidelitySum += comp.renderFidelity;
        renderedComponents++;
      }

      if (comp.renderStatus === 'skipped' || comp.renderStatus === 'error') {
        skippedComponents++;
      }

      totalViolations += comp.violations.length;
    }

    return {
      tokenCompliance:
        complianceCount > 0
          ? Math.round((complianceSum / complianceCount) * 10) / 10
          : 0,
      renderFidelity:
        renderedComponents > 0
          ? Math.round((fidelitySum / renderedComponents) * 10) / 10
          : 0,
      totalComponents: this.components.size,
      renderedComponents,
      skippedComponents,
      totalViolations,
    };
  }

  /**
   * Get all component scores as an array.
   */
  getAllComponents(): ComponentScore[] {
    return Array.from(this.components.values());
  }

  /**
   * Subscribe to store mutations. Returns an unsubscribe function.
   */
  subscribe(callback: (event: ScoreEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(event: ScoreEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
