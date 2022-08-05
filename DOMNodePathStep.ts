class DOMNodePathStep {
    value: string | null;
    optimized: boolean;

    constructor(value: string | null, optimized = false) {
        this.value = value;
        this.optimized = optimized;
    }

    /**
     * @return {string}
     */
    toString() {
        return this.value;
    }
}

export default DOMNodePathStep