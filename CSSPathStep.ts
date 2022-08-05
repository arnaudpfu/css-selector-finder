import DOMNodePathStep from './DOMNodePathStep';

enum WritingMode {
    /**
     * @strict - Only way to respect strict-mode.
     * @stable - This mode is always applicable.
     *
     * @example
     *  - #page-container > section > p:nth-child(2)
     *  - body > div:nth-child(5)
     *  - body > div:nth-child(5) > form > input:nth-child(3)
     *
     *  `strict`
     *  - #page-container > section:nth-child(1) > p:nth-child(2)
     *  - body > div:nth-child(5)
     *  - body > div:nth-child(5) > form:nth-child(2) > input:nth-child(3)
     *
     */
    NTH_CHILD,
    /**
     * @unstable - If the targeted node/parent do not have className, `NTH_CHILD` is used.
     *
     * @example
     *  - #page-container > section > p.about
     *  - body > div.my-custom-class
     *  - body > div:nth-child(5) > form > input.name-field
     *
     *  `strict`
     *  - #page-container > section:nth-child(1) > p.about
     *  - body > div.my-custom-class
     *  - body > div:nth-child(5) > form:nth-child(2) > input.name-field
     *
     */
    TAGNAME_AND_CLASSNAME,
}

class CSSPathStep {
    public node: Element;
    public isTargetNode: boolean;
    public value: string | null;
    public optimized: boolean;

    constructor(node: Element, isTargetNode: boolean) {
        this.node = node;
        this.isTargetNode = isTargetNode;
        this.value = null;
        this.optimized = false;
        this.init();
    }

    public isNull(): boolean {
        return null === this.value;
    }

    /**
     * Retrieve the class of a node prefixed of a `$`.
     *
     * @param {!TopLevelObject.DOMNode} node Node to check css class.
     * @return {!Array.<string>} string[] of class
     */
    private prefixedElementClassNames(node: Element): string[] {
        const classAttribute = node.getAttribute('class');
        if (!classAttribute) return [];
        return classAttribute
            .split(/\s+/g)
            .filter(Boolean)
            .map((name: string) => {
                // The prefix is required to store "__proto__" in a object-based map.
                return '$' + name;
            });
    }
    /**
     * @param {string} id
     * @return {string}
     */
    private idSelector(id: string): string {
        return '#' + this.escapeIdentifierIfNeeded(id);
    }
    /**
     * @param {string} ident
     * @return {string}
     */
    private escapeIdentifierIfNeeded(ident: string): string {
        if (this.isCSSIdentifier(ident)) return ident;
        const shouldEscapeFirst = /^(?:[0-9]|-[0-9-]?)/.test(ident);
        const lastIndex = ident.length - 1;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const ctx = this;
        return ident.replace(/./g, function (c: string, i: number) {
            return (shouldEscapeFirst && i === 0) || !ctx.isCSSIdentChar(c)
                ? ctx.escapeAsciiChar(c, i === lastIndex)
                : c;
        });
    }
    /**
     * @param {string} c
     * @param {boolean} isLast
     * @return {string}
     */
    private escapeAsciiChar(c: string, isLast: boolean): string {
        return '\\' + this.toHexByte(c) + (isLast ? '' : ' ');
    }
    /**
     * @param {string} c
     */
    private toHexByte(c: string): string {
        let hexByte = c.charCodeAt(0).toString(16);
        if (hexByte.length === 1) hexByte = '0' + hexByte;
        return hexByte;
    }
    /**
     * @param {string} c
     * @return {boolean}
     */
    private isCSSIdentChar(c: string): boolean {
        if (/[a-zA-Z0-9_-]/.test(c)) return true;
        return c.charCodeAt(0) >= 0xa0;
    }
    /**
     * @param {string} value
     * @return {boolean}
     */
    private isCSSIdentifier(value: string): boolean {
        return /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/.test(value);
    }

    /**
     *
     * Get an optimized value if there exist one.
     *
     * @param element Element
     * @returns DOMNodePathStep | null if there is any optimized value.
     */
    private getOptimizedValue(element: Element): DOMNodePathStep | null {
        const id = element.getAttribute('id');
        if (id) return new DOMNodePathStep(this.idSelector(id), true);

        const nodeName = element.tagName.toLowerCase();
        if (['html', 'head', 'body'].includes(nodeName)) return new DOMNodePathStep(nodeName, true);

        const parent = element.parentNode;
        if (!parent) return new DOMNodePathStep(nodeName, true);

        if (parent.nodeType === Node.DOCUMENT_NODE) {
            throw new Error('The child of a Document must be <html></html>');
        }

        return null;
    }

    private getWritingMode(): { mode: WritingMode; index: number; ownClassNames: string[] } {
        const nodeName = this.node.tagName.toLowerCase();
        const prefixedOwnClassNames = this.prefixedElementClassNames(this.node);

        let needsNthChild = false;
        let ownIndex = -1;
        let elementIndex = -1;
        const siblings = (this.node.parentNode as ParentNode).children;
        for (let i = 0; (ownIndex === -1 || !needsNthChild) && i < siblings.length; ++i) {
            if (siblings[i].nodeType !== Node.ELEMENT_NODE) continue;
            const sibling = siblings[i] as Element;
            elementIndex += 1;
            if (sibling === this.node) {
                ownIndex = elementIndex;
                continue;
            }
            if (needsNthChild) continue;
            if (sibling.tagName.toLowerCase() !== nodeName) continue;

            if (prefixedOwnClassNames.length === 0) {
                needsNthChild = true;
                continue;
            }

            const siblingClassNamesArray = this.prefixedElementClassNames(sibling);
            let ownClassNameCount = prefixedOwnClassNames.length;
            for (const siblingClass of siblingClassNamesArray) {
                if (!prefixedOwnClassNames.includes(siblingClass)) continue;
                prefixedOwnClassNames.splice(prefixedOwnClassNames.indexOf(siblingClass), 1);
                if (!--ownClassNameCount) {
                    needsNthChild = true;
                    break;
                }
            }
        }

        return {
            mode: needsNthChild ? WritingMode.NTH_CHILD : WritingMode.TAGNAME_AND_CLASSNAME,
            index: ownIndex,
            ownClassNames: prefixedOwnClassNames,
        };
    }

    public computeStep() {
        if (this.node.nodeType !== Node.ELEMENT_NODE) throw new Error('Element is not one.');

        const optimizedValue = this.getOptimizedValue(this.node);
        if (optimizedValue) return optimizedValue;

        const nodeName = this.node.tagName.toLowerCase();
        const {
            mode: writingMode,
            index: ownIndex,
            ownClassNames: prefixedOwnClassNames,
        } = this.getWritingMode();

        let result = nodeName;
        if (
            this.isTargetNode &&
            nodeName.toLowerCase() === 'input' &&
            this.node.getAttribute('type') &&
            !this.node.getAttribute('id') &&
            !this.node.getAttribute('class')
        )
            result += `[type="${this.node.getAttribute('type')}"]`;

        switch (writingMode) {
            case WritingMode.NTH_CHILD:
                result += `:nth-child(${ownIndex + 1})`;
                break;
            case WritingMode.TAGNAME_AND_CLASSNAME:
                for (const prefixedName in prefixedOwnClassNames.values()) {
                    result += '.' + this.escapeIdentifierIfNeeded(prefixedName.substring(1));
                }
                break;
        }

        return new DOMNodePathStep(result, false);
    }

    private init() {
        const { value, optimized } = this.computeStep();
        this.value = value;
        this.optimized = optimized;
    }
}

export default CSSPathStep;
