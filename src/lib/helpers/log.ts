import {Logging} from './common.interface';
const NODE_DEBUG = process.env.NODE_DEBUG ?? '';

export default function log(type: Logging, ...msg: (string | number)[]): void {
    if (type === Logging.LOG) {
        console.log(msg.join(' '));
    } else if (type === Logging.WARN) {
        // yellow
        console.warn('\x1b[33m%s\x1b[0m', msg.toString());
    } else if (type === Logging.SUCCESS) {
        // green
        console.log('\x1b[32m%s\x1b[0m', msg.join(' '));
    } else if (type === Logging.ERROR && NODE_DEBUG?.toUpperCase() === Logging.ERROR) {
        // red
        console.error('\x1b[31m%s\x1b[0m', msg.join(' '));
    }
}
