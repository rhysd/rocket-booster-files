import {EventEmitter} from 'events';
import {spawn, ChildProcess} from 'child_process';
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

class FilesBooster {
    current_input: string;
    current_process: ChildProcess;

    constructor(public context: EventEmitter) {
        this.current_input = null;
        this.current_process = null;
        this.context.on('query', this.query.bind(this));
    }

    query(input: string) {
        if (input === this.current_input) {
            return;
        }

        if (this.current_process !== null) {
            this.current_process.kill();
            this.current_process.disconnect();
            this.current_process = null;
        }

        this.startLocatePath(input);
    }

    startLocatePath(input: string) {
        this.current_input = input;
        this.current_process = spawn('locate', [input]);
        this.current_process.on('data', (output: Buffer) => {
            const candidates = output
                                .toString()
                                .split(/\n+/)
                                .map(path => {
                                    return {
                                        primaryText: basename(path),
                                        secondaryText: path,
                                    };
                                });
            this.context.emit('query-result', { input, candidates });
        });
        this.current_process.on('close', (code: number) => {
            this.current_input = null;
            this.current_process = null;
        });
    }
}

export = FilesBooster;
