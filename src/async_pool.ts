export class AsyncPool {
    public readonly completion: Promise<void>;
    private readonly maxCount: number;
    private readonly queue: Array<Function> = [];
    private resolver: Function;
    private executing = 0;
    private down = false;

    public constructor(maxParallelCount: number) {
        this.maxCount = maxParallelCount;
        this.completion = new Promise(res => this.resolver = res);
    }

    public submit(task: Function): void {
        if (this.down) {
            throw 'Already shutdown';
        }

        this.queue.push(task);
        this.pollNext();
    }

    private async pollNext(): Promise<void> {
        if (this.executing >= this.maxCount) {
            return;
        }

        if (!this.queue.length) {
            if (!this.executing) {
                this.resolver();
            }
            
            return;
        }

        this.executing++;

        const task = this.queue.shift()!!;
        const result = task();
        if (result && result instanceof Promise) {
            try {
                await result;
            } catch (err) {
                this.executing--;
                this.pollNext();

                throw err;
            }
        }

        this.executing--;
        this.pollNext();
    }

    public shutdown(): void {
        this.down = true;
    }
}