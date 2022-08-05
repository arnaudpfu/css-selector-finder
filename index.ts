import { SpecificityArray } from 'specificity';
import CSSPathStep from './CSSPathStep';

/**
 * Retrieve a unique CSS Selector to an element node.
 * The CSS Selector won't be able to point other targets even if the DOM change.
 */
export class CSSSelectorFinder {
    /**
     * Element node for which we are looking for a CSS Selector.
     */
    protected node: Node;
    /**
     * Mininimum specificity constraint.
     */
    protected minSpecificity: SpecificityArray;
    /**
     * All the parts which compose the CSS selector.
     */
    protected path: CSSPathStep[];

    /**
     *
     * @param node Element node for which we are looking for a CSS Selector.
     * @param minSpecificity Mininimum specificity constraint.
     */
    constructor(node: Node, minSpecificity: SpecificityArray = [0, 0, 0, 0]) {
        this.node = node;
        this.minSpecificity = minSpecificity;
        this.path = this.cssPath();
    }

    toString(): string {
        return this.path.map((step) => step.value).join(' > ');
    }

    cssPath(): CSSPathStep[] {
        if (this.node.nodeType !== Node.ELEMENT_NODE) return [];
        const steps: CSSPathStep[] = [];
        let contextNode = this.node as Element | null;
        while (contextNode) {
            const step = new CSSPathStep(contextNode, contextNode === this.node);
            if (step.isNull()) break; // Error - bail out early.
            steps.push(step);
            if (step.optimized) break;
            contextNode = contextNode.parentElement;
        }
        return steps.reverse();
    }
}
