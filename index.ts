import {EventEmitter} from 'events';
import {spawn, exec, ChildProcess} from 'child_process';
import {basename} from 'path';

interface QueryResultCandidate {
    primaryText: string;
    secondaryText?: string;
    iconPath?: string;
}

interface BoosterProcessQueryResult {
    input: string;
    candidates: QueryResultCandidate[];
}

const on_osx = process.platform === 'darwin';
const on_linux = process.platform === 'linux';

class FilesBooster {
    prev_input: string;
    current_process: ChildProcess;
    candidates_cache: string[];

    constructor(public context: EventEmitter) {
        this.prev_input = null;
        this.current_process = null;
        this.candidates_cache = null;
        if (this.isAvailable()) {
            this.context.on('query', this.query.bind(this));
        }
        this.context.on('shutdown', this.shutdown.bind(this));
    }

    isAvailable() {
        // TODO: Check 'locate' command on Linux
        return on_osx || on_linux;
    }

    shutdown() {
        if (this.current_process !== null) {
            this.current_process.kill();
        }
    }

    child_running() {
        return this.current_process !== null;
    }

    query(input: string) {
        if (input.length < 3 || input === this.prev_input) {
            return;
        }

        const child_running = this.child_running();
        if (!child_running && input.startsWith(this.prev_input)) {
            this.narrowDown(input);
            return;
        }

        if (child_running) {
            this.current_process.kill();
            this.current_process = null;
        }

        this.startLocatePath(input);
    }

    private startProcess(input: string) {
        if (on_osx) {
            return spawn('mdfind', ['-name', input]);
        } else if (on_linux) {
            return spawn('locate', [input]);
        } else {
            // Note: Never reaches here
            console.error('Invalid environment!');
            return null;
        }
    }

    startLocatePath(input: string) {
        this.prev_input = input;
        this.current_process = this.startProcess(input);
        this.current_process.stdout.on('data', (output: Buffer) => {
            this.candidates_cache = output.toString().split(/\n+/);
            const candidates = this.candidates_cache.map(path => ({
                                            primaryText: basename(path),
                                            secondaryText: path,
                                        }));
            this.context.emit('query-result', { input, candidates });
        });
        this.current_process.on('close', (code: number) => {
            this.current_process = null;
        });
        this.current_process.stderr.on('data', (output: Buffer) => {
            console.error('locate process error!: ', output.toString());
        });
    }

    narrowDown(input: string) {
        const candidates = this.candidates_cache.filter(c => c.includes(input));
        this.prev_input = input;
        this.candidates_cache = candidates;
        this.context.emit('query-result', {
            input,
            candidates: candidates.map(path => ({
                primaryText: basename(path),
                secondaryText: path,
            })),
        });
    }
}

export = FilesBooster;
